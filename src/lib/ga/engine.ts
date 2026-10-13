// The planner's database half: saving a plan. The GA and the layout of its
// order onto days are pure and live in ./plan, re-exported here so existing
// imports of "@/lib/ga/engine" keep working.

import type { FitnessBreakdown, GAConfig, TriggerReason } from "@/types";
import { refreshPartNumbers } from "@/lib/schedule/work-items";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { GenerationLog, PlannedSession } from "./plan";

export { evolve, planDays } from "./plan";
export type { GenerationLog, PlannedSession, WeekPlan } from "./plan";

// ─── Persistence ────────────────────────────────────────────────────────────

/**
 * Inserts sessions into a plan in bulk, clip links included. A plan that runs
 * to the exam is hundreds of sessions, and a nested create writes them one
 * statement each — about 50ms apiece through the pooler, enough to outlast a
 * transaction. Orders must be unique within `sessions`.
 */
export async function insertSessions(
  tx: Prisma.TransactionClient,
  studyPlanId: string,
  sessions: PlannedSession[]
): Promise<void> {
  if (sessions.length === 0) return;
  const created = await tx.studySession.createManyAndReturn({
    data: sessions.map((s) => ({
      studyPlanId,
      subtopicId: s.subtopicId,
      scheduledDate: new Date(s.scheduledDate),
      durationMins: s.durationMins,
      order: s.order,
      status: "PENDING" as const,
      kind: s.kind ?? "STUDY",
    })),
    select: { id: true, order: true },
  });
  const idByOrder = new Map(created.map((c) => [c.order, c.id]));
  const links = sessions.flatMap((s) =>
    s.resourceIds.map((resourceId) => ({ sessionId: idByOrder.get(s.order)!, resourceId }))
  );
  if (links.length) await tx.studySessionResource.createMany({ data: links });
}

/** savePlan() found the learner already has an active plan — a request that raced this one made it. */
export class PlanExistsError extends Error {
  constructor(readonly studyPlanId: string) {
    super("The learner already has an active plan.");
  }
}

/**
 * Saves the learner's first plan, with its GA log. Then numbers the parts.
 *
 * Two requests can both see "no plan yet" and both run the GA (a double click,
 * two tabs). A per-learner lock taken inside the transaction makes the second
 * wait for the first to commit; it then finds the plan and throws
 * PlanExistsError instead of saving a second one.
 */
export async function savePlan(input: {
  userId: string;
  sessions: PlannedSession[];
  fitness: FitnessBreakdown;
  logs: GenerationLog[];
  cfg: GAConfig;
  triggerReason: TriggerReason;
  /** Saved with the plan alongside its config and fitness — seed, baseline, the original sessions. */
  extraMetadata?: Record<string, unknown>;
}): Promise<{ studyPlanId: string }> {
  const { userId, sessions, fitness, logs, cfg, triggerReason, extraMetadata } = input;

  const previous = await db.studyPlan.findFirst({
    where: { userId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const studyPlan = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const existing = await tx.studyPlan.findFirst({ where: { userId, isActive: true }, select: { id: true } });
      if (existing) throw new PlanExistsError(existing.id);
      const plan = await tx.studyPlan.create({
        data: {
          userId,
          version: (previous?.version ?? 0) + 1,
          fitnessScore: fitness.total,
          triggerReason,
          isActive: true,
          metadata: JSON.parse(JSON.stringify({ config: cfg, fitnessBreakdown: fitness, ...extraMetadata })),
        },
      });
      await insertSessions(tx, plan.id, sessions);
      return plan;
    },
    { timeout: 30000 }
  );

  // GA logs stay outside the transaction — append-only research data.
  await db.gaExecutionLog.createMany({
    data: logs.map((log) => ({
      studyPlanId: studyPlan.id,
      generation: log.generation,
      bestFitness: log.bestFitness,
      avgFitness: log.avgFitness,
      worstFitness: log.worstFitness,
      metadata: JSON.parse(JSON.stringify(log.breakdown)),
    })),
  });

  await refreshPartNumbers(userId, studyPlan.id);
  return { studyPlanId: studyPlan.id };
}

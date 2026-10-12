// Part 2 waits for part 1. Server-only.
//
// A long subtopic is split into parts at unit and lesson boundaries
// (./parts.ts). The parts are a sequence — part 2 builds on part 1 — so a part
// can't be completed while any clip before it in the curriculum is not yet
// done. The plan keeps parts in order (manual.ts refuses edits that swap them);
// this is the same rule at study time.

import { db } from "@/lib/db";

export interface PartLock {
  /** The subtopic whose earlier content is unfinished. */
  subtopicName: string;
  /** The planned session holding the first unfinished clip; null when that content isn't planned (it is in the backlog). */
  sessionId: string | null;
  scheduledDate: string | null;
  partIndex: number | null;
}

/**
 * What the learner must finish before `sessionId`, or null when nothing is in
 * the way: a whole-subtopic session, a review, part 1, or a part whose earlier
 * clips are all completed (in any plan).
 */
export async function earlierPartPending(userId: string, sessionId: string): Promise<PartLock | null> {
  const session = await db.studySession.findUnique({
    where: { id: sessionId },
    select: {
      studyPlanId: true,
      subtopicId: true,
      kind: true,
      subtopic: { select: { name: true } },
      resources: { select: { resource: { select: { order: true } } } },
    },
  });
  if (!session || session.kind !== "STUDY" || session.resources.length === 0) return null;

  const firstOrder = Math.min(...session.resources.map((r) => r.resource.order));
  const earlier = await db.resource.findMany({
    where: { subtopicId: session.subtopicId, order: { lt: firstOrder } },
    select: { id: true, order: true },
    orderBy: { order: "asc" },
  });
  if (earlier.length === 0) return null;

  const done = await db.studySessionResource.findMany({
    where: {
      resourceId: { in: earlier.map((r) => r.id) },
      session: { status: "COMPLETED", studyPlan: { userId } },
    },
    select: { resourceId: true },
  });
  const doneIds = new Set(done.map((d) => d.resourceId));
  const firstOpen = earlier.find((r) => !doneIds.has(r.id));
  if (!firstOpen) return null;

  const holder = await db.studySession.findFirst({
    where: {
      studyPlanId: session.studyPlanId,
      status: { not: "COMPLETED" },
      resources: { some: { resourceId: firstOpen.id } },
    },
    select: { id: true, scheduledDate: true, partIndex: true },
  });
  return {
    subtopicName: session.subtopic.name,
    sessionId: holder?.id ?? null,
    scheduledDate: holder ? holder.scheduledDate.toISOString().slice(0, 10) : null,
    partIndex: holder?.partIndex ?? null,
  };
}

// Editing the study plan by hand. Server-only.
//
// The GA makes the plan once (./create-plan.ts). After that the learner owns
// it: every change here is theirs, applied exactly, and nothing re-plans. The
// GA's original sessions stay in the plan's metadata, and resetPlan() puts them
// back. The rules with no database in them are in ./edits.ts.
//
// Completed sessions are history: they can't be moved, changed or deleted.
// Every other session can — including missed ones, which the learner can move
// to a day they're free.

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { insertSessions, type PlannedSession } from "@/lib/ga/engine";
import type { SubtopicData } from "@/types";
import { bangkokDateStr } from "./calendar";
import { loadStudyCalendar, loadSubtopics, type OriginalSessions } from "./create-plan";
import { findConflicts, pickClips, restorableSessions } from "./edits";
import { remainingMinutes } from "./parts";
import { REVIEW_MINUTES } from "./review";
import { loadWorkItems, refreshPartNumbers } from "./work-items";

/** A change the learner asked for that can't be made; `status` is the HTTP status to answer with. */
export class PlanEditError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

type Metadata = Record<string, unknown>;

/** Midnight UTC of a "YYYY-MM-DD" date — how StudySession.scheduledDate is stored. */
function utcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

async function loadContext(userId: string) {
  const [preferences, plan] = await Promise.all([
    db.userPreferences.findUnique({ where: { userId } }),
    db.studyPlan.findFirst({
      where: { userId, isActive: true },
      orderBy: { version: "desc" },
      select: { id: true, version: true, generatedAt: true, fitnessScore: true, metadata: true },
    }),
  ]);
  if (!preferences) throw new PlanEditError(400, "Complete onboarding first.");
  if (!plan) throw new PlanEditError(404, "You don't have a study plan yet.");
  return {
    plan,
    metadata: (plan.metadata ?? {}) as Metadata,
    selected: preferences.selectedSubjectCodes ?? [],
    examDate: preferences.targetExamDate.toISOString().slice(0, 10),
    today: bangkokDateStr(),
  };
}
type Context = Awaited<ReturnType<typeof loadContext>>;

/** Sessions go on a day from today up to the day before the exam. */
function checkDate(ctx: Context, date: string): void {
  if (date < ctx.today) throw new PlanEditError(400, "Pick today or a later day.");
  if (date >= ctx.examDate) throw new PlanEditError(400, "Pick a day before your exam.");
}

/** A subtopic of a subject the learner studies. */
async function subtopicInScope(ctx: Context, subtopicId: string): Promise<SubtopicData> {
  const s = await db.subtopic.findUnique({
    where: { id: subtopicId },
    include: {
      prerequisites: { select: { prerequisiteId: true } },
      topic: { include: { category: { include: { subject: { select: { code: true } } } } } },
    },
  });
  if (!s) throw new PlanEditError(404, "Subtopic not found.");
  const subjectCode = s.topic.category.subject.code;
  if (ctx.selected.length && !ctx.selected.includes(subjectCode)) {
    throw new PlanEditError(409, `Add ${subjectCode} to your subjects before planning it.`);
  }
  return {
    id: s.id,
    name: s.name,
    topicId: s.topicId,
    subjectCode,
    estimatedMinutes: s.estimatedMinutes,
    difficultyLevel: s.difficultyLevel,
    prerequisiteIds: s.prerequisites.map((p) => p.prerequisiteId),
  };
}

/** A session of the active plan the learner may change: not completed. */
async function editableSession(ctx: Context, sessionId: string) {
  const session = await db.studySession.findFirst({
    where: { id: sessionId, studyPlanId: ctx.plan.id },
    select: { id: true, subtopicId: true, kind: true, status: true, scheduledDate: true, durationMins: true, order: true },
  });
  if (!session) throw new PlanEditError(404, "Session not found in your plan.");
  if (session.status === "COMPLETED") throw new PlanEditError(409, "A completed session can't be changed.");
  return session;
}

/** The position after the last session of that day. */
async function nextOrder(planId: string, date: string): Promise<number> {
  const last = await db.studySession.aggregate({
    where: { studyPlanId: planId, scheduledDate: utcDate(date) },
    _max: { order: true },
  });
  return (last._max.order ?? -1) + 1;
}

/** Marks the plan as edited and renumbers split subtopics' parts. */
async function afterEdit(userId: string, ctx: Context): Promise<void> {
  await db.studyPlan.update({
    where: { id: ctx.plan.id },
    data: { metadata: { ...ctx.metadata, customizedAt: new Date().toISOString() } as Prisma.InputJsonValue },
  });
  await refreshPartNumbers(userId, ctx.plan.id);
}

/** The clips of `subtopic` not yet in the plan nor completed. */
async function remainingOf(userId: string, subtopic: SubtopicData) {
  const [item] = await loadWorkItems(userId, [subtopic], "append");
  return item;
}

// ─── Edits ──────────────────────────────────────────────────────────────────

/**
 * Adds a session on `scheduledDate`.
 *
 * STUDY covers the next part of the subtopic not yet in the plan: as many of
 * its remaining clips as fit `durationMins` (at least one), or all of them.
 * REVIEW goes back over the subtopic; it covers no clips.
 */
export async function addSession(
  userId: string,
  input: { subtopicId: string; scheduledDate: string; durationMins?: number; kind?: "STUDY" | "REVIEW" }
): Promise<{ sessionId: string }> {
  const ctx = await loadContext(userId);
  checkDate(ctx, input.scheduledDate);
  const subtopic = await subtopicInScope(ctx, input.subtopicId);
  const kind = input.kind ?? "STUDY";

  let resourceIds: string[] = [];
  let durationMins = input.durationMins ?? REVIEW_MINUTES;
  if (kind === "STUDY") {
    const item = await remainingOf(userId, subtopic);
    if (!item) {
      throw new PlanEditError(409, `All of ${subtopic.name} is already in your plan or done. Add it as a review instead.`);
    }
    if (item.clips.length) {
      const clips = pickClips(item.clips, input.durationMins);
      resourceIds = clips.map((c) => c.resourceId);
      durationMins = input.durationMins ?? Math.max(1, Math.round(clips.reduce((a, c) => a + c.minutes, 0)));
    } else {
      durationMins = input.durationMins ?? Math.max(1, Math.round(item.atomicMinutes));
    }
  }

  const order = await nextOrder(ctx.plan.id, input.scheduledDate);
  const session = await db.studySession.create({
    data: {
      studyPlanId: ctx.plan.id,
      subtopicId: subtopic.id,
      scheduledDate: utcDate(input.scheduledDate),
      durationMins,
      order,
      kind,
      ...(resourceIds.length ? { resources: { create: resourceIds.map((resourceId) => ({ resourceId })) } } : {}),
    },
    select: { id: true },
  });
  await afterEdit(userId, ctx);
  return { sessionId: session.id };
}

/**
 * Changes a session: moves it to another day or position, changes its length,
 * or puts another subtopic in its place. A study session given a new subtopic
 * gives its clips back (they show up in the backlog again) and takes as much
 * of the new subtopic's remaining content as fits its length.
 */
export async function updateSession(
  userId: string,
  sessionId: string,
  input: { scheduledDate?: string; order?: number; durationMins?: number; subtopicId?: string }
): Promise<void> {
  const ctx = await loadContext(userId);
  const session = await editableSession(ctx, sessionId);
  const data: Prisma.StudySessionUncheckedUpdateInput = {};

  if (input.scheduledDate !== undefined) {
    checkDate(ctx, input.scheduledDate);
    data.scheduledDate = utcDate(input.scheduledDate);
    if (input.order === undefined) data.order = await nextOrder(ctx.plan.id, input.scheduledDate);
  }
  if (input.order !== undefined) data.order = input.order;
  if (input.durationMins !== undefined) data.durationMins = input.durationMins;

  let newResourceIds: string[] | null = null;
  if (input.subtopicId !== undefined && input.subtopicId !== session.subtopicId) {
    const subtopic = await subtopicInScope(ctx, input.subtopicId);
    data.subtopicId = subtopic.id;
    if (session.kind === "STUDY") {
      const item = await remainingOf(userId, subtopic);
      if (!item) throw new PlanEditError(409, `All of ${subtopic.name} is already in your plan or done.`);
      newResourceIds = pickClips(item.clips, input.durationMins ?? session.durationMins).map((c) => c.resourceId);
    }
  }

  await db.$transaction(async (tx) => {
    if (newResourceIds !== null) {
      await tx.studySessionResource.deleteMany({ where: { sessionId } });
      if (newResourceIds.length) {
        await tx.studySessionResource.createMany({ data: newResourceIds.map((resourceId) => ({ sessionId, resourceId })) });
      }
    }
    await tx.studySession.update({ where: { id: sessionId }, data });
  });
  await afterEdit(userId, ctx);
}

/** Removes a session. Its content goes back to the backlog. */
export async function deleteSession(userId: string, sessionId: string): Promise<void> {
  const ctx = await loadContext(userId);
  await editableSession(ctx, sessionId);
  await db.studySession.delete({ where: { id: sessionId } });
  await afterEdit(userId, ctx);
}

/** Swaps two sessions' days and positions. */
export async function swapSessions(userId: string, aId: string, bId: string): Promise<void> {
  if (aId === bId) throw new PlanEditError(400, "Pick two different sessions.");
  const ctx = await loadContext(userId);
  const [a, b] = await Promise.all([editableSession(ctx, aId), editableSession(ctx, bId)]);
  // A missed session may move forward, but nothing moves onto a past day.
  const aDate = a.scheduledDate.toISOString().slice(0, 10);
  const bDate = b.scheduledDate.toISOString().slice(0, 10);
  if (aDate < ctx.today || bDate < ctx.today) throw new PlanEditError(400, "Move a missed session to a day first; past days can't take sessions.");
  await db.$transaction([
    db.studySession.update({ where: { id: a.id }, data: { scheduledDate: b.scheduledDate, order: b.order } }),
    db.studySession.update({ where: { id: b.id }, data: { scheduledDate: a.scheduledDate, order: a.order } }),
  ]);
  await afterEdit(userId, ctx);
}

/**
 * Puts the GA's original plan back: every session not completed is removed and
 * the original sessions return, less what the learner has completed since
 * (see restorableSessions) and less subjects they no longer study.
 */
export async function resetPlan(userId: string): Promise<{ restored: number }> {
  const ctx = await loadContext(userId);
  const original = ctx.metadata.original as OriginalSessions | undefined;
  if (!Array.isArray(original)) {
    throw new PlanEditError(409, "This plan was made before resetting was possible, so there is no original to go back to.");
  }

  const [completed, subtopics] = await Promise.all([
    db.studySession.findMany({
      where: { studyPlan: { userId }, status: "COMPLETED" },
      select: { subtopicId: true, kind: true, scheduledDate: true, resources: { select: { resourceId: true } } },
    }),
    loadSubtopics(ctx.selected),
  ]);
  const completedClips = new Set<string>();
  const completedWhole = new Set<string>();
  const completedReviews = new Set<string>();
  for (const s of completed) {
    if (s.kind === "REVIEW") completedReviews.add(`${s.subtopicId}|${s.scheduledDate.toISOString().slice(0, 10)}`);
    else if (s.resources.length === 0) completedWhole.add(s.subtopicId);
    else for (const r of s.resources) completedClips.add(r.resourceId);
  }

  const restored: PlannedSession[] = restorableSessions({
    original,
    completedClips,
    completedWhole,
    completedReviews,
    allowed: new Set(subtopics.map((s) => s.id)),
  });

  const rest = { ...ctx.metadata };
  delete rest.customizedAt;
  await db.$transaction(
    async (tx) => {
      await tx.studySession.deleteMany({ where: { studyPlanId: ctx.plan.id, status: { not: "COMPLETED" } } });
      await insertSessions(tx, ctx.plan.id, restored);
      await tx.studyPlan.update({
        where: { id: ctx.plan.id },
        data: { metadata: { ...rest, resetAt: new Date().toISOString() } as Prisma.InputJsonValue },
      });
    },
    { timeout: 30000 }
  );
  await refreshPartNumbers(userId, ctx.plan.id);
  return { restored: restored.length };
}

/** Removes the not-yet-completed sessions of subjects the learner stopped studying. */
export async function dropSubjects(userId: string, subjectCodes: string[]): Promise<number> {
  if (subjectCodes.length === 0) return 0;
  const plan = await db.studyPlan.findFirst({ where: { userId, isActive: true }, select: { id: true, metadata: true } });
  if (!plan) return 0;
  const { count } = await db.studySession.deleteMany({
    where: {
      studyPlanId: plan.id,
      status: { not: "COMPLETED" },
      subtopic: { topic: { category: { subject: { code: { in: subjectCodes } } } } },
    },
  });
  if (count > 0) {
    await db.studyPlan.update({
      where: { id: plan.id },
      data: {
        metadata: { ...((plan.metadata ?? {}) as Metadata), customizedAt: new Date().toISOString() } as Prisma.InputJsonValue,
      },
    });
    await refreshPartNumbers(userId, plan.id);
  }
  return count;
}

// ─── Reading ────────────────────────────────────────────────────────────────

/**
 * What the learner studies that isn't in the plan yet: subtopics of their
 * subjects with content neither planned nor completed. What they pick from
 * when adding a session, and where content goes when a session is removed.
 */
export async function getBacklog(userId: string) {
  const ctx = await loadContext(userId);
  const subtopics = await loadSubtopics(ctx.selected);
  const byId = new Map(subtopics.map((s) => [s.id, s]));
  const items = await loadWorkItems(userId, subtopics, "append");
  return items.map((i) => {
    const s = byId.get(i.subtopicId)!;
    return {
      subtopicId: s.id,
      name: s.name,
      subjectCode: s.subjectCode,
      difficultyLevel: s.difficultyLevel,
      remainingMinutes: Math.round(remainingMinutes(i)),
      /** Some of it is planned or done already; this is the rest. */
      partlyPlanned: i.started,
    };
  });
}

/** The active plan's state: whether it was edited, whether it can be reset, and its conflicts. */
export async function getPlanStatus(userId: string) {
  const ctx = await loadContext(userId);
  const prefs = await db.userPreferences.findUnique({ where: { userId }, select: { targetExamDate: true } });
  const [calendar, open] = await Promise.all([
    loadStudyCalendar(userId, prefs!.targetExamDate),
    db.studySession.findMany({
      where: { studyPlanId: ctx.plan.id, status: { not: "COMPLETED" } },
      select: { scheduledDate: true, durationMins: true },
    }),
  ]);
  return {
    plan: {
      id: ctx.plan.id,
      version: ctx.plan.version,
      generatedAt: ctx.plan.generatedAt,
      fitnessScore: ctx.plan.fitnessScore,
      /** The learner has changed the plan since the GA made it (or since the last reset). */
      customized: typeof ctx.metadata.customizedAt === "string",
      customizedAt: (ctx.metadata.customizedAt as string | undefined) ?? null,
      /** The GA's original is kept, so "reset" works. */
      canReset: Array.isArray(ctx.metadata.original),
    },
    conflicts: findConflicts({
      sessions: open.map((s) => ({ date: s.scheduledDate.toISOString().slice(0, 10), minutes: s.durationMins })),
      days: calendar.days,
      today: ctx.today,
      examDate: ctx.examDate,
    }),
  };
}

// Database-facing half of the scheduler: what is left to schedule, and the
// part numbers on what was scheduled. Server-only.

import { db } from "@/lib/db";
import type { SubtopicData } from "@/types";
import { clipMinutes, type WorkItem } from "./parts";

/**
 * - "regenerate": a fresh plan replaces the active one. Only content the
 *   learner has completed is considered done; everything pending is planned
 *   again.
 * - "append": sessions are added to the active plan. Anything already in it,
 *   pending or not, is done as far as this run is concerned.
 */
export type CoverageMode = "regenerate" | "append";

/**
 * Turns subtopics into work items holding only the clips still to schedule.
 *
 * This is what keeps content from going missing when a subtopic is split. The
 * old rule — "a subtopic with any completed session is finished" — was right
 * when a session was a whole subtopic; with parts it would drop parts 2–5 the
 * moment part 1 was done. Coverage is now per clip.
 *
 * A session with no clip rows covers its whole subtopic: every session from
 * before the split, and every session of a subtopic without videos.
 *
 * Order of `subtopics` is preserved.
 */
export async function loadWorkItems(
  userId: string,
  subtopics: (SubtopicData & { estimatedMinutes: number })[],
  mode: CoverageMode
): Promise<WorkItem[]> {
  const ids = subtopics.map((s) => s.id);

  const [resources, sessions] = await Promise.all([
    db.resource.findMany({
      where: { subtopicId: { in: ids } },
      orderBy: [{ subtopicId: "asc" }, { order: "asc" }],
      select: {
        id: true,
        subtopicId: true,
        durationSec: true,
        lessonId: true,
        lessonRef: { select: { unitId: true } },
      },
    }),
    db.studySession.findMany({
      where: {
        subtopicId: { in: ids },
        studyPlan: { userId },
        OR: [
          { status: "COMPLETED" },
          ...(mode === "append" ? [{ studyPlan: { userId, isActive: true } }] : []),
        ],
      },
      select: { subtopicId: true, resources: { select: { resourceId: true } } },
    }),
  ]);

  const wholeCovered = new Set<string>();
  const coveredClips = new Set<string>();
  for (const s of sessions) {
    if (s.resources.length === 0) wholeCovered.add(s.subtopicId);
    for (const r of s.resources) coveredClips.add(r.resourceId);
  }

  const bySubtopic = new Map<string, typeof resources>();
  for (const r of resources) {
    const list = bySubtopic.get(r.subtopicId) ?? [];
    list.push(r);
    bySubtopic.set(r.subtopicId, list);
  }

  const items: WorkItem[] = [];
  for (const s of subtopics) {
    if (wholeCovered.has(s.id)) continue;
    const all = bySubtopic.get(s.id) ?? [];
    const remaining = all.filter((r) => !coveredClips.has(r.id));
    if (all.length > 0 && remaining.length === 0) continue;

    items.push({
      subtopicId: s.id,
      subjectCode: s.subjectCode,
      difficultyLevel: s.difficultyLevel,
      prerequisiteIds: s.prerequisiteIds,
      clips: remaining.map((r) => ({
        resourceId: r.id,
        unitKey: r.lessonRef?.unitId ?? null,
        lessonKey: r.lessonId,
        minutes: clipMinutes(r.durationSec),
      })),
      atomicMinutes: all.length === 0 ? s.estimatedMinutes : 0,
      started: remaining.length < all.length,
    });
  }
  return items;
}

/**
 * Writes "part N of M" onto the active plan's split sessions.
 *
 * Numbered across everything the learner has for the subtopic — parts
 * completed under an earlier plan included — so a regenerated plan continues
 * at "part 3" rather than restarting at 1. M is only filled in once the parts
 * known so far cover every clip; until the rest is scheduled the label reads
 * "part 3" alone rather than promising a total that isn't true yet.
 *
 * A subtopic that fits in a single session gets no numbers at all.
 */
export async function refreshPartNumbers(userId: string, studyPlanId: string): Promise<void> {
  const active = await db.studySession.findMany({
    where: { studyPlanId, resources: { some: {} } },
    select: { subtopicId: true },
    distinct: ["subtopicId"],
  });
  const subtopicIds = active.map((a) => a.subtopicId);
  if (subtopicIds.length === 0) return;

  const [sessions, clipCounts] = await Promise.all([
    db.studySession.findMany({
      where: {
        subtopicId: { in: subtopicIds },
        studyPlan: { userId },
        resources: { some: {} },
        OR: [{ studyPlanId }, { status: "COMPLETED" }],
      },
      select: {
        id: true,
        studyPlanId: true,
        subtopicId: true,
        resources: { select: { resourceId: true, resource: { select: { order: true } } } },
      },
    }),
    db.resource.groupBy({ by: ["subtopicId"], where: { subtopicId: { in: subtopicIds } }, _count: { _all: true } }),
  ]);
  const totalBySubtopic = new Map(clipCounts.map((c) => [c.subtopicId, c._count._all]));

  const updates: ReturnType<typeof db.studySession.update>[] = [];
  for (const subtopicId of subtopicIds) {
    // A completed session from an old plan and its re-planned twin can't both
    // exist — regeneration only re-plans uncovered clips — but de-duplicate on
    // first clip anyway so a part is never counted twice.
    const parts = sessions
      .filter((s) => s.subtopicId === subtopicId)
      .map((s) => ({ ...s, first: Math.min(...s.resources.map((r) => r.resource.order)) }))
      .sort((a, b) => a.first - b.first);

    const covered = new Set(parts.flatMap((p) => p.resources.map((r) => r.resourceId)));
    const complete = covered.size >= (totalBySubtopic.get(subtopicId) ?? 0);
    const single = complete && parts.length === 1;

    parts.forEach((p, i) => {
      if (p.studyPlanId !== studyPlanId) return;
      updates.push(
        db.studySession.update({
          where: { id: p.id },
          data: {
            partIndex: single ? null : i + 1,
            partCount: single || !complete ? null : parts.length,
          },
        })
      );
    });
  }
  if (updates.length) await db.$transaction(updates);
}

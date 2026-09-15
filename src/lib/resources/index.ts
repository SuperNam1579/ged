// The single seam between the app and learning-resource data.
//
// RULE: nothing outside this directory reaches into the Resource table
// directly. Every consumer — route handlers, server components, scripts — goes
// through the functions below, which is what made replacing the old on-disk
// fixture with real rows a one-file change.
//
// Server-only. These functions read the database, so importing them from a
// client component will fail at build time.

import { db } from "@/lib/db";
import type { Resource, ResourceProgress, ResourceWithProgress } from "./types";

/** Every resource attached to a subtopic, in display order. */
export async function getSubtopicResources(subtopicId: string): Promise<Resource[]> {
  return db.resource.findMany({
    where: { subtopicId },
    orderBy: { order: "asc" },
  });
}

/**
 * A single resource by ID.
 *
 * The progress route depends on this for `durationSec`: completion is decided
 * against a duration the server looked up itself, never one the client sent.
 */
export async function getResource(resourceId: string): Promise<Resource | null> {
  return db.resource.findUnique({ where: { id: resourceId } });
}

/**
 * The clips a study session covers, or null when it covers its whole subtopic
 * (sessions from before subtopics were split, and subtopics without videos).
 */
export async function getSessionResourceIds(sessionId: string): Promise<string[] | null> {
  const rows = await db.studySessionResource.findMany({
    where: { sessionId },
    select: { resourceId: true },
  });
  return rows.length ? rows.map((r) => r.resourceId) : null;
}

/**
 * Resources for a subtopic, each joined with this user's progress and its
 * unit/lesson names. `onlyIds` narrows to one session's part.
 */
export async function getSubtopicResourcesWithProgress(
  userId: string,
  subtopicId: string,
  onlyIds?: string[] | null
): Promise<ResourceWithProgress[]> {
  // One query rather than a fetch-then-join: `progress` is filtered to the
  // caller, so a row can only ever carry that user's own watch history.
  const rows = await db.resource.findMany({
    where: { subtopicId, ...(onlyIds ? { id: { in: onlyIds } } : {}) },
    orderBy: { order: "asc" },
    include: {
      progress: { where: { userId } },
      lessonRef: { select: { id: true, name: true, unit: { select: { id: true, name: true } } } },
    },
  });

  return rows.map(({ progress, lessonRef, ...resource }) => {
    const own = progress[0];

    const mapped: ResourceProgress | null = own
      ? {
          resourceId: own.resourceId,
          watchedSec: own.watchedSec,
          lastPosSec: own.lastPosSec,
          completedAt: own.completedAt?.toISOString() ?? null,
        }
      : null;

    const placement = lessonRef
      ? { lessonId: lessonRef.id, lessonName: lessonRef.name, unitId: lessonRef.unit.id, unitName: lessonRef.unit.name }
      : null;

    return { ...resource, progress: mapped, placement };
  });
}

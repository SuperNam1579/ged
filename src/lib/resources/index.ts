// The single seam between the app and learning-resource data.
//
// RULE: nothing outside this directory may import `fixture.data`. Every consumer
// — route handlers, server components, scripts — goes through the functions
// below. When resources move from the fixture into a `Resource` table, the only
// edits happen inside this file; the signatures are already async and already
// return the shapes the database will return.
//
// Server-only. These functions read the database for progress, so importing
// them from a client component will fail at build time.

import { db } from "@/lib/db";
import { RESOURCES } from "./fixture.data";
import type { Resource, ResourceProgress, ResourceWithProgress } from "./types";

// Indexed once at module load rather than scanned per request. With the real
// table this becomes a `where: { subtopicId }` query and the index goes away.
const BY_SUBTOPIC = new Map<string, Resource[]>();
const BY_ID = new Map<string, Resource>();

for (const r of RESOURCES) {
  BY_ID.set(r.id, r);
  const list = BY_SUBTOPIC.get(r.subtopicId);
  if (list) list.push(r);
  else BY_SUBTOPIC.set(r.subtopicId, [r]);
}

for (const list of BY_SUBTOPIC.values()) {
  list.sort((a, b) => a.order - b.order);
}

/** Every resource attached to a subtopic, in display order. */
export async function getSubtopicResources(subtopicId: string): Promise<Resource[]> {
  return BY_SUBTOPIC.get(subtopicId) ?? [];
}

/**
 * A single resource by ID.
 *
 * The progress route depends on this for `durationSec`: completion is decided
 * against a duration the server looked up itself, never one the client sent.
 */
export async function getResource(resourceId: string): Promise<Resource | null> {
  return BY_ID.get(resourceId) ?? null;
}

/** Resources for a subtopic, each joined with this user's progress. */
export async function getSubtopicResourcesWithProgress(
  userId: string,
  subtopicId: string
): Promise<ResourceWithProgress[]> {
  const resources = await getSubtopicResources(subtopicId);
  if (resources.length === 0) return [];

  const rows = await db.userResourceProgress.findMany({
    where: { userId, resourceId: { in: resources.map((r) => r.id) } },
  });

  const progressById = new Map<string, ResourceProgress>(
    rows.map((row) => [
      row.resourceId,
      {
        resourceId: row.resourceId,
        watchedSec: row.watchedSec,
        lastPosSec: row.lastPosSec,
        completedAt: row.completedAt?.toISOString() ?? null,
      },
    ])
  );

  return resources.map((r) => ({ ...r, progress: progressById.get(r.id) ?? null }));
}

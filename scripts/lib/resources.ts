/**
 * The one place that writes the Resource table.
 *
 * Two scripts produce clips — import-curriculum.ts from the hand-built CSVs,
 * fetch-resources.ts from YouTube search — and both have to land them the same
 * way, because the rows they write have learner watch progress hanging off
 * them. Getting that wrong is not a crash; it is a learner's history quietly
 * attached to the wrong video. So the write rules live here rather than being
 * spelled out twice.
 *
 * Takes a PrismaClient rather than importing one: these run under tsx, which
 * does not resolve the app's "@/" path alias, and each script already owns a
 * client with its own lifecycle.
 */

import type { PrismaClient } from "@prisma/client";

/** A clip as the importers know it, before it has a database identity. */
export interface ResourceInput {
  youtubeId: string;
  title: string;
  channelTitle: string;
  durationSec: number;
  /** Curriculum lesson. Search-sourced clips have no lesson and pass "". */
  lesson: string;
  /** Curriculum unit the lesson sits in. "" for search-sourced clips. */
  unit: string;
}

export interface SaveResult {
  created: number;
  updated: number;
  removed: number;
}

/**
 * Resource IDs are derived from the video, never from its position.
 *
 * Numbering clips by position fails silently: insert one clip in the middle of
 * a subtopic and every later position shifts, so an ID that meant clip A now
 * means clip B. Watch progress does not disappear — it moves onto the wrong
 * video, no error anywhere, and the completion gate starts passing learners on
 * material they never opened.
 */
export function resourceId(subtopicId: string, youtubeId: string): string {
  return `${subtopicId}-${youtubeId}`;
}

/**
 * Brings one subtopic's clips in line with `clips`, writing only what differs.
 *
 * Deliberately not a delete-and-reload: UserResourceProgress points at these
 * rows with a cascading foreign key, so wiping the table on every import would
 * take every learner's watch history with it. Rows are matched by ID and
 * updated in place; only clips the curriculum has genuinely dropped are
 * deleted, and the count comes back so the caller can say so out loud.
 */
/** Map key for a lesson, which is only unique within its unit. */
function lessonKey(unit: string, lesson: string): string {
  return `${unit}\u0000${lesson}`;
}

/**
 * Brings the subtopic's Unit and Lesson rows in line with the clips, and returns
 * the Lesson ID for each (unit, lesson) pair.
 *
 * Upserted on their names rather than rebuilt, so an import that changes nothing
 * leaves the IDs alone. Units and lessons the sheet no longer mentions are
 * deleted; their clips have been re-pointed or removed by then, and nothing
 * else references a lesson (sessions point at Resource on purpose).
 *
 * Order is first appearance in clip order. A subtopic merged from two sheet
 * sections can meet the same unit twice; it stays one Unit row, and the
 * scheduler works from contiguous runs in Resource.order rather than from this
 * table's grouping, so the interleaving can't reorder anyone's lessons.
 */
async function syncStructure(
  db: PrismaClient,
  subtopicId: string,
  clips: ResourceInput[]
): Promise<Map<string, string>> {
  const unitNames: string[] = [];
  const lessonsByUnit = new Map<string, string[]>();
  for (const c of clips) {
    if (!c.unit || !c.lesson) continue;
    if (!lessonsByUnit.has(c.unit)) {
      unitNames.push(c.unit);
      lessonsByUnit.set(c.unit, []);
    }
    const lessons = lessonsByUnit.get(c.unit)!;
    if (!lessons.includes(c.lesson)) lessons.push(c.lesson);
  }

  const lessonIds = new Map<string, string>();
  for (const [unitOrder, unitName] of unitNames.entries()) {
    const unit = await db.unit.upsert({
      where: { subtopicId_name: { subtopicId, name: unitName } },
      create: { subtopicId, name: unitName, order: unitOrder },
      update: { order: unitOrder },
    });
    const names = lessonsByUnit.get(unitName)!;
    for (const [lessonOrder, lessonName] of names.entries()) {
      const lesson = await db.lesson.upsert({
        where: { unitId_name: { unitId: unit.id, name: lessonName } },
        create: { unitId: unit.id, name: lessonName, order: lessonOrder },
        update: { order: lessonOrder },
      });
      lessonIds.set(lessonKey(unitName, lessonName), lesson.id);
    }
    await db.lesson.deleteMany({ where: { unitId: unit.id, name: { notIn: names } } });
  }
  await db.unit.deleteMany({ where: { subtopicId, name: { notIn: unitNames } } });

  return lessonIds;
}

export async function saveSubtopicResources(
  db: PrismaClient,
  subtopicId: string,
  clips: ResourceInput[]
): Promise<SaveResult> {
  const lessonIds = await syncStructure(db, subtopicId, clips);

  const rows = clips.map((c, order) => ({
    id: resourceId(subtopicId, c.youtubeId),
    subtopicId,
    youtubeId: c.youtubeId,
    title: c.title,
    channelTitle: c.channelTitle,
    durationSec: c.durationSec,
    lessonId: lessonIds.get(lessonKey(c.unit, c.lesson)) ?? null,
    order,
  }));

  const existing = await db.resource.findMany({ where: { subtopicId } });
  const existingById = new Map(existing.map((r) => [r.id, r]));
  const keep = new Set(rows.map((r) => r.id));

  const stale = existing.filter((r) => !keep.has(r.id));
  const fresh = rows.filter((r) => !existingById.has(r.id));
  const changed = rows.filter((r) => {
    const e = existingById.get(r.id);
    return (
      e !== undefined &&
      (e.title !== r.title ||
        e.channelTitle !== r.channelTitle ||
        e.durationSec !== r.durationSec ||
        e.lessonId !== r.lessonId ||
        e.order !== r.order)
    );
  });

  // The array form of $transaction, not the callback form: it reaches the
  // database as one batched request, so a 90-clip subtopic does not have to
  // finish inside the interactive-transaction timeout over a pooled connection.
  if (stale.length || fresh.length || changed.length) {
    await db.$transaction([
      ...(stale.length
        ? [db.resource.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } })]
        : []),
      ...(fresh.length ? [db.resource.createMany({ data: fresh })] : []),
      ...changed.map(({ id, ...fields }) => db.resource.update({ where: { id }, data: fields })),
    ]);
  }

  return { created: fresh.length, updated: changed.length, removed: stale.length };
}

// Cutting subtopics into study sessions and laying them onto days.
//
// Pure: no Prisma, no dates beyond the strings it is handed. The routes gather
// the inputs (./work-items.ts) and persist the output (../ga/engine.ts).
//
// ── The two rules this file implements ─────────────────────────────────────
//
// Where a session may be cut (agreed as "ข3"):
//   A subtopic is a run of clips grouped into lessons, and lessons into units.
//   A session holds whole units wherever it can. A unit is only cut into its
//   lessons when it is longer than a whole study day, a lesson into its clips
//   only when *it* is longer than a day, and a clip is never cut. So a unit that
//   fits in a day but not in what is left of today waits for the next day
//   rather than being split to fill the gap.
//
// What goes into a day (agreed as "ก1"):
//   Each day starts with whatever the learner is part-way through — content
//   isn't interrupted by other subjects between its parts. Room left over is
//   filled with the next subtopics in priority order, skipping one that doesn't
//   fit in favour of a later, shorter one, but never skipping ahead of an
//   unfinished prerequisite. A subtopic only starts in leftover room with at
//   least a whole unit: starting a long unit with a 17-minute sliver and then
//   leaving it for a week is worse than starting it fresh on a later day.
//
// Nothing is dropped. What doesn't fit this week comes back as leftovers, for
// the caller to carry into the next week.

/** Minutes of study per minute of video: pausing, rewinding, notes. */
export const STUDY_TIME_FACTOR = 1.3;

/** Float slack for minute arithmetic, so 119.9999 counts as fitting in 120. */
const EPS = 1e-6;

export interface Clip {
  resourceId: string;
  /** Contiguous clips sharing a unit key form a unit. Null = no structure. */
  unitKey: string | null;
  /** Contiguous clips sharing a lesson key form a lesson. Null = no structure. */
  lessonKey: string | null;
  minutes: number;
}

export interface WorkItem {
  subtopicId: string;
  subjectCode: string;
  difficultyLevel: number;
  prerequisiteIds: string[];
  /** Clips still to be scheduled, in curriculum order. Empty for a subtopic with no videos. */
  clips: Clip[];
  /** Length of a subtopic with no videos, which is scheduled as one piece. */
  atomicMinutes: number;
  /**
   * Some of this subtopic is already covered — completed, or scheduled in an
   * earlier week. It continues before anything new starts.
   */
  started: boolean;
}

export interface Day {
  date: string;
  capacity: number;
}

export interface Placement {
  subtopicId: string;
  date: string;
  /** Position within the day, from 0. */
  order: number;
  minutes: number;
  /** The clips this session covers. Empty = the whole (video-less) subtopic. */
  resourceIds: string[];
}

export function clipMinutes(durationSec: number): number {
  return (durationSec / 60) * STUDY_TIME_FACTOR;
}

export function remainingMinutes(item: WorkItem): number {
  return item.clips.length ? item.clips.reduce((n, c) => n + c.minutes, 0) : item.atomicMinutes;
}

// ─── Cutting ────────────────────────────────────────────────────────────────

interface Run {
  size: number; // clips
  minutes: number;
}

/**
 * Contiguous runs of clips sharing a key. Clips with a null key are a run of
 * one each — an unstructured clip is its own smallest unit.
 */
function runs(clips: Clip[], key: (c: Clip) => string | null): Run[] {
  const out: Run[] = [];
  let prev: string | null | undefined;
  for (const c of clips) {
    const k = key(c);
    const last = out[out.length - 1];
    if (last && k !== null && k === prev) {
      last.size++;
      last.minutes += c.minutes;
    } else {
      out.push({ size: 1, minutes: c.minutes });
    }
    prev = k;
  }
  return out;
}

/** How many leading runs fit into `room`, and how many clips that is. */
function fitRuns(list: Run[], room: number): { clips: number; minutes: number } {
  let clips = 0;
  let minutes = 0;
  for (const r of list) {
    if (minutes + r.minutes > room + EPS) break;
    clips += r.size;
    minutes += r.minutes;
  }
  return { clips, minutes };
}

/**
 * How many of an item's leading clips to schedule in `room` minutes, following
 * the cutting rule above. 0 means "not today".
 *
 * `dayCapacity` is the whole day's length: it decides whether something is too
 * big for any single day (and so may be cut finer) or just too big for what is
 * left of this one (and so should wait). `dayIsEmpty` lets a single clip longer
 * than a whole day still be placed, alone, rather than never.
 *
 * `mayCut` false restricts the answer to whole units — for starting a new
 * subtopic in the room another one left over.
 */
export function takeCount(
  clips: Clip[],
  room: number,
  dayCapacity: number,
  dayIsEmpty: boolean,
  mayCut = true
): number {
  if (clips.length === 0 || room <= EPS) return 0;

  const units = runs(clips, (c) => c.unitKey);
  const wholeUnits = fitRuns(units, room);
  if (wholeUnits.clips > 0) return wholeUnits.clips;
  if (units[0].minutes <= dayCapacity + EPS || !mayCut) return 0;

  // The first unit is longer than any day: cut it at lesson boundaries.
  const unitClips = clips.slice(0, units[0].size);
  const lessons = runs(unitClips, (c) => c.lessonKey);
  const wholeLessons = fitRuns(lessons, room);
  if (wholeLessons.clips > 0) return wholeLessons.clips;
  if (lessons[0].minutes <= dayCapacity + EPS) return 0;

  // The first lesson is longer than any day: cut it at clip boundaries.
  const lessonClips = unitClips.slice(0, lessons[0].size);
  const wholeClips = fitRuns(lessonClips.map((c) => ({ size: 1, minutes: c.minutes })), room);
  if (wholeClips.clips > 0) return wholeClips.clips;

  // A single clip longer than the day. Give it a day to itself.
  return dayIsEmpty ? 1 : 0;
}

// ─── Packing ────────────────────────────────────────────────────────────────

export interface PackResult {
  placements: Placement[];
  /** Items with content still unscheduled, in their original priority order. */
  leftovers: WorkItem[];
}

/**
 * Lays `items` (highest priority first) onto `days` (in date order).
 *
 * Items are not mutated; leftovers are fresh copies holding only what remains,
 * with `started` set for anything that got at least one session.
 */
export function packDays(items: WorkItem[], days: Day[]): PackResult {
  const work = items.map((i) => ({ ...i, clips: [...i.clips] }));
  const done = new Set<string>();
  const planned = new Set(work.map((w) => w.subtopicId));
  // Started items, in the order they started: they continue in that order.
  const inProgress = work.filter((w) => w.started);
  const placements: Placement[] = [];

  const isDone = (w: WorkItem) => (w.clips.length === 0 && w.atomicMinutes <= 0) || done.has(w.subtopicId);

  for (const day of days) {
    let room = day.capacity;
    let order = 0;

    const place = (w: WorkItem): boolean => {
      const dayIsEmpty = order === 0;
      if (w.clips.length) {
        // Continuing work may be cut to fit; a new start in leftover room may not.
        const mayCut = w.started || dayIsEmpty;
        const n = takeCount(w.clips, room, day.capacity, dayIsEmpty, mayCut);
        if (n === 0) return false;
        const taken = w.clips.splice(0, n);
        const minutes = taken.reduce((a, c) => a + c.minutes, 0);
        placements.push({
          subtopicId: w.subtopicId,
          date: day.date,
          order: order++,
          minutes,
          resourceIds: taken.map((c) => c.resourceId),
        });
        room -= minutes;
        if (w.clips.length === 0) done.add(w.subtopicId);
      } else {
        // A subtopic with no videos can't be cut. It takes a day to itself
        // rather than never being scheduled if it is longer than any day.
        if (w.atomicMinutes > room + EPS && !(dayIsEmpty && w.atomicMinutes > day.capacity)) return false;
        placements.push({ subtopicId: w.subtopicId, date: day.date, order: order++, minutes: w.atomicMinutes, resourceIds: [] });
        room -= w.atomicMinutes;
        w.atomicMinutes = 0;
        done.add(w.subtopicId);
      }
      if (!w.started) {
        w.started = true;
        if (!done.has(w.subtopicId)) inProgress.push(w);
      }
      return true;
    };

    // 1. Whatever the learner is part-way through comes first.
    for (const w of [...inProgress]) {
      if (isDone(w)) continue;
      place(w);
    }

    // 2. Fill what is left with new subtopics, in priority order.
    for (const w of work) {
      if (room <= EPS) break;
      if (w.started || isDone(w)) continue;
      // Starting a subtopic before one of its prerequisites is finished would
      // invert the order the curriculum teaches them in. Prerequisites outside
      // this batch are the caller's concern.
      const blocked = w.prerequisiteIds.some((p) => planned.has(p) && p !== w.subtopicId && !done.has(p));
      if (blocked) continue;
      place(w);
    }
  }

  const leftovers = work.filter((w) => !isDone(w));
  return { placements, leftovers };
}

// Cutting subtopics into study sessions and laying them onto days.
//
// Pure: no Prisma, no dates beyond the strings it is handed. The routes gather
// the inputs (./work-items.ts) and persist the output (../ga/engine.ts).
//
// ── The two rules this file implements ─────────────────────────────────────
//
// Fixed parts (replaces "ข3" for subtopics with videos):
//   Each subtopic is cut into fixed parts once, from its content alone (see
//   splitIntoParts): up to MAX_PART_MINUTES is one part; longer is cut at unit,
//   then lesson, then clip boundaries into even parts under that. A session is
//   one whole part, and a subtopic gets at most one session a day. A part that
//   doesn't fit what is left of today waits for a later day. Only a part longer
//   than the learner's whole day is cut further, by the rule below.
//
// Where a session may be cut (agreed as "ข3"; clips without fixed parts):
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
//   leaving it for a week is worse than starting it fresh on a later day. And
//   unless all of it fits, that opening must be at least MIN_OPENING_MINUTES;
//   less room than that is left free — the learner ends the day early.
//
// Nothing is dropped. What doesn't fit this week comes back as leftovers, for
// the caller to carry into the next week.

// Relative, not "@/": this file is also loaded by scripts under tsx, which
// doesn't resolve the app's path alias. types.ts has no imports of its own.
import { READING_TIME_FACTOR } from "../resources/types";

/** Minutes of study per minute of video: pausing, rewinding, notes. */
export const STUDY_TIME_FACTOR = 1.3;

/**
 * The least a new subtopic may start with in the room left at the end of a
 * day, unless all of it fits there. Below this the room is left free.
 */
export const MIN_OPENING_MINUTES = 30;

/** The longest a part of a subtopic may be. A subtopic up to this long is one part. */
export const MAX_PART_MINUTES = 120;

/** Float slack for minute arithmetic, so 119.9999 counts as fitting in 120. */
const EPS = 1e-6;

export interface Clip {
  resourceId: string;
  /** Contiguous clips sharing a unit key form a unit. Null = no structure. */
  unitKey: string | null;
  /** Contiguous clips sharing a lesson key form a lesson. Null = no structure. */
  lessonKey: string | null;
  minutes: number;
  /**
   * The fixed part of its subtopic this clip belongs to (see splitIntoParts),
   * as "n/total". Absent = the subtopic isn't cut into fixed parts.
   */
  part?: string;
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
  /** Minutes to plan into the day: its free time, or a share of it (./pace.ts). */
  capacity: number;
  /**
   * The learner's whole free time that day, when `capacity` is only a share of
   * it. A fixed part is cut only when it is longer than this, and an empty day
   * takes a whole part that fits this even when it goes past `capacity`.
   */
  free?: number;
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

/** Study minutes for one item: a video's runtime or an article's reading time, plus slack. */
export function clipMinutes(durationSec: number, kind: "VIDEO" | "ARTICLE" = "VIDEO"): number {
  return (durationSec / 60) * (kind === "ARTICLE" ? READING_TIME_FACTOR : STUDY_TIME_FACTOR);
}

export function remainingMinutes(item: WorkItem): number {
  return item.clips.length ? item.clips.reduce((n, c) => n + c.minutes, 0) : item.atomicMinutes;
}

// ─── Parts ──────────────────────────────────────────────────────────────────

/**
 * Cuts a subtopic's clips into its fixed parts. Same content, same parts — for
 * every learner, whatever their timetable:
 *
 *   - a subtopic up to `cap` minutes is one part;
 *   - a longer one is cut into as few parts as fit under `cap`, as even in
 *     length as the cuts allow (no 2 h + 2 h + 15 min);
 *   - cuts fall between units; a unit longer than `cap` is cut between its
 *     lessons, and a lesson longer than `cap` between its clips. A clip is
 *     never cut, so a clip longer than `cap` is a part on its own.
 *
 * Returns the clips with `part` set. Pass the subtopic's *whole* clip list, so
 * the parts don't move as the learner gets through it.
 */
export function splitIntoParts(clips: Clip[], cap = MAX_PART_MINUTES): Clip[] {
  // The pieces a cut may fall between: units, or lessons / clips of a unit too long for a part.
  const pieces: Run[] = [];
  let at = 0;
  for (const unit of runs(clips, (c) => c.unitKey)) {
    const unitClips = clips.slice(at, at + unit.size);
    at += unit.size;
    if (unit.minutes <= cap + EPS) {
      pieces.push(unit);
      continue;
    }
    let lessonAt = 0;
    for (const lesson of runs(unitClips, (c) => c.lessonKey)) {
      const lessonClips = unitClips.slice(lessonAt, lessonAt + lesson.size);
      lessonAt += lesson.size;
      if (lesson.minutes <= cap + EPS) pieces.push(lesson);
      else for (const c of lessonClips) pieces.push({ size: 1, minutes: c.minutes });
    }
  }

  // Fewest parts, then the most even: dp[i] is the best way to cut the first i pieces.
  const n = pieces.length;
  const dp: { parts: number; squares: number; from: number }[] = [{ parts: 0, squares: 0, from: -1 }];
  for (let i = 1; i <= n; i++) {
    let best = { parts: Infinity, squares: Infinity, from: i - 1 };
    let minutes = 0;
    for (let j = i - 1; j >= 0; j--) {
      minutes += pieces[j].minutes;
      // A single piece over the cap (one long clip) is still a part.
      if (minutes > cap + EPS && j < i - 1) break;
      const parts = dp[j].parts + 1;
      const squares = dp[j].squares + minutes * minutes;
      if (parts < best.parts || (parts === best.parts && squares < best.squares - EPS)) best = { parts, squares, from: j };
    }
    dp.push(best);
  }

  // Walk back to the cuts, then label the clips.
  const sizes: number[] = [];
  for (let i = n; i > 0; i = dp[i].from) {
    sizes.unshift(pieces.slice(dp[i].from, i).reduce((a, p) => a + p.size, 0));
  }
  const out: Clip[] = [];
  sizes.forEach((size, k) => {
    for (const c of clips.slice(out.length, out.length + size)) out.push({ ...c, part: `${k + 1}/${sizes.length}` });
  });
  return out;
}

/** Part number and part count of a clip from splitIntoParts. */
export function partOf(clip: Clip): { index: number; total: number } | null {
  if (!clip.part) return null;
  const [index, total] = clip.part.split("/").map(Number);
  return { index, total };
}

/** The leading clips that make up the next part (all of them for a subtopic without parts). */
export function nextPart(clips: Clip[]): Clip[] {
  if (clips.length === 0 || !clips[0].part) return clips;
  return clips.slice(0, runs(clips, (c) => c.part ?? null)[0].size);
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

  // A subtopic in fixed parts: a session is its next part, whole. Only a part
  // longer than the learner's whole day is cut further, by the rule below.
  if (clips[0].part) {
    const part = nextPart(clips);
    const minutes = part.reduce((a, c) => a + c.minutes, 0);
    if (minutes <= room + EPS) return part.length;
    // A day with nothing in it yet takes a whole part that fits in it, even
    // past a paced day's target (`dayCapacity` is then the real free time).
    if (dayIsEmpty && minutes <= dayCapacity + EPS) return part.length;
    if (minutes <= dayCapacity + EPS || !mayCut) return 0;
    return takeCount(part.map((c) => ({ ...c, part: undefined })), room, dayCapacity, dayIsEmpty, mayCut);
  }

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
  let inProgress = work.filter((w) => w.started);
  // Items not started yet, in priority order.
  let fresh = work.filter((w) => !w.started);
  const placements: Placement[] = [];

  const isDone = (w: WorkItem) => (w.clips.length === 0 && w.atomicMinutes <= 0) || done.has(w.subtopicId);

  // The least room a not-yet-started item needs to begin in a day that already
  // has something in it: its first whole unit (it may not be cut there), or
  // all of a video-less subtopic. Its clips are untouched until it starts, so
  // this is worked out once — the fill loop below asks on every day, and over
  // a plan that runs to the exam that is most of the packer's time.
  const startNeeds = new Map<WorkItem, number>();
  const startNeed = (w: WorkItem): number => {
    let need = startNeeds.get(w);
    if (need === undefined) {
      need = !w.clips.length
        ? w.atomicMinutes
        : w.clips[0].part
          ? nextPart(w.clips).reduce((a, c) => a + c.minutes, 0)
          : runs(w.clips, (c) => c.unitKey)[0].minutes;
      startNeeds.set(w, need);
    }
    return need;
  };

  for (const day of days) {
    let room = day.capacity;
    let order = 0;

    const place = (w: WorkItem): boolean => {
      const dayIsEmpty = order === 0;
      if (w.clips.length) {
        // Continuing work may be cut to fit; a new start in leftover room may not.
        const mayCut = w.started || dayIsEmpty;
        // Fixed parts are measured against the learner's real free time, not the paced share.
        const whole = w.clips[0].part ? (day.free ?? day.capacity) : day.capacity;
        const n = takeCount(w.clips, room, whole, dayIsEmpty, mayCut);
        if (n === 0) return false;
        // A new subtopic squeezed into the end of a day: all of it, or a real
        // session's worth. A 10-minute opening whose rest waits for another day
        // is worse than ending the day early.
        if (!w.started && !dayIsEmpty && n < w.clips.length) {
          const opening = w.clips.slice(0, n).reduce((a, c) => a + c.minutes, 0);
          if (opening < MIN_OPENING_MINUTES - EPS) return false;
        }
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
    for (const w of fresh) {
      if (room <= EPS) break;
      if (w.started || isDone(w)) continue;
      // Same answer place() would give, without cutting the clips into runs.
      if (order > 0 && startNeed(w) > room + EPS) continue;
      // Starting a subtopic before one of its prerequisites is finished would
      // invert the order the curriculum teaches them in. Prerequisites outside
      // this batch are the caller's concern.
      const blocked = w.prerequisiteIds.some((p) => planned.has(p) && p !== w.subtopicId && !done.has(p));
      if (blocked) continue;
      place(w);
    }

    // Drop what is finished or has moved on, so later days don't walk past it.
    // Order is kept, so this changes nothing but the time a long plan takes.
    inProgress = inProgress.filter((w) => !isDone(w));
    fresh = fresh.filter((w) => !w.started && !isDone(w));
  }

  const leftovers = work.filter((w) => !isDone(w));
  return { placements, leftovers };
}

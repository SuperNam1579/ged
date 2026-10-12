// Rules for editing a plan by hand. Pure: no Prisma; ./manual.ts applies them.
//
// The GA plans once, when the plan is made. From then on the learner owns the
// timetable: they add, remove, move and swap sessions, and change their free
// time, and nothing re-plans behind their back. These are the pieces of that
// with rules worth testing on their own:
//
//   - which clips a session added by hand covers (pickClips)
//   - which of the GA's original sessions come back on "reset" (restorableSessions)
//   - where the timetable and the learner's free time disagree (findConflicts)

import type { PlannedSession } from "../ga/engine";
import type { CalendarDay } from "./calendar";
import type { Clip } from "./parts";

/**
 * The clips a session of `durationMins` covers: the leading ones whose total
 * fits, and always at least one — a clip is never cut, so a clip longer than
 * the session still goes in whole. No duration = everything left.
 */
export function pickClips(clips: Clip[], durationMins?: number): Clip[] {
  if (durationMins === undefined) return clips;
  const picked: Clip[] = [];
  let total = 0;
  for (const c of clips) {
    if (picked.length > 0 && total + c.minutes > durationMins + 1e-6) break;
    picked.push(c);
    total += c.minutes;
  }
  return picked;
}

/**
 * The GA's original sessions to put back when the learner resets the plan.
 *
 * What the learner has completed since stays done, so it is not brought back:
 *   - a session's clips already completed are dropped from it, and a session
 *     left with none is dropped;
 *   - a video-less study session goes when its subtopic was completed whole;
 *   - a review goes when the same subtopic was reviewed that day.
 * Sessions of subjects the learner no longer studies are left out, and so is
 * content the curriculum has dropped since the plan was made (a re-import can
 * remove or replace subtopics and clips): `allowed` holds only subtopics that
 * still exist, and `existingClips` only clips that do.
 */
export function restorableSessions(input: {
  original: PlannedSession[];
  completedClips: Set<string>;
  /** Subtopics completed by a session with no clips (a video-less subtopic). */
  completedWhole: Set<string>;
  /** Completed reviews, as `${subtopicId}|${date}`. */
  completedReviews: Set<string>;
  /** Subtopics of the subjects the learner studies now. */
  allowed: Set<string>;
  /** Clips that still exist. Left out: all are assumed to. */
  existingClips?: Set<string>;
}): PlannedSession[] {
  const { original, completedClips, completedWhole, completedReviews, allowed, existingClips } = input;
  const restored: PlannedSession[] = [];
  for (const s of original) {
    if (!allowed.has(s.subtopicId)) continue;
    if ((s.kind ?? "STUDY") === "REVIEW") {
      if (!completedReviews.has(`${s.subtopicId}|${s.scheduledDate}`)) restored.push(s);
      continue;
    }
    if (s.resourceIds.length === 0) {
      if (!completedWhole.has(s.subtopicId)) restored.push(s);
      continue;
    }
    const left = s.resourceIds.filter((id) => !completedClips.has(id) && (!existingClips || existingClips.has(id)));
    if (left.length > 0) restored.push({ ...s, resourceIds: left });
  }
  return restored;
}

export type ConflictReason = "no-time" | "over-time" | "after-exam";

export interface Conflict {
  date: string;
  reason: ConflictReason;
  plannedMinutes: number;
  availableMinutes: number;
}

/**
 * Days from today on where the timetable and the learner's free time disagree:
 * study planned on a day with no free time, more planned than the day holds,
 * or anything on or after the exam. Only flagged — the learner decides what to
 * move, because nothing re-plans.
 */
export function findConflicts(input: {
  /** Sessions not yet completed. */
  sessions: { date: string; minutes: number }[];
  /** The study calendar, today to the day before the exam. */
  days: CalendarDay[];
  today: string;
  examDate: string;
}): Conflict[] {
  const { sessions, days, today, examDate } = input;
  const capacity = new Map(days.map((d) => [d.date, d.capacity]));

  const planned = new Map<string, number>();
  for (const s of sessions) {
    if (s.date < today) continue; // missed: past, not a conflict with free time
    planned.set(s.date, (planned.get(s.date) ?? 0) + s.minutes);
  }

  const conflicts: Conflict[] = [];
  for (const [date, minutes] of [...planned].sort(([a], [b]) => a.localeCompare(b))) {
    const available = capacity.get(date) ?? 0;
    const reason: ConflictReason | null =
      date >= examDate ? "after-exam" : available === 0 ? "no-time" : minutes > available ? "over-time" : null;
    if (reason) conflicts.push({ date, reason, plannedMinutes: minutes, availableMinutes: available });
  }
  return conflicts;
}

/** One part of a split subtopic, as the order check sees it. */
export interface PartPlacement {
  id: string;
  /** Curriculum position of the part's first clip — what makes it part 1, 2, 3… */
  firstClip: number;
  date: string;
  /** Position within its day. */
  order: number;
}

/**
 * The first pair of a subtopic's parts placed out of order, or null.
 *
 * Parts are learned in sequence: part 2 builds on part 1. A hand edit may move
 * a part anywhere, but never to before an earlier part — later in the same
 * day is fine, an earlier day or slot is not.
 */
export function partOrderViolation(parts: PartPlacement[]): { earlier: PartPlacement; later: PartPlacement } | null {
  const byClip = [...parts].sort((a, b) => a.firstClip - b.firstClip);
  for (let i = 1; i < byClip.length; i++) {
    const earlier = byClip[i - 1];
    const later = byClip[i];
    if (later.date < earlier.date || (later.date === earlier.date && later.order < earlier.order)) {
      return { earlier, later };
    }
  }
  return null;
}

// Review days before the exam. Pure: no Prisma.
//
// A few of the last study days before the exam are kept for review
// (finalReviewDayCount): everyone should go back over what they learnt before
// an exam. Other spare time is not filled with reviews — the content is spread
// over the run (./pace.ts), and what time remains is the learner's to review
// or study more as they choose.
//
// What to review: the subtopics already studied, weakest first — the lowest
// proficiency, which includes a failed quiz. When nothing is weak, the same
// order still works: the hardest subtopics, studied longest ago, come first,
// which is what is most likely to be forgotten. Each subtopic is reviewed once
// before any is reviewed twice.
//
// At most two reviews a day (an hour), however long the day; the day before
// the exam is kept light: a single review.

import type { ProficiencyMap, SubtopicData } from "../../types";
import type { Day } from "./parts";

/** Length of one review session. */
export const REVIEW_MINUTES = 30;

/**
 * At most this many reviews a day, whatever the free time. A learner with
 * long days and a distant exam finishes the content early; filling every
 * remaining hour with reviews made thousands of them (2,958 in one dev plan).
 * An hour of review a day keeps what was learnt without crowding the calendar.
 */
export const MAX_REVIEWS_PER_DAY = 2;

/** At most this many of the last study days are kept for review. */
const MAX_FINAL_REVIEW_DAYS = 3;

/**
 * How many of the last study days to keep for review: about one in ten, at
 * least one and at most three — none when there is under a week of study days,
 * which needs every day for content.
 */
export function finalReviewDayCount(studyDays: number): number {
  if (studyDays < 7) return 0;
  return Math.min(MAX_FINAL_REVIEW_DAYS, Math.max(1, Math.round(studyDays * 0.1)));
}

export interface PlannedReview {
  subtopicId: string;
  date: string;
  minutes: number;
}

export function planReviews(input: {
  /** Review days in date order, the last being the day before the exam. */
  days: Day[];
  /** Every study session the learner has or will have: when each subtopic is studied. */
  studied: { subtopicId: string; date: string }[];
  subtopics: SubtopicData[];
  proficiencies: ProficiencyMap;
  /** The day before the exam, which gets one review only. */
  lastDay: string;
}): PlannedReview[] {
  const { days, studied, subtopics, proficiencies, lastDay } = input;
  const byId = new Map(subtopics.map((s) => [s.id, s]));

  // Last day each subtopic is studied: it can be reviewed from the day after.
  const lastStudied = new Map<string, string>();
  for (const s of studied) {
    if (!byId.has(s.subtopicId)) continue;
    const prev = lastStudied.get(s.subtopicId);
    if (!prev || s.date > prev) lastStudied.set(s.subtopicId, s.date);
  }

  const timesReviewed = new Map<string, number>();
  const reviews: PlannedReview[] = [];

  for (const day of days) {
    if (day.capacity <= 0) continue;
    const slots =
      day.date === lastDay ? 1 : Math.min(MAX_REVIEWS_PER_DAY, Math.max(1, Math.floor(day.capacity / REVIEW_MINUTES)));
    const minutes = Math.min(REVIEW_MINUTES, day.capacity);

    const ready = [...lastStudied]
      .filter(([, date]) => date < day.date)
      .map(([id, date]) => ({ s: byId.get(id)!, date }))
      .sort(
        (a, b) =>
          (timesReviewed.get(a.s.id) ?? 0) - (timesReviewed.get(b.s.id) ?? 0) ||
          (proficiencies[a.s.id] ?? 0) - (proficiencies[b.s.id] ?? 0) ||
          b.s.difficultyLevel - a.s.difficultyLevel ||
          a.date.localeCompare(b.date)
      );

    for (const { s } of ready.slice(0, slots)) {
      reviews.push({ subtopicId: s.id, date: day.date, minutes });
      timesReviewed.set(s.id, (timesReviewed.get(s.id) ?? 0) + 1);
    }
  }
  return reviews;
}

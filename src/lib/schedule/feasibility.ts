// Before the GA runs: does the content fit the time to the exam? Pure: no Prisma.
//
// The GA plans once, so the inputs had better make sense first. This checks
// the learner's free time from today to the exam against the content of the
// subjects they chose, and answers in one of these:
//
//   exam-passed   the exam date is today or past
//   no-time       no free time at all before the exam
//   not-enough    the content doesn't fit — the GA would leave some of it out
//   tight         it fits with under 10% to spare: one missed day can't be caught up
//   comfortable   it fits with room for missed days
//   light         under half the time is needed; the rest goes to review
//
// The GA may run for the last three. For the first three the learner is told
// what to change: more minutes a week, a later exam date, or fewer subjects.
//
// Content data may be incomplete — a subject imported without its videos yet,
// or chosen before any of its subtopics exist. The check still answers, and
// says how sure it is: a subtopic without clips counts at its estimated length
// ("estimate"), and a subject with no subtopics at all can't be counted
// ("missing"). When the content arrives later, the next check simply counts
// it; nothing is stored that would go stale.
//
// "Fits" is tested the way the plan will actually be made: the content is laid
// out with packDays(), in the recommended order, onto the days left once the
// final review days are kept aside. A plain minutes-in vs minutes-out sum would
// say yes too often, because a day's leftover minutes can be too short for the
// next unit and go unused.

import type { ProficiencyMap, SubtopicData } from "../../types";
import { recommendOrder } from "../ga/ordering";
import { addDaysStr, type CalendarDay } from "./calendar";
import { packDays, remainingMinutes, type Day, type WorkItem } from "./parts";
import { finalReviewDayCount } from "./review";

export type FeasibilityStatus = "exam-passed" | "no-time" | "not-enough" | "tight" | "comfortable" | "light";

/** Content needing more than this share of the content days' time leaves no slack. */
const TIGHT_LOAD = 0.9;
/** Content needing less than this share leaves most of the time for review. */
const LIGHT_LOAD = 0.5;
/** An average study day longer than this (minutes) is hard to keep up for weeks. */
const LONG_DAY_MINUTES = 360;

export interface FeasibilityWarning {
  code: "long-days" | "no-review-days" | "estimated-time" | "no-content";
  message: string;
  /** The subjects it is about, for estimated-time and no-content. */
  subjects?: string[];
}

/**
 * Where a subject's time comes from:
 *   clips     every subtopic has its videos/articles, so the time is measured
 *   estimate  no subtopic has clips yet; the time is each subtopic's estimate
 *   mixed     some measured, some estimated
 *   missing   chosen, but no subtopics exist yet — not counted at all
 */
export type TimeSource = "clips" | "estimate" | "mixed" | "missing";

export interface Feasibility {
  status: FeasibilityStatus;
  /** Whether the GA may plan with these inputs. */
  canPlan: boolean;
  from: string;
  examDate: string;
  daysUntilExam: number;
  studyDays: number;
  /** Study days kept for review at the end; their time isn't counted for content. */
  reviewDays: number;
  /** All free time to the exam. */
  availableMinutes: number;
  /** Free time on the days content can go on. */
  contentMinutes: number;
  /** Study time the chosen subjects need. */
  requiredMinutes: number;
  /** Content that doesn't fit; 0 when it all does. */
  shortfallMinutes: number;
  /** requiredMinutes / contentMinutes, two decimals. Above 1 can't fit. */
  load: number;
  /** Average free minutes on a study day. */
  averageDayMinutes: number;
  subjects: {
    subjectCode: string;
    requiredMinutes: number;
    /** Subtopics with content left to study. */
    subtopics: number;
    /** Of those, how many are counted at their estimated length (no clips yet). */
    estimatedSubtopics: number;
    source: TimeSource;
  }[];
  warnings: FeasibilityWarning[];
  /** What would make it fit; only for not-enough. Each one on its own is enough. */
  suggestions: {
    /** Add about this much free time a week. */
    extraMinutesPerWeek?: number;
    /** Or move the exam about this many days later… */
    extraDays?: number;
    /** …to this date. */
    suggestedExamDate?: string;
    /** Or drop any one of these subjects. */
    dropOneOf?: string[];
  };
}

/** The order the plan would use without the GA: started work first, then recommended. */
function greedyOrder(items: WorkItem[], subtopics: SubtopicData[], proficiencies: ProficiencyMap): WorkItem[] {
  const byId = new Map(subtopics.map((s) => [s.id, s]));
  const itemById = new Map(items.map((i) => [i.subtopicId, i]));
  const fresh = recommendOrder({
    subtopics: items.filter((i) => !i.started).map((i) => byId.get(i.subtopicId)).filter((s): s is SubtopicData => !!s),
    proficiencies,
  }).map((s) => itemById.get(s.id)!);
  return [...items.filter((i) => i.started), ...fresh];
}

/** Minutes of content packDays() can't place on `days`. */
function shortfallOn(items: WorkItem[], days: Day[], subtopics: SubtopicData[], proficiencies: ProficiencyMap): number {
  if (items.length === 0) return 0;
  const { leftovers } = packDays(greedyOrder(items, subtopics, proficiencies), days);
  return leftovers.reduce((a, i) => a + remainingMinutes(i), 0);
}

const roundUpTo = (n: number, step: number) => Math.ceil(n / step) * step;

export function assessFeasibility(input: {
  /** Every day from today to the day before the exam, study day or not. */
  calendarDays: CalendarDay[];
  from: string;
  examDate: string;
  /** What is left to study in the chosen subjects. */
  items: WorkItem[];
  /** Every subtopic of the chosen subjects. */
  subtopics: SubtopicData[];
  proficiencies: ProficiencyMap;
  /** The subjects chosen — to name any with no subtopics yet. */
  subjectCodes?: string[];
}): Feasibility {
  const { calendarDays, from, examDate, items, subtopics, proficiencies, subjectCodes = [] } = input;

  const studyDays = calendarDays.filter((d) => d.capacity > 0);
  const reviewDays = finalReviewDayCount(studyDays.length);
  const reserved = new Set(studyDays.slice(studyDays.length - reviewDays).map((d) => d.date));
  const contentDays: Day[] = studyDays.filter((d) => !reserved.has(d.date)).map((d) => ({ date: d.date, capacity: d.capacity }));

  const availableMinutes = studyDays.reduce((a, d) => a + d.capacity, 0);
  const contentMinutes = contentDays.reduce((a, d) => a + d.capacity, 0);
  const requiredMinutes = items.reduce((a, i) => a + remainingMinutes(i), 0);
  const averageDayMinutes = studyDays.length ? availableMinutes / studyDays.length : 0;

  const subjectOf = new Map(subtopics.map((s) => [s.id, s.subjectCode]));
  const bySubject = new Map<string, { requiredMinutes: number; subtopics: number; estimatedSubtopics: number }>();
  for (const i of items) {
    const code = subjectOf.get(i.subtopicId) ?? i.subjectCode;
    const entry = bySubject.get(code) ?? { requiredMinutes: 0, subtopics: 0, estimatedSubtopics: 0 };
    entry.requiredMinutes += remainingMinutes(i);
    entry.subtopics++;
    if (i.clips.length === 0) entry.estimatedSubtopics++;
    bySubject.set(code, entry);
  }
  const sourceOf = (e: { subtopics: number; estimatedSubtopics: number }): TimeSource =>
    e.estimatedSubtopics === 0 ? "clips" : e.estimatedSubtopics === e.subtopics ? "estimate" : "mixed";
  const subjectsWithSubtopics = new Set(subtopics.map((s) => s.subjectCode));
  const missing = subjectCodes.filter((c) => !subjectsWithSubtopics.has(c));

  const shortfall = from >= examDate || contentDays.length === 0 ? requiredMinutes : shortfallOn(items, contentDays, subtopics, proficiencies);
  const load = contentMinutes > 0 ? requiredMinutes / contentMinutes : Infinity;

  const status: FeasibilityStatus =
    from >= examDate
      ? "exam-passed"
      : studyDays.length === 0
        ? "no-time"
        : shortfall > 0.5
          ? "not-enough"
          : load > TIGHT_LOAD
            ? "tight"
            : load < LIGHT_LOAD
              ? "light"
              : "comfortable";

  const warnings: FeasibilityWarning[] = [];
  if (averageDayMinutes > LONG_DAY_MINUTES) {
    warnings.push({
      code: "long-days",
      message: `Study days average ${Math.round(averageDayMinutes / 60 * 10) / 10} hours. That is hard to keep up for weeks; spreading the time over more days helps.`,
    });
  }
  const estimated = [...bySubject].filter(([, e]) => e.estimatedSubtopics > 0).map(([code]) => code);
  if (estimated.length) {
    warnings.push({
      code: "estimated-time",
      message: `${estimated.join(", ")}: some lessons have no videos yet, so their time is estimated. The check updates once they are added.`,
      subjects: estimated,
    });
  }
  if (missing.length) {
    warnings.push({
      code: "no-content",
      message: `${missing.join(", ")}: no lessons yet, so not counted. Once they are added they show up to be planned.`,
      subjects: missing,
    });
  }
  if (studyDays.length > 0 && reviewDays === 0) {
    warnings.push({
      code: "no-review-days",
      message: "Under 7 study days before the exam: every day goes to new content, with none left for review.",
    });
  }

  const suggestions: Feasibility["suggestions"] = {};
  if (status === "not-enough") {
    const weeks = Math.max(1, contentDays.length ? Math.ceil(calendarDays.length / 7) : 1);
    // Packing never fills days completely, so ask for a little more than the bare shortfall.
    suggestions.extraMinutesPerWeek = roundUpTo((shortfall / weeks) * 1.15, 15);

    const perCalendarDay = calendarDays.length ? availableMinutes / calendarDays.length : 0;
    if (perCalendarDay > 0) {
      suggestions.extraDays = Math.ceil((shortfall * 1.15) / perCalendarDay);
      suggestions.suggestedExamDate = addDaysStr(examDate, suggestions.extraDays);
    }

    // A subject whose removal lets the rest fit, checked by packing again without it.
    const drop = [...bySubject.keys()].filter(
      (code) =>
        bySubject.size > 1 &&
        shortfallOn(
          items.filter((i) => (subjectOf.get(i.subtopicId) ?? i.subjectCode) !== code),
          contentDays,
          subtopics,
          proficiencies
        ) <= 0.5
    );
    if (drop.length) suggestions.dropOneOf = drop;
  }

  return {
    status,
    canPlan: status === "tight" || status === "comfortable" || status === "light",
    from,
    examDate,
    daysUntilExam: calendarDays.length,
    studyDays: studyDays.length,
    reviewDays,
    availableMinutes: Math.round(availableMinutes),
    contentMinutes: Math.round(contentMinutes),
    requiredMinutes: Math.round(requiredMinutes),
    shortfallMinutes: Math.round(shortfall),
    load: Number.isFinite(load) ? Math.round(load * 100) / 100 : 0,
    averageDayMinutes: Math.round(averageDayMinutes),
    subjects: [
      ...[...bySubject].map(([subjectCode, v]) => ({
        subjectCode,
        requiredMinutes: Math.round(v.requiredMinutes),
        subtopics: v.subtopics,
        estimatedSubtopics: v.estimatedSubtopics,
        source: sourceOf(v),
      })),
      ...missing.map((subjectCode) => ({
        subjectCode,
        requiredMinutes: 0,
        subtopics: 0,
        estimatedSubtopics: 0,
        source: "missing" as const,
      })),
    ],
    warnings,
    suggestions,
  };
}

// Makes the learner's study plan: one GA run, once. Server-only.
//
// The GA plans every day from today to the day before the exam onto the study
// calendar (./calendar.ts): content first, then review days (./review.ts) - the
// last few study days, and any left once the content is done. That happens
// once, when the learner has no plan. Afterwards the learner edits the plan by
// hand (./manual.ts) and nothing re-plans; the GA's sessions are kept in the
// plan's metadata as `original`, so the learner can always go back to them.

import { db } from "@/lib/db";
import { DEFAULT_CONFIG } from "@/lib/ga/constants";
import { planDays, savePlan, type PlannedSession } from "@/lib/ga/engine";
import type { FitnessBreakdown, SubtopicData, TriggerReason } from "@/types";
import { addDaysStr, buildStudyCalendar, bangkokDateStr, mondayOf, type StudyCalendar } from "./calendar";
import { remainingMinutes } from "./parts";
import { finalReviewDayCount, planReviews } from "./review";
import { loadWorkItems } from "./work-items";

const NO_FITNESS: FitnessBreakdown = {
  coverage: 0,
  weaknessFocus: 0,
  timeFeasibility: 0,
  prerequisiteOrder: 0,
  variety: 0,
  balance: 0,
  total: 0,
};

/** Loads the learner's study calendar from today to their exam. */
export async function loadStudyCalendar(userId: string, examDate: Date): Promise<StudyCalendar> {
  const from = bangkokDateStr();
  const exam = examDate.toISOString().slice(0, 10);

  const [template, weeks] = await Promise.all([
    db.weeklyAvailabilityTemplate.findUnique({
      where: { userId },
      include: { slots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] } },
    }),
    db.weeklyAvailability.findMany({
      where: {
        userId,
        weekStartDate: { gte: new Date(`${mondayOf(from)}T00:00:00Z`), lt: new Date(`${exam}T00:00:00Z`) },
      },
      include: { slots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] } },
    }),
  ]);

  const toSlot = (s: { dayOfWeek: number; startTime: string; endTime: string }) => ({
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
  });

  return buildStudyCalendar({
    from,
    examDate: exam,
    template: (template?.slots ?? []).map(toSlot),
    weekOverrides: new Map(weeks.map((w) => [w.weekStartDate.toISOString().slice(0, 10), w.slots.map(toSlot)])),
  });
}

/**
 * The curriculum the learner studies: the subjects chosen in onboarding, or
 * every subject for legacy accounts with no selection saved.
 */
export async function loadSubtopics(selectedSubjectCodes: string[]): Promise<SubtopicData[]> {
  const subtopics = await db.subtopic.findMany({
    include: {
      prerequisites: { select: { prerequisiteId: true } },
      topic: {
        include: { category: { include: { subject: { select: { code: true } } } } },
      },
    },
  });
  const all = subtopics.map((s) => ({
    id: s.id,
    name: s.name,
    topicId: s.topicId,
    subjectCode: s.topic.category.subject.code,
    estimatedMinutes: s.estimatedMinutes,
    difficultyLevel: s.difficultyLevel,
    prerequisiteIds: s.prerequisites.map((p) => p.prerequisiteId),
  }));
  const selected = selectedSubjectCodes.length ? new Set(selectedSubjectCodes) : null;
  return selected ? all.filter((s) => selected.has(s.subjectCode)) : all;
}

/**
 * How long the GA may evolve. A plan to the exam is one run — about 2 s for 50
 * days and up to ~15–18 s for 200 days at 3 h a day, on a 120-subtopic
 * curriculum (measured 2026-10-04, early stopping on) — and the routes calling
 * this allow 60 s for everything, saving included. Past the budget the best
 * order found so far is used.
 */
const GA_TIME_BUDGET_MS = 25_000;

export type CreatePlanResult =
  | { status: "no-preferences" }
  /** The learner has a plan already: edit it, or reset it to the GA's original. */
  | { status: "exists"; studyPlanId: string }
  /** Everything has been completed. */
  | { status: "all-done" }
  /** No study time between today and the exam. */
  | { status: "no-study-days"; calendar: StudyCalendar }
  | {
      status: "planned";
      studyPlanId: string;
      fitnessScore: number;
      /** New-content sessions. */
      sessionCount: number;
      reviewSessionCount: number;
      reviewDays: number;
      /** All content is done: the plan is review only, with no GA run behind it. */
      reviewOnly: boolean;
      calendar: StudyCalendar;
      /** Fitness of the same plan without the GA, and the seed that reproduces it (null when review only). */
      baselineFitness: number | null;
      seed: number | null;
      /** Subtopics (or parts of them) that don't fit before the exam. */
      unscheduledSubtopics: number;
      unscheduledMinutes: number;
    };

/** The GA's sessions as first planned, kept in StudyPlan.metadata.original for "reset". */
export type OriginalSessions = PlannedSession[];

/** Makes the learner's plan with the GA — only when they have none. */
export async function createInitialPlan(userId: string, triggerReason: TriggerReason): Promise<CreatePlanResult> {
  const preferences = await db.userPreferences.findUnique({ where: { userId } });
  if (!preferences) return { status: "no-preferences" };

  const existing = await db.studyPlan.findFirst({ where: { userId, isActive: true }, select: { id: true } });
  if (existing) return { status: "exists", studyPlanId: existing.id };

  const [calendar, subtopics, proficiencies] = await Promise.all([
    loadStudyCalendar(userId, preferences.targetExamDate),
    loadSubtopics(preferences.selectedSubjectCodes ?? []),
    db.userSubtopicProficiency.findMany({ where: { userId }, select: { subtopicId: true, score: true } }),
  ]);
  const profMap = Object.fromEntries(proficiencies.map((p) => [p.subtopicId, p.score]));

  // What is left to learn, per clip: everything not completed under an earlier plan.
  const pending = await loadWorkItems(userId, subtopics, "regenerate");

  const days = calendar.days.filter((d) => d.capacity > 0);
  if (days.length === 0) return pending.length ? { status: "no-study-days", calendar } : { status: "all-done" };

  // The last few study days are kept for review; content is planned onto the rest.
  const reserved = new Set(days.slice(days.length - finalReviewDayCount(days.length)).map((d) => d.date));
  const plan = pending.length
    ? planDays({
        items: pending,
        subtopics,
        proficiencies: profMap,
        days: days.map((d) => ({ date: d.date, capacity: reserved.has(d.date) ? 0 : d.capacity })),
        timeBudgetMs: GA_TIME_BUDGET_MS,
      })
    : null;
  const studySessions = plan?.sessions ?? [];

  // Review: the kept days, and every day left once the content is done.
  const lastStudy = studySessions.reduce<string | null>((a, s) => (a && a > s.scheduledDate ? a : s.scheduledDate), null);
  const reviewDays = days.filter((d) => reserved.has(d.date) || !lastStudy || d.date > lastStudy);
  const earlier = await db.studySession.findMany({
    where: { studyPlan: { userId }, kind: "STUDY", status: "COMPLETED" },
    select: { subtopicId: true, scheduledDate: true },
  });
  const reviews = planReviews({
    days: reviewDays,
    studied: [
      ...earlier.map((s) => ({ subtopicId: s.subtopicId, date: s.scheduledDate.toISOString().slice(0, 10) })),
      ...studySessions.map((s) => ({ subtopicId: s.subtopicId, date: s.scheduledDate })),
    ],
    subtopics,
    proficiencies: profMap,
    lastDay: addDaysStr(calendar.examDate, -1),
  });
  const reviewSessions: PlannedSession[] = reviews.map((r, i) => ({
    subtopicId: r.subtopicId,
    durationMins: r.minutes,
    scheduledDate: r.date,
    order: studySessions.length + i,
    resourceIds: [],
    kind: "REVIEW",
  }));

  const sessions = [...studySessions, ...reviewSessions];
  if (sessions.length === 0) return pending.length ? { status: "no-study-days", calendar } : { status: "all-done" };

  // With all content done there is no GA run: a plan of reviews only.
  const fitness = plan?.fitness ?? NO_FITNESS;
  const original: OriginalSessions = sessions;
  const saved = await savePlan({
    userId,
    sessions,
    fitness,
    logs: plan?.logs ?? [],
    cfg: plan?.cfg ?? DEFAULT_CONFIG,
    triggerReason,
    extraMetadata: {
      ...(plan ? { seed: plan.seed, baselineFitness: plan.baseline.total, baselineBreakdown: plan.baseline } : {}),
      reviewDays: reviewDays.map((d) => d.date),
      original,
    },
  });

  return {
    status: "planned",
    studyPlanId: saved.studyPlanId,
    fitnessScore: fitness.total,
    sessionCount: studySessions.length,
    reviewSessionCount: reviewSessions.length,
    reviewDays: reviewDays.length,
    reviewOnly: !plan,
    calendar,
    baselineFitness: plan?.baseline.total ?? null,
    seed: plan?.seed ?? null,
    unscheduledSubtopics: plan?.leftovers.length ?? 0,
    unscheduledMinutes: Math.round((plan?.leftovers ?? []).reduce((a, i) => a + remainingMinutes(i), 0)),
  };
}

/** What the routes send back about a new plan. */
export function planSummary(result: Extract<CreatePlanResult, { status: "planned" }>) {
  const { calendar } = result;
  return {
    studyPlanId: result.studyPlanId,
    fitnessScore: result.fitnessScore,
    /** The same plan's fitness without the GA (recommendOrder alone). */
    baselineFitness: result.baselineFitness,
    seed: result.seed,
    /** Kept for callers written against the weekly planner. */
    bestFitness: result.fitnessScore,
    sessions: result.sessionCount,
    /** Review sessions: the last days before the exam, and any days left after the content. */
    reviewSessions: result.reviewSessionCount,
    reviewDays: result.reviewDays,
    reviewOnly: result.reviewOnly,
    from: calendar.from,
    examDate: calendar.examDate,
    studyDays: calendar.days.filter((d) => d.capacity > 0).length,
    totalStudyMinutes: calendar.totalMinutes,
    /** False when some content doesn't fit before the exam — the learner needs more time. */
    fitsBeforeExam: result.unscheduledSubtopics === 0,
    unscheduledSubtopics: result.unscheduledSubtopics,
    unscheduledMinutes: result.unscheduledMinutes,
  };
}

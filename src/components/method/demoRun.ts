import { planDays, type PlannedSession } from "@/lib/ga/plan";
import { recommendOrder } from "@/lib/ga/ordering";
import { computeFitness } from "@/lib/ga/fitness";
import { DEFAULT_CONFIG } from "@/lib/ga/constants";
import { packDays, remainingMinutes, splitIntoParts, type Day, type WorkItem } from "@/lib/schedule/parts";
import { LANDING_SUBJECTS } from "@/components/landing/subjects";
import type { FitnessBreakdown, ProficiencyMap, SubtopicData } from "@/types";
import { DAYS, type GoalKey, type Session, type Week } from "./methodData";

/**
 * One run of the real planner, in the browser, for the public demos.
 *
 * It calls planDays() — the function that makes every learner's plan: the GA
 * evolves an order of topics, and the packer lays that order onto the days'
 * free time, cutting long topics at unit and lesson breaks. What differs from a
 * learner's run is only the input, since a public page has no learner:
 *   - an example learner: Math, Language Arts and Science, one week of free
 *     time, made-up placement-test scores;
 *   - the topics are the real curriculum, but a topic's clips are its count of
 *     videos and articles at their average length (the landing data doesn't
 *     carry each clip's length);
 *   - within a topic group, each topic is taken to build on the one before it.
 * Every score is computed by computeFitness(); none is written by hand.
 */

export const POP = DEFAULT_CONFIG.populationSize;
export const GENS = DEFAULT_CONFIG.generations;

/** Minutes free each day, Mon–Sun. Wednesday and Saturday are busy. */
const FREE: Record<(typeof DAYS)[number], number> = { Mon: 120, Tue: 120, Wed: 0, Thu: 120, Fri: 90, Sat: 0, Sun: 180 };
/** A fixed Monday, so the week reads Mon–Sun whatever today is. */
const WEEK_START = "2026-01-05";
const SUBJECTS = ["MATH", "RLA", "SCI"];
/** How weak the example learner is in each subject (0–100). */
const SUBJECT_SCORE: Record<string, number> = { MATH: 32, RLA: 68, SCI: 50 };

export type GoalScores = Record<GoalKey, number>;
export interface DemoFrame {
  generation: number;
  best: number;
  average: number;
  worst: number;
  goals: GoalScores;
  week: Week;
}
export interface DemoPlan {
  score: number;
  goals: GoalScores;
  week: Week;
}
export interface DemoRun {
  frames: DemoFrame[];
  /** Generations actually run: the GA stops early once its best stops improving. */
  generationsRun: number;
  /** "Weakest first, basics before": the planner's simple rule, packed the same way, with no evolution. */
  baseline: DemoPlan;
  result: DemoPlan;
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const DATES = DAYS.map((_, i) => addDays(WEEK_START, i));
const DAYS_IN: Day[] = DAYS.map((label, i) => ({ date: DATES[i], capacity: FREE[label] }));

function buildInputs() {
  const subtopics: SubtopicData[] = [];
  const items: WorkItem[] = [];
  const names = new Map<string, string>();
  const proficiencies: ProficiencyMap = {};
  let n = 0;
  for (const subject of LANDING_SUBJECTS.filter((s) => SUBJECTS.includes(s.code))) {
    for (const category of subject.categories)
      for (const topic of category.topics)
        topic.subtopics.forEach((st, i) => {
          const id = `${subject.code}-${n++}`;
          const prev = i > 0 ? `${subject.code}-${n - 2}` : null;
          const count = Math.max(1, Math.min(10, (st.videos ?? 0) + (st.articles ?? 0)));
          const clips = splitIntoParts(Array.from({ length: count }, (_, c) => ({
            resourceId: `${id}-c${c}`,
            unitKey: `${id}-u${Math.floor(c / 4)}`,
            lessonKey: `${id}-l${Math.floor(c / 2)}`,
            minutes: st.minutes / count,
          })));
          const difficultyLevel = st.level ?? 2;
          names.set(id, st.name);
          subtopics.push({ id, name: st.name, topicId: `${subject.code}:${topic.name}`, subjectCode: subject.code, estimatedMinutes: st.minutes, difficultyLevel, prerequisiteIds: prev ? [prev] : [] });
          items.push({ subtopicId: id, subjectCode: subject.code, difficultyLevel, prerequisiteIds: prev ? [prev] : [], clips, atomicMinutes: st.minutes, started: false });
          proficiencies[id] = Math.max(5, Math.min(95, (SUBJECT_SCORE[subject.code] ?? 50) + ((n * 37) % 41) - 20));
        });
  }
  return { subtopics, items, names, proficiencies };
}

const INPUTS = buildInputs();

/** Sessions → the week, a topic cut into parts labelled in order. */
function toWeek(sessions: { subtopicId: string; scheduledDate: string }[]): Week {
  const week: Week = {};
  const seen = new Map<string, number>();
  const total = new Map<string, number>();
  for (const s of sessions) total.set(s.subtopicId, (total.get(s.subtopicId) ?? 0) + 1);
  for (const s of sessions) {
    const day = DAYS[DATES.indexOf(s.scheduledDate)];
    if (!day) continue;
    const k = (seen.get(s.subtopicId) ?? 0) + 1;
    seen.set(s.subtopicId, k);
    const name = INPUTS.names.get(s.subtopicId) ?? s.subtopicId;
    const subject = s.subtopicId.split("-")[0] as Session["subject"];
    (week[day] ??= []).push({ subject, lesson: (total.get(s.subtopicId) ?? 1) > 1 ? `${name} · Part ${k}` : name });
  }
  return week;
}

const goalsOf = (b: FitnessBreakdown): GoalScores => ({
  coverage: b.coverage,
  weaknessFocus: b.weaknessFocus,
  timeFeasibility: b.timeFeasibility,
  prerequisiteOrder: b.prerequisiteOrder,
  variety: b.variety,
  balance: b.balance,
});
const pct = (v: number) => Math.round(v * 100);

/** The simple rule planDays() measures the GA against, laid out as sessions. */
function baselinePlan(): DemoPlan {
  const { items, subtopics, proficiencies } = INPUTS;
  const capacity = DAYS_IN.reduce((a, d) => a + d.capacity, 0);
  const byId = new Map(subtopics.map((s) => [s.id, s]));
  const ordered = recommendOrder({ subtopics, proficiencies }).map((s) => items.find((i) => i.subtopicId === s.id)!);
  const candidates: WorkItem[] = [];
  let minutes = 0;
  for (const it of ordered) {
    if (minutes >= capacity * 1.5 && candidates.length > 0) break;
    candidates.push(it);
    minutes += remainingMinutes(it);
  }
  const days = DAYS_IN.filter((d) => d.capacity > 0);
  const sessions = packDays(candidates, days).placements.map((p, i) => ({
    subtopicId: p.subtopicId, durationMins: Math.max(1, Math.round(p.minutes)), scheduledDate: p.date, order: i,
  }));
  const gaSubtopics = candidates.map((c) => ({ ...byId.get(c.subtopicId)!, estimatedMinutes: Math.max(1, Math.round(remainingMinutes(c))) }));
  const fitness = computeFitness(sessions, {
    subtopics: gaSubtopics, proficiencies, slots: [], availableDates: days.map((d) => d.date),
    dayCapacity: new Map(days.map((d) => [d.date, d.capacity])), subjectCodes: [...new Set(gaSubtopics.map((s) => s.subjectCode))],
  });
  return { score: pct(fitness.total), goals: goalsOf(fitness), week: toWeek(sessions) };
}

/** Runs the planner once. A seed makes it repeatable (the comparison); none gives a fresh run (the Run button). */
export function runDemo(seed?: number, sampleEvery = 5): DemoRun {
  const { items, subtopics, proficiencies } = INPUTS;
  const weeks: Week[] = [];
  const plan = planDays({
    items, subtopics, proficiencies, days: DAYS_IN,
    seed: seed ?? Math.floor(Math.random() * 2 ** 31),
    onGeneration: (_gen, sessions: PlannedSession[]) => weeks.push(toWeek(sessions)),
  });
  if (!plan) throw new Error("demo inputs produced no plan");

  const frames: DemoFrame[] = [];
  plan.logs.forEach((log, i) => {
    if (i % sampleEvery !== 0 && i !== plan.logs.length - 1) return;
    frames.push({
      generation: log.generation + 1,
      best: pct(log.bestFitness),
      average: pct(log.avgFitness),
      worst: pct(log.worstFitness),
      goals: goalsOf(log.breakdown),
      week: weeks[i],
    });
  });
  return {
    frames,
    generationsRun: plan.logs.length,
    baseline: baselinePlan(),
    result: { score: pct(plan.fitness.total), goals: goalsOf(plan.fitness), week: toWeek(plan.sessions) },
  };
}

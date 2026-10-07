import type {
  AvailabilitySlotInput,
  Chromosome,
  FitnessBreakdown,
  GAConfig,
  Individual,
  ProficiencyMap,
  SubtopicData,
  TriggerReason,
} from "@/types";
import { computeFitness } from "./fitness";
import { tournamentSelect, orderCrossover, mutate, selectElites } from "./operators";
import { initPopulation, buildAvailableDates, slotMinutesForDate } from "./population";
import { recommendOrder } from "./ordering";
import { DEFAULT_CONFIG } from "./constants";
import { newSeed, random, withSeed } from "./random";
import { packDays, remainingMinutes, type Day, type WorkItem } from "@/lib/schedule/parts";
import { refreshPartNumbers } from "@/lib/schedule/work-items";
import { db } from "@/lib/db";

export interface GenerationLog {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  worstFitness: number;
  breakdown: FitnessBreakdown;
}

/** A session as planned, before it has a database row. */
export interface PlannedSession {
  subtopicId: string;
  durationMins: number;
  scheduledDate: string;
  order: number;
  /** Clips the session covers; empty = the whole subtopic. */
  resourceIds: string[];
  /** STUDY when left out. REVIEW sessions come from lib/schedule/review.ts, not the GA. */
  kind?: "STUDY" | "REVIEW";
}

// ─── Evolution (pure) ──────────────────────────────────────────────────────

/**
 * Runs the genetic algorithm over whole subtopics and returns the best
 * individual. No database access.
 *
 * `score` replaces the default fitness. planWeek() passes one that first turns
 * the chromosome into the real sessions it would produce, so the GA is judged
 * on the schedule the learner gets rather than on its own rough draft.
 *
 * `deadline` (a Date.now() value) stops evolution early and returns the best
 * found so far. The GA runs synchronously, so a timer can't interrupt it.
 */
export function evolve(
  subtopics: SubtopicData[],
  proficiencies: ProficiencyMap,
  slots: AvailabilitySlotInput[],
  availableDates: string[],
  config: Partial<GAConfig> = {},
  score?: (chromosome: Chromosome) => FitnessBreakdown,
  deadline?: number
): { best: Individual; logs: GenerationLog[]; cfg: GAConfig } {
  const cfg: GAConfig = { ...DEFAULT_CONFIG, ...config };
  const fitnessCtx = {
    subtopics,
    proficiencies,
    slots,
    availableDates,
    subjectCodes: [...new Set(subtopics.map((s) => s.subjectCode))],
  };
  const fitnessOf = score ?? ((c: Chromosome) => computeFitness(c, fitnessCtx));

  let population: Individual[] = initPopulation(
    cfg.populationSize,
    subtopics,
    proficiencies,
    availableDates,
    slots
  ).map((chromosome) => {
    const breakdown = fitnessOf(chromosome);
    return { chromosome, fitness: breakdown.total, fitnessBreakdown: breakdown };
  });

  const logs: GenerationLog[] = [];
  // Early stopping: the best score hasn't improved by more than
  // convergenceEpsilon for convergencePatience generations in a row.
  let bestSoFar = -Infinity;
  let stagnant = 0;

  for (let gen = 0; gen < cfg.generations; gen++) {
    const fitnesses = population.map((i) => i.fitness);
    const best = Math.max(...fitnesses);
    const worst = Math.min(...fitnesses);
    const avg = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
    const bestIndividual = population.find((i) => i.fitness === best)!;

    logs.push({ generation: gen, bestFitness: best, avgFitness: avg, worstFitness: worst, breakdown: bestIndividual.fitnessBreakdown });

    if (best >= 0.98) break;
    if (deadline !== undefined && Date.now() > deadline) break;
    if (best - bestSoFar > cfg.convergenceEpsilon) {
      bestSoFar = best;
      stagnant = 0;
    } else if (++stagnant >= cfg.convergencePatience) {
      break;
    }

    const newPopulation: Individual[] = [...selectElites(population, cfg.elitismCount)];
    while (newPopulation.length < cfg.populationSize) {
      const parent1 = tournamentSelect(population, cfg.tournamentSize);
      const parent2 = tournamentSelect(population, cfg.tournamentSize);
      let [child1, child2] =
        random() < cfg.crossoverRate ? orderCrossover(parent1, parent2) : [parent1.slice(), parent2.slice()];
      child1 = mutate(child1, cfg.mutationRate, availableDates, subtopics);
      child2 = mutate(child2, cfg.mutationRate, availableDates, subtopics);
      for (const child of [child1, child2]) {
        if (newPopulation.length >= cfg.populationSize) break;
        const breakdown = fitnessOf(child);
        newPopulation.push({ chromosome: child, fitness: breakdown.total, fitnessBreakdown: breakdown });
      }
    }
    population = newPopulation;
  }

  return { best: selectElites(population, 1)[0], logs, cfg };
}

// ─── A run of days: choose, prioritise, cut, lay out ───────────────────────

export interface WeekPlan {
  sessions: PlannedSession[];
  /** Work that didn't fit in the days given, highest priority first. */
  leftovers: WorkItem[];
  fitness: FitnessBreakdown;
  logs: GenerationLog[];
  cfg: GAConfig;
  /** Seed of the GA's random choices: the same inputs and seed give the same plan. */
  seed: number;
  /**
   * Fitness of the plan without the GA — the candidates packed in the order
   * recommendOrder() gives them. What the GA is measured against.
   */
  baseline: FitnessBreakdown;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Plans sessions from `items` (anything already started first, then in the
 * order given) onto `days` — every study day from today to the exam, in one
 * run, or any shorter stretch.
 *
 * The GA's job has narrowed. It used to decide the days and durations of whole
 * subtopics, which is what put a 7-hour Fractions onto a 2-hour evening: it
 * could only move a subtopic as one block, and time feasibility was a small
 * weight it happily traded away. Now it decides priority — which subtopics
 * matter most and in what order, balancing weakness, prerequisites and
 * variety — and packDays() turns that order into sessions that respect each
 * day's real length and cut only at unit or lesson boundaries.
 *
 * Each day carries its own capacity, so weeks the learner changed and weeks
 * that follow their usual pattern can sit side by side in one plan.
 *
 * The fitness stored with the plan is recomputed on those final sessions, so
 * the score shown to the learner describes the schedule they actually get.
 */
export function planDays(input: {
  items: WorkItem[];
  subtopics: SubtopicData[];
  proficiencies: ProficiencyMap;
  /** Study days in date order. Days with no capacity are ignored. */
  days: Day[];
  config?: Partial<GAConfig>;
  /** Stop evolving after this long and keep the best order found so far. */
  timeBudgetMs?: number;
  /** Seed for the GA's random choices; a fresh one when left out. */
  seed?: number;
}): WeekPlan | null {
  const { items, subtopics, proficiencies, config, timeBudgetMs } = input;
  const seed = input.seed ?? newSeed();
  const deadline = timeBudgetMs === undefined ? undefined : Date.now() + timeBudgetMs;
  const days = input.days.filter((d) => d.capacity > 0);
  if (days.length === 0 || items.length === 0) return null;

  const availableDates = days.map((d) => d.date);
  const dayCapacity = new Map(days.map((d) => [d.date, d.capacity]));
  const capacity = days.reduce((a, d) => a + d.capacity, 0);

  // Candidates: in-progress work, then the rest by recommended order, until
  // there is half as much again as the days can hold. The margin gives the
  // packer shorter subtopics to fill gaps with; what isn't placed is returned
  // as leftovers.
  const byId = new Map(subtopics.map((s) => [s.id, s]));
  const itemById = new Map(items.map((i) => [i.subtopicId, i]));
  const started = items.filter((i) => i.started);
  const fresh = recommendOrder({
    subtopics: items.filter((i) => !i.started).map((i) => byId.get(i.subtopicId)!).filter(Boolean),
    proficiencies,
  }).map((s) => itemById.get(s.id)!);

  const candidates: WorkItem[] = [];
  let minutes = 0;
  for (const it of [...started, ...fresh]) {
    if (minutes >= capacity * 1.5 && candidates.length > 0) break;
    candidates.push(it);
    minutes += remainingMinutes(it);
  }
  const notCandidates = [...started, ...fresh].filter((i) => !candidates.includes(i));

  // The GA sees each candidate at the size of what remains of it.
  const gaSubtopics = candidates.map((c) => ({
    ...byId.get(c.subtopicId)!,
    estimatedMinutes: Math.max(1, Math.round(remainingMinutes(c))),
  }));
  const fitnessCtx = {
    subtopics: gaSubtopics,
    proficiencies,
    slots: [],
    availableDates,
    dayCapacity,
    subjectCodes: [...new Set(gaSubtopics.map((s) => s.subjectCode))],
  };

  // A chromosome is read as a priority order — its gene sequence — and scored
  // on the sessions that order actually produces. Scoring the GA's own dates
  // instead let a random draft decide priority: a learner's one weak topic
  // could land last, because weakness focus doesn't care which day a block is
  // on. Packed, the order decides how soon the weak topic is studied, and the
  // score follows. In-progress work always leads, whatever the order.
  const itemByIdLocal = new Map(candidates.map((c) => [c.subtopicId, c]));
  const layout = (chromosome: Chromosome) => {
    const order = chromosome.map((g) => itemByIdLocal.get(g.subtopicId)).filter((i): i is WorkItem => !!i);
    const prioritised = [...order.filter((c) => c.started), ...order.filter((c) => !c.started)];
    const packed = packDays(prioritised, days);
    const sessions: PlannedSession[] = packed.placements.map((p, i) => ({
      subtopicId: p.subtopicId,
      durationMins: Math.max(1, Math.round(p.minutes)),
      scheduledDate: p.date,
      order: i,
      resourceIds: p.resourceIds,
    }));
    return { packed, sessions };
  };
  const toChromosome = (sessions: PlannedSession[]): Chromosome =>
    sessions.map((s) => ({ subtopicId: s.subtopicId, durationMins: s.durationMins, scheduledDate: s.scheduledDate, order: s.order }));

  // The slots evolve() takes only seed the initial population's draft dates,
  // which layout() discards — the order of the genes is all that is kept.
  const { best, logs, cfg } = withSeed(seed, () =>
    evolve(
      gaSubtopics,
      proficiencies,
      [],
      availableDates,
      config,
      (c) => computeFitness(toChromosome(layout(c).sessions), fitnessCtx),
      deadline
    )
  );

  const { packed, sessions } = layout(best.chromosome);
  const fitness = computeFitness(toChromosome(sessions), fitnessCtx);

  // The same candidates in recommendOrder()'s order, packed the same way.
  const greedy = candidates.map((c, i) => ({ subtopicId: c.subtopicId, durationMins: 0, scheduledDate: "", order: i }));
  const baseline = computeFitness(toChromosome(layout(greedy).sessions), fitnessCtx);

  return { sessions, leftovers: [...packed.leftovers, ...notCandidates], fitness, logs, cfg, seed, baseline };
}

/** planDays() over one week of a weekly slot pattern, skipping days already past. */
export function planWeek(input: {
  items: WorkItem[];
  subtopics: SubtopicData[];
  proficiencies: ProficiencyMap;
  slots: AvailabilitySlotInput[];
  weekStartDate: Date;
  config?: Partial<GAConfig>;
}): WeekPlan | null {
  const { slots, weekStartDate, ...rest } = input;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Never schedule on days that have already passed.
  const start = weekStartDate < today ? today : weekStartDate;
  const end = new Date(weekStartDate.getTime() + 7 * DAY_MS);
  const days = buildAvailableDates(slots, start, end).map((date) => ({ date, capacity: slotMinutesForDate(slots, date) }));

  return planDays({ ...rest, days });
}

// ─── Persistence ────────────────────────────────────────────────────────────

function sessionData(s: PlannedSession) {
  return {
    subtopicId: s.subtopicId,
    scheduledDate: new Date(s.scheduledDate),
    durationMins: s.durationMins,
    order: s.order,
    status: "PENDING" as const,
    kind: s.kind ?? "STUDY",
    ...(s.resourceIds.length
      ? { resources: { create: s.resourceIds.map((resourceId) => ({ resourceId })) } }
      : {}),
  };
}

/**
 * Saves planned sessions: either as a new active plan (replacing the previous
 * one) or appended to the active plan. Then numbers the parts.
 */
export async function savePlan(input: {
  userId: string;
  sessions: PlannedSession[];
  fitness: FitnessBreakdown;
  logs: GenerationLog[];
  cfg: GAConfig;
  triggerReason: TriggerReason;
  weeklyAvailabilityId?: string;
  append: boolean;
  /**
   * Sessions of the replaced plan dated before this stay as they are, done or
   * not: this week's locked timetable, and days the learner missed. The new
   * sessions start on or after it. Left out, only completed sessions stay.
   */
  keepBefore?: Date;
  /** Saved with the plan alongside its config and fitness — the seed and baseline. */
  extraMetadata?: Record<string, unknown>;
}): Promise<{ studyPlanId: string }> {
  const { userId, sessions, fitness, logs, cfg, triggerReason, weeklyAvailabilityId, append, keepBefore, extraMetadata } =
    input;

  if (append) {
    const activePlan = await db.studyPlan.findFirst({
      where: { userId, isActive: true },
      orderBy: { version: "desc" },
    });
    if (activePlan) {
      // Offset orders so appended sessions sort after the existing ones.
      const last = await db.studySession.aggregate({ where: { studyPlanId: activePlan.id }, _max: { order: true } });
      const base = (last._max.order ?? -1) + 1;
      await db.$transaction(
        sessions.map((s) =>
          db.studySession.create({ data: { ...sessionData({ ...s, order: base + s.order }), studyPlanId: activePlan.id } })
        )
      );
      await refreshPartNumbers(userId, activePlan.id);
      return { studyPlanId: activePlan.id };
    }
    // No active plan to append to: fall through and create one.
  }

  const previous = await db.studyPlan.findFirst({
    where: { userId, isActive: true },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const studyPlan = await db.$transaction(
    async (tx) => {
      const replaced = await tx.studyPlan.findMany({ where: { userId, isActive: true }, select: { id: true } });
      await tx.studyPlan.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false, weeklyAvailabilityId: null },
      });
      const plan = await tx.studyPlan.create({
        data: {
          userId,
          version: (previous?.version ?? 0) + 1,
          fitnessScore: fitness.total,
          triggerReason,
          isActive: true,
          metadata: JSON.parse(JSON.stringify({ config: cfg, fitnessBreakdown: fitness, ...extraMetadata })),
          ...(weeklyAvailabilityId ? { weeklyAvailabilityId } : {}),
        },
      });

      // In bulk: a plan that runs to the exam is hundreds of sessions, and a
      // nested create writes them one statement each — about 50ms apiece
      // through the pooler, enough to outlast the transaction.
      const created = await tx.studySession.createManyAndReturn({
        data: sessions.map((s) => ({
          studyPlanId: plan.id,
          subtopicId: s.subtopicId,
          scheduledDate: new Date(s.scheduledDate),
          durationMins: s.durationMins,
          order: s.order,
          status: "PENDING" as const,
          kind: s.kind ?? "STUDY",
        })),
        select: { id: true, order: true },
      });
      const idByOrder = new Map(created.map((c) => [c.order, c.id]));
      const links = sessions.flatMap((s) =>
        s.resourceIds.map((resourceId) => ({ sessionId: idByOrder.get(s.order)!, resourceId }))
      );
      if (links.length) await tx.studySessionResource.createMany({ data: links });

      // What stays on the learner's calendar moves into the new plan, which
      // only re-plans what is left: everything completed, and with keepBefore
      // everything dated before it. Orders go negative so kept sessions come
      // first within their day. Moved, not copied — a copy would count a
      // finished part twice.
      const kept = {
        studyPlanId: { in: replaced.map((p) => p.id) },
        OR: [{ status: "COMPLETED" as const }, ...(keepBefore ? [{ scheduledDate: { lt: keepBefore } }] : [])],
      };
      const keptOrders = await tx.studySession.aggregate({ where: kept, _max: { order: true } });
      if (keptOrders._max.order !== null) {
        await tx.studySession.updateMany({
          where: kept,
          data: { studyPlanId: plan.id, order: { decrement: keptOrders._max.order + 1 } },
        });
      }

      return plan;
    },
    { timeout: 30000 }
  );

  // GA logs stay outside the transaction — append-only research data.
  await db.gaExecutionLog.createMany({
    data: logs.map((log) => ({
      studyPlanId: studyPlan.id,
      generation: log.generation,
      bestFitness: log.bestFitness,
      avgFitness: log.avgFitness,
      worstFitness: log.worstFitness,
      metadata: JSON.parse(JSON.stringify(log.breakdown)),
    })),
  });

  await refreshPartNumbers(userId, studyPlan.id);
  return { studyPlanId: studyPlan.id };
}

/**
 * Whether an assessment result should re-plan. Called after every quiz attempt
 * and mock test.
 *
 * Only a low mock test does. A failed quiz no longer re-plans: this week is
 * locked anyway, and the learner's choice is theirs — retake the quiz, go back
 * over the material, or move on and come back (see /api/subtopics/[id]/readiness
 * for the warning on topics that build on it). The lower proficiency the quiz
 * leaves behind already moves the subtopic up when the plan is next made.
 */
export async function checkAdaptiveTrigger(
  _userId: string,
  _subtopicId: string,
  recentScore: number,
  assessmentType: "QUIZ" | "MOCK"
): Promise<{ triggered: boolean; reason?: string }> {
  const MOCK_THRESHOLD = 70;

  if (assessmentType === "MOCK" && recentScore < MOCK_THRESHOLD) {
    return { triggered: true, reason: "MOCK_TEST_LOW" };
  }

  return { triggered: false };
}

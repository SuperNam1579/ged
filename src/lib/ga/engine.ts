import type {
  GAConfig,
  GAInput,
  Individual,
  Chromosome,
  FitnessBreakdown,
} from "@/types";
import { computeFitness } from "./fitness";
import { tournamentSelect, orderCrossover, mutate, selectElites } from "./operators";
import { initPopulation, buildAvailableDates } from "./population";
import { db } from "@/lib/db";

const DEFAULT_CONFIG: GAConfig = {
  populationSize: 50,
  generations: 100,
  crossoverRate: 0.85,
  mutationRate: 0.15,
  elitismCount: 2,
  tournamentSize: 5,
};

interface GAResult {
  studyPlanId: string;
  bestFitness: number;
  fitnessBreakdown: FitnessBreakdown;
  generationLogs: GenerationLog[];
}

interface GenerationLog {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  worstFitness: number;
  breakdown: FitnessBreakdown;
}

export async function runGeneticAlgorithm(
  input: GAInput & { appendToExisting?: boolean },
  config: Partial<GAConfig> = {}
): Promise<GAResult> {
  const cfg: GAConfig = { ...DEFAULT_CONFIG, ...config };
  const { userId, proficiencies, preferences, weeklyAvailability, weekStartDate, weeklyAvailabilityId, subtopics, triggerReason, appendToExisting } = input;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = weekStartDate ?? today;
  const endDate = weekStartDate
    ? new Date(weekStartDate.getTime() + 7 * 24 * 60 * 60 * 1000)
    : preferences.targetExamDate;

  const availableDates = buildAvailableDates(weeklyAvailability, startDate, endDate);

  if (availableDates.length === 0) {
    throw new Error("No available study dates found. Check exam date and availability.");
  }

  const fitnessCtx = {
    subtopics,
    proficiencies,
    slots: weeklyAvailability,
    availableDates,
    subjectCodes: [...new Set(subtopics.map((s) => s.subjectCode))],
  };

  // Initialise population
  let population: Individual[] = initPopulation(
    cfg.populationSize,
    subtopics,
    proficiencies,
    availableDates,
    weeklyAvailability
  ).map((chromosome) => {
    const breakdown = computeFitness(chromosome, fitnessCtx);
    return { chromosome, fitness: breakdown.total, fitnessBreakdown: breakdown };
  });

  const generationLogs: GenerationLog[] = [];

  // Evolve over generations
  for (let gen = 0; gen < cfg.generations; gen++) {
    const fitnesses = population.map((i) => i.fitness);
    const best = Math.max(...fitnesses);
    const worst = Math.min(...fitnesses);
    const avg = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
    const bestIndividual = population.find((i) => i.fitness === best)!;

    generationLogs.push({
      generation: gen,
      bestFitness: best,
      avgFitness: avg,
      worstFitness: worst,
      breakdown: bestIndividual.fitnessBreakdown,
    });

    // Early termination if converged
    if (best >= 0.98) break;

    const elites = selectElites(population, cfg.elitismCount);
    const newPopulation: Individual[] = [...elites];

    while (newPopulation.length < cfg.populationSize) {
      const parent1 = tournamentSelect(population, cfg.tournamentSize);
      const parent2 = tournamentSelect(population, cfg.tournamentSize);

      let [child1, child2] =
        Math.random() < cfg.crossoverRate
          ? orderCrossover(parent1, parent2)
          : [parent1.slice(), parent2.slice()];

      child1 = mutate(child1, cfg.mutationRate, availableDates, subtopics);
      child2 = mutate(child2, cfg.mutationRate, availableDates, subtopics);

      for (const child of [child1, child2]) {
        if (newPopulation.length >= cfg.populationSize) break;
        const breakdown = computeFitness(child, fitnessCtx);
        newPopulation.push({
          chromosome: child,
          fitness: breakdown.total,
          fitnessBreakdown: breakdown,
        });
      }
    }

    population = newPopulation;
  }

  // Select best individual
  const best = selectElites(population, 1)[0];

  // ── Append mode: add sessions to existing active plan (preserves past weeks) ─
  if (appendToExisting) {
    const activePlan = await db.studyPlan.findFirst({
      where: { userId, isActive: true },
      orderBy: { version: "desc" },
    });

    if (activePlan) {
      await db.studySession.createMany({
        data: best.chromosome.map((gene) => ({
          studyPlanId: activePlan.id,
          subtopicId: gene.subtopicId,
          scheduledDate: new Date(gene.scheduledDate),
          durationMins: gene.durationMins,
          order: gene.order,
          status: "PENDING" as const,
        })),
      });

      return {
        studyPlanId: activePlan.id,
        bestFitness: best.fitness,
        fitnessBreakdown: best.fitnessBreakdown,
        generationLogs,
      };
    }
    // Fall through to create a new plan if no active plan exists
  }

  // ── Replace mode: deactivate old plan, create fresh one ──────────────────
  const previousVersion = await db.studyPlan.findFirst({
    where: { userId, isActive: true },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const nextVersion = (previousVersion?.version ?? 0) + 1;

  const studyPlan = await db.$transaction(
    async (tx) => {
      await tx.studyPlan.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false, weeklyAvailabilityId: null },
      });

      return tx.studyPlan.create({
        data: {
          userId,
          version: nextVersion,
          fitnessScore: best.fitness,
          triggerReason,
          isActive: true,
          metadata: JSON.parse(JSON.stringify({ config: cfg, fitnessBreakdown: best.fitnessBreakdown })),
          ...(weeklyAvailabilityId ? { weeklyAvailabilityId } : {}),
          sessions: {
            create: best.chromosome.map((gene) => ({
              subtopicId: gene.subtopicId,
              scheduledDate: new Date(gene.scheduledDate),
              durationMins: gene.durationMins,
              order: gene.order,
              status: "PENDING" as const,
            })),
          },
        },
      });
    },
    { timeout: 30000 }
  );

  // GA logs stay outside transaction — append-only research data, ok if partial
  await db.gaExecutionLog.createMany({
    data: generationLogs.map((log) => ({
      studyPlanId: studyPlan.id,
      generation: log.generation,
      bestFitness: log.bestFitness,
      avgFitness: log.avgFitness,
      worstFitness: log.worstFitness,
      metadata: JSON.parse(JSON.stringify(log.breakdown)),
    })),
  });

  return {
    studyPlanId: studyPlan.id,
    bestFitness: best.fitness,
    fitnessBreakdown: best.fitnessBreakdown,
    generationLogs,
  };
}

/**
 * Check adaptive triggers and re-run GA if needed.
 * Called after every quiz attempt and mock test.
 */
export async function checkAdaptiveTrigger(
  userId: string,
  subtopicId: string,
  recentScore: number,
  assessmentType: "QUIZ" | "MOCK"
): Promise<{ triggered: boolean; reason?: string }> {
  const QUIZ_THRESHOLD = 60;
  const MOCK_THRESHOLD = 70;
  const FAILURE_COUNT_THRESHOLD = 2;

  if (assessmentType === "MOCK" && recentScore < MOCK_THRESHOLD) {
    return { triggered: true, reason: "MOCK_TEST_LOW" };
  }

  if (assessmentType === "QUIZ" && recentScore < QUIZ_THRESHOLD) {
    // Count recent quiz failures on this subtopic
    const recentAttempts = await db.userAssessmentAttempt.findMany({
      where: {
        userId,
        assessment: { subtopicId, type: "QUIZ" },
        completedAt: { not: null },
      },
      orderBy: { completedAt: "desc" },
      take: FAILURE_COUNT_THRESHOLD,
      select: { score: true },
    });

    const failCount = recentAttempts.filter((a: { score: number }) => a.score < QUIZ_THRESHOLD).length;
    if (failCount >= FAILURE_COUNT_THRESHOLD) {
      return { triggered: true, reason: "QUIZ_FAILURE" };
    }
  }

  return { triggered: false };
}

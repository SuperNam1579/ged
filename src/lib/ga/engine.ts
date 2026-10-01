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
import { GALogger } from "./ga-logger"; // ★ LOGGER

const DEFAULT_CONFIG: GAConfig = {
  populationSize: 50,
  generations: 100,
  crossoverRate: 0.90,
  mutationRate: 0.015,
  elitismCount: 2,
  tournamentSize: 5,
  // ── ค่าสำหรับ early stopping (ตรวจจับ convergence) ──
  convergencePatience: 15,    // ถ้า best ไม่ดีขึ้นติดกันครบกี่รุ่น = หยุด
  convergenceEpsilon: 0.001,  // ดีขึ้นน้อยกว่านี้ ถือว่า "ไม่ขยับ"
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
  const rawStart = weekStartDate ?? today;
  const startDate = rawStart < today ? today : rawStart;
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

  // ★ LOGGER: ปรับ level ได้ — "SUMMARY" | "BEST_ONLY" | "FULL"
  const gaLogger = new GALogger({
    level: "BEST_ONLY",
    logToConsole: true,
    logToFile: true,
    outDir: "./ga-logs",
    // everyNGenerations: 10, // เปิดเมื่อใช้ level "FULL"
  });

  // ── แบบ CONVERGENCE: เตรียมตัวนับว่า best "นิ่ง" มากี่รุ่นติด ──
  let bestSoFar = -Infinity;   // คะแนนดีสุดที่เคยเจอ
  let stagnantCount = 0;       // นับจำนวนรุ่นที่ไม่ดีขึ้นติดต่อกัน

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

    // ★ LOGGER: บันทึก gene ของรุ่นนี้
    gaLogger.logGeneration(gen, population, cfg.elitismCount);

    // ── แบบ CONVERGENCE: เช็คว่า best ดีขึ้นพอไหม ──
    if (best - bestSoFar > cfg.convergenceEpsilon) {
      bestSoFar = best;      // ดีขึ้นจริง → อัปเดต + รีเซ็ตตัวนับ
      stagnantCount = 0;
    } else {
      stagnantCount++;       // ไม่ขยับ → นับเพิ่ม 1
    }

    // หยุดเมื่อนิ่งติดกันครบ patience รุ่น (ลู่เข้าแล้ว)
    if (stagnantCount >= cfg.convergencePatience) {
      console.log(
        `Converged: best ไม่ขยับ ${cfg.convergencePatience} รุ่นติด ` +
        `(best=${best.toFixed(4)}, หยุดที่รุ่น ${gen})`
      );
      break;
    }
    // หมายเหตุ: for loop ที่ gen < cfg.generations ยังทำหน้าที่เป็น safety cap
    // กันกรณีไม่ลู่เข้าสักที (แนะนำตั้ง generations สูงขึ้น เช่น 300)

    const elites = selectElites(population, cfg.elitismCount);
    const newPopulation: Individual[] = [...elites];

    while (newPopulation.length < cfg.populationSize) {
      const parent1 = tournamentSelect(population, cfg.tournamentSize);
      const parent2 = tournamentSelect(population, cfg.tournamentSize);

      const didCrossover = Math.random() < cfg.crossoverRate;
      let [child1, child2] = didCrossover
        ? orderCrossover(parent1, parent2)
        : [parent1.slice(), parent2.slice()];

      console.log(didCrossover ? "  ✓ crossover" : "  ✗ ลอกพ่อแม่ (ไม่ crossover)");

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

  const best = selectElites(population, 1)[0];

  // ★ LOGGER: เขียนไฟล์ log ทั้งหมด + ตารางสุดท้ายที่ใช้จริง
  gaLogger.finalize(best.chromosome);

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
  }

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
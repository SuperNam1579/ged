import type { GAConfig, SubtopicData } from "@/types";

export const WEAKNESS_THRESHOLD = 60;

/**
 * Default evolution parameters. Lives here rather than in engine.ts so pages
 * that only need to quote the figures don't pull the engine — and its Prisma
 * client — into their bundle.
 */
export const DEFAULT_CONFIG: GAConfig = {
  populationSize: 50,
  generations: 100,
  crossoverRate: 0.85,
  mutationRate: 0.15,
  elitismCount: 2,
  tournamentSize: 5,
};

// วิชาที่ถือว่า "หนัก" เชิงการคำนวณ/วิเคราะห์ (heavy/analytical)
export const HEAVY_SUBJECTS = new Set(["MATH", "SCI"]);
// subtopic ที่ difficulty >= ค่านี้ ก็ถือว่าหนักด้วย แม้จะไม่ใช่วิชา heavy
export const HEAVY_DIFFICULTY = 4;

export function isHeavy(s: SubtopicData): boolean {
  return HEAVY_SUBJECTS.has(s.subjectCode) || s.difficultyLevel >= HEAVY_DIFFICULTY;
}

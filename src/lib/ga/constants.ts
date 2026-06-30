import type { SubtopicData } from "@/types";

export const WEAKNESS_THRESHOLD = 60;

// วิชาที่ถือว่า "หนัก" เชิงการคำนวณ/วิเคราะห์ (heavy/analytical)
export const HEAVY_SUBJECTS = new Set(["MATH", "SCI"]);
// subtopic ที่ difficulty >= ค่านี้ ก็ถือว่าหนักด้วย แม้จะไม่ใช่วิชา heavy
export const HEAVY_DIFFICULTY = 4;

export function isHeavy(s: SubtopicData): boolean {
  return HEAVY_SUBJECTS.has(s.subjectCode) || s.difficultyLevel >= HEAVY_DIFFICULTY;
}

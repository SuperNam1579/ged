import type {
  Chromosome,
  FitnessBreakdown,
  SubtopicData,
  ProficiencyMap,
  AvailabilitySlotInput,
} from "@/types";
import { WEAKNESS_THRESHOLD, isHeavy } from "./constants";

// ============================================================================
// FITNESS WEIGHTS  (ปรับใหม่ตามงานวิจัย — รวม Variety/Rotation เข้ามา)
// ----------------------------------------------------------------------------
//  เดิม: Coverage .30 | Weakness .25 | Time .20 | Prereq .15 | Balance .10
//  ใหม่: Coverage .25 | Weakness .20 | Time .15 | Prereq .15 | Variety .15 | Balance .10
// ============================================================================
const WEIGHTS = {
  coverage: 0.25,
  weaknessFocus: 0.2,
  timeFeasibility: 0.15,
  prerequisiteOrder: 0.15,
  variety: 0.15, // ★ NEW — Subject Variety & Rotation
  balance: 0.1, // ปรับให้ดูความยากหนัก-เบา (difficulty) แทน CV ของเวลา
};

interface FitnessContext {
  subtopics: SubtopicData[];
  proficiencies: ProficiencyMap;
  slots: AvailabilitySlotInput[];
  availableDates: string[];
  subjectCodes: string[];
}

function slotMinutesForDate(slots: AvailabilitySlotInput[], date: string): number {
  const dow = new Date(date).getDay();
  return slots
    .filter((s) => s.dayOfWeek === dow)
    .reduce((sum, s) => {
      const [sh, sm] = s.startTime.split(":").map(Number);
      const [eh, em] = s.endTime.split(":").map(Number);
      return sum + (eh * 60 + em) - (sh * 60 + sm);
    }, 0);
}

// ─── helper: จัดกลุ่ม gene ตามวัน (เรียงตาม order ภายในวัน) ──────────────────
function groupByDay(
  chromosome: Chromosome
): Map<string, Chromosome> {
  const days = new Map<string, Chromosome>();
  for (const gene of chromosome) {
    const arr = days.get(gene.scheduledDate) ?? [];
    arr.push(gene);
    days.set(gene.scheduledDate, arr);
  }
  // เรียงภายในวันตาม order เพื่อให้ดู "ติดกัน" ได้ถูกต้อง
  for (const arr of days.values()) {
    arr.sort((a, b) => a.order - b.order);
  }
  return days;
}

// ============================================================================
// 1) COVERAGE  (คงเดิม)
// ============================================================================
function coverageScore(
  chromosome: Chromosome,
  subtopics: SubtopicData[],
  proficiencies: ProficiencyMap
): number {
  const scheduledIds = new Set(chromosome.map((g) => g.subtopicId));
  const criticalIds = subtopics
    .filter((s) => (proficiencies[s.id] ?? 0) < WEAKNESS_THRESHOLD)
    .map((s) => s.id);

  if (criticalIds.length === 0) {
    return Math.min(scheduledIds.size / Math.max(subtopics.length, 1), 1);
  }
  const coveredCritical = criticalIds.filter((id) => scheduledIds.has(id)).length;
  return coveredCritical / criticalIds.length;
}

// ============================================================================
// 2) WEAKNESS FOCUS  (คงเดิม)
// ============================================================================
function weaknessFocusScore(
  chromosome: Chromosome,
  proficiencies: ProficiencyMap
): number {
  if (chromosome.length === 0) return 0;
  let totalWeight = 0;
  let weakWeight = 0;
  for (const gene of chromosome) {
    const prof = proficiencies[gene.subtopicId] ?? 0;
    const weakness = Math.max(0, WEAKNESS_THRESHOLD - prof) / WEAKNESS_THRESHOLD;
    const geneWeight = gene.durationMins;
    totalWeight += geneWeight;
    weakWeight += geneWeight * weakness;
  }
  return totalWeight === 0 ? 0 : weakWeight / totalWeight;
}

// ============================================================================
// 3) TIME FEASIBILITY  (คงเดิม)
// ============================================================================
function timeFeasibilityScore(
  chromosome: Chromosome,
  slots: AvailabilitySlotInput[],
  availableDates: string[]
): number {
  if (chromosome.length === 0) return 0;
  const dateGroups = new Map<string, number>();
  for (const gene of chromosome) {
    const current = dateGroups.get(gene.scheduledDate) ?? 0;
    dateGroups.set(gene.scheduledDate, current + gene.durationMins);
  }
  let violations = 0;
  const totalDays = dateGroups.size;
  for (const [date, totalMins] of dateGroups) {
    if (!availableDates.includes(date)) violations++;
    else if (totalMins > slotMinutesForDate(slots, date) * 1.2) violations++;
  }
  return totalDays === 0 ? 0 : Math.max(0, 1 - violations / totalDays);
}

// ============================================================================
// 4) PREREQUISITE ORDER  (คงเดิม — missing prereq ไม่นับเป็น violation)
// ============================================================================
function prerequisiteOrderScore(
  chromosome: Chromosome,
  subtopics: SubtopicData[]
): number {
  if (chromosome.length === 0) return 0;
  const subtopicMap = new Map(subtopics.map((s) => [s.id, s]));
  const positionMap = new Map(chromosome.map((g, i) => [g.subtopicId, i]));
  let violations = 0;
  let totalPrereqs = 0;
  for (const gene of chromosome) {
    const subtopic = subtopicMap.get(gene.subtopicId);
    if (!subtopic) continue;
    const currentPos = positionMap.get(gene.subtopicId)!;
    for (const prereqId of subtopic.prerequisiteIds) {
      const prereqPos = positionMap.get(prereqId);
      if (prereqPos === undefined) continue; // ไม่อยู่ในแผน = coverage จัดการ
      totalPrereqs++;
      if (prereqPos >= currentPos) violations++;
    }
  }
  return totalPrereqs === 0 ? 1 : Math.max(0, 1 - violations / totalPrereqs);
}

// ============================================================================
// 5) ★ VARIETY / ROTATION  (ใหม่)
// ----------------------------------------------------------------------------
//  รวม 3 องค์ประกอบตามงานวิจัย แล้วแก้ปัญหา entropy ขัด weakness ด้วย
//  KL-divergence เทียบ target ที่ derive จาก proficiency (แบบ B: weakness นำ)
//
//   (a) D1 — KL-divergence จาก target distribution  → กระจายเทียบ "ความจำเป็น"
//   (b) D2 — distinct-subjects-per-day              → แต่ละวันแตะ 2-3 วิชา
//   (c) D4 — weekly-presence                        → ทุกวิชาควรโผล่หลายวัน
// ============================================================================

const DAY_SUBJECTS_MIN = 2;
const DAY_SUBJECTS_MAX = 3;
const MIN_DAYS_PER_SUBJECT = 3;

function buildTargetDistribution(
  subtopics: SubtopicData[],
  proficiencies: ProficiencyMap,
  subjectCodes: string[]
): Map<string, number> {
  const needBySubject = new Map<string, number>();
  for (const code of subjectCodes) needBySubject.set(code, 0);

  for (const s of subtopics) {
    if (!needBySubject.has(s.subjectCode)) continue;
    const prof = proficiencies[s.id] ?? 0;
    const need = Math.max(0, WEAKNESS_THRESHOLD - prof) / WEAKNESS_THRESHOLD + 0.1;
    needBySubject.set(s.subjectCode, (needBySubject.get(s.subjectCode) ?? 0) + need);
  }

  const totalNeed = Array.from(needBySubject.values()).reduce((a, b) => a + b, 0);
  const target = new Map<string, number>();
  if (totalNeed === 0) {
    const uniform = 1 / Math.max(subjectCodes.length, 1);
    for (const code of subjectCodes) target.set(code, uniform);
  } else {
    for (const [code, need] of needBySubject) target.set(code, need / totalNeed);
  }
  return target;
}

function distributionScore(
  chromosome: Chromosome,
  subtopics: SubtopicData[],
  proficiencies: ProficiencyMap,
  subjectCodes: string[]
): number {
  const subtopicMap = new Map(subtopics.map((s) => [s.id, s]));
  const minutesBySubject = new Map<string, number>();
  for (const code of subjectCodes) minutesBySubject.set(code, 0);

  let totalMins = 0;
  for (const gene of chromosome) {
    const s = subtopicMap.get(gene.subtopicId);
    if (!s || !minutesBySubject.has(s.subjectCode)) continue;
    minutesBySubject.set(
      s.subjectCode,
      (minutesBySubject.get(s.subjectCode) ?? 0) + gene.durationMins
    );
    totalMins += gene.durationMins;
  }
  if (totalMins === 0) return 0;

  const target = buildTargetDistribution(subtopics, proficiencies, subjectCodes);

  const eps = 1e-6;
  let kl = 0;
  for (const code of subjectCodes) {
    const p = (minutesBySubject.get(code) ?? 0) / totalMins + eps;
    const q = (target.get(code) ?? 0) + eps;
    kl += p * Math.log(p / q);
  }
  return 1 / (1 + Math.max(0, kl));
}

function dayVarietyScore(
  chromosome: Chromosome,
  subtopics: SubtopicData[]
): number {
  const subtopicMap = new Map(subtopics.map((s) => [s.id, s]));
  const days = groupByDay(chromosome);
  if (days.size === 0) return 0;

  let sum = 0;
  for (const dayGenes of days.values()) {
    const subjects = new Set<string>();
    for (const g of dayGenes) {
      const s = subtopicMap.get(g.subtopicId);
      if (s) subjects.add(s.subjectCode);
    }
    const n = subjects.size;
    if (n >= DAY_SUBJECTS_MIN && n <= DAY_SUBJECTS_MAX) {
      sum += 1;
    } else if (n < DAY_SUBJECTS_MIN) {
      sum += n / DAY_SUBJECTS_MIN;
    } else {
      sum += Math.max(0, 1 - (n - DAY_SUBJECTS_MAX) * 0.25);
    }
  }
  return sum / days.size;
}

function weeklyPresenceScore(
  chromosome: Chromosome,
  subtopics: SubtopicData[],
  subjectCodes: string[]
): number {
  const subtopicMap = new Map(subtopics.map((s) => [s.id, s]));
  const daysBySubject = new Map<string, Set<string>>();
  for (const code of subjectCodes) daysBySubject.set(code, new Set());

  for (const gene of chromosome) {
    const s = subtopicMap.get(gene.subtopicId);
    if (!s || !daysBySubject.has(s.subjectCode)) continue;
    daysBySubject.get(s.subjectCode)!.add(gene.scheduledDate);
  }

  const activeSubjects = subjectCodes.filter(
    (c) => (daysBySubject.get(c)?.size ?? 0) > 0
  );
  if (activeSubjects.length === 0) return 0;

  let score = 0;
  for (const code of activeSubjects) {
    const d = daysBySubject.get(code)!.size;
    score += Math.min(1, d / MIN_DAYS_PER_SUBJECT);
  }
  return score / activeSubjects.length;
}

function varietyScore(
  chromosome: Chromosome,
  ctx: FitnessContext
): number {
  if (chromosome.length === 0) return 0;
  const dist = distributionScore(
    chromosome,
    ctx.subtopics,
    ctx.proficiencies,
    ctx.subjectCodes
  );
  const dayVar = dayVarietyScore(chromosome, ctx.subtopics);
  const presence = weeklyPresenceScore(
    chromosome,
    ctx.subtopics,
    ctx.subjectCodes
  );
  return 0.5 * dist + 0.3 * dayVar + 0.2 * presence;
}

// ============================================================================
// 6) ★ BALANCE  (ปรับใหม่ — ดูความยากหนัก-เบา แทน CV ของเวลา)
// ----------------------------------------------------------------------------
//   (a) P_var  — variance ของ "difficulty load" รายวัน
//   (b) P_adj  — penalty เมื่อ session หนักวางติดกันในวันเดียว
// ============================================================================
const BALANCE_ALPHA = 0.5;
const BALANCE_BETA = 0.5;

function balanceScore(
  chromosome: Chromosome,
  subtopics: SubtopicData[]
): number {
  if (chromosome.length === 0) return 0;
  const subtopicMap = new Map(subtopics.map((s) => [s.id, s]));
  const days = groupByDay(chromosome);
  if (days.size === 0) return 0;

  const dailyLoads: number[] = [];
  let heavyAdjacent = 0;
  let adjacentPairs = 0;

  for (const dayGenes of days.values()) {
    let load = 0;
    for (let i = 0; i < dayGenes.length; i++) {
      const s = subtopicMap.get(dayGenes[i].subtopicId);
      if (!s) continue;
      load += s.difficultyLevel;

      if (i > 0) {
        const prev = subtopicMap.get(dayGenes[i - 1].subtopicId);
        if (prev) {
          adjacentPairs++;
          if (isHeavy(prev) && isHeavy(s)) heavyAdjacent++;
        }
      }
    }
    dailyLoads.push(load);
  }

  const mean =
    dailyLoads.reduce((a, b) => a + b, 0) / Math.max(dailyLoads.length, 1);
  const variance =
    dailyLoads.reduce((acc, v) => acc + (v - mean) ** 2, 0) /
    Math.max(dailyLoads.length, 1);
  const pCv2 = mean === 0 ? 1 : Math.min(1, variance / (mean * mean)); // CV² of daily load

  const pAdj = adjacentPairs === 0 ? 0 : heavyAdjacent / adjacentPairs;

  const penalty = BALANCE_ALPHA * pCv2 + BALANCE_BETA * pAdj;
  return Math.max(0, 1 - Math.min(1, penalty));
}

// ============================================================================
// MAIN: computeFitness
// ============================================================================
export function computeFitness(
  chromosome: Chromosome,
  ctx: FitnessContext
): FitnessBreakdown {
  const coverage = coverageScore(chromosome, ctx.subtopics, ctx.proficiencies);
  const weaknessFocus = weaknessFocusScore(chromosome, ctx.proficiencies);
  const timeFeasibility = timeFeasibilityScore(
    chromosome,
    ctx.slots,
    ctx.availableDates
  );
  const prerequisiteOrder = prerequisiteOrderScore(chromosome, ctx.subtopics);
  const variety = varietyScore(chromosome, ctx);
  const balance = balanceScore(chromosome, ctx.subtopics);

  const total =
    coverage * WEIGHTS.coverage +
    weaknessFocus * WEIGHTS.weaknessFocus +
    timeFeasibility * WEIGHTS.timeFeasibility +
    prerequisiteOrder * WEIGHTS.prerequisiteOrder +
    variety * WEIGHTS.variety +
    balance * WEIGHTS.balance;

  return {
    coverage,
    weaknessFocus,
    timeFeasibility,
    prerequisiteOrder,
    variety,
    balance,
    total,
  };
}

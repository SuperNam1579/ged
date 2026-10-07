import type {
  Chromosome,
  FitnessBreakdown,
  SubtopicData,
  ProficiencyMap,
  AvailabilitySlotInput,
} from "@/types";
import { WEAKNESS_THRESHOLD, isHeavy } from "./constants";
import { mondayOf } from "../schedule/calendar";

// ============================================================================
// FITNESS WEIGHTS  (ปรับใหม่ตามงานวิจัย — รวม Variety/Rotation เข้ามา)
// ----------------------------------------------------------------------------
//  เดิม: Coverage .30 | Weakness .25 | Time .20 | Prereq .15 | Balance .10
//  ใหม่: Coverage .25 | Weakness .20 | Time .15 | Prereq .15 | Variety .15 | Balance .10
// ============================================================================
export const WEIGHTS = {
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
  /**
   * Minutes available on each date. When given it replaces `slots`, which can
   * only describe a day by its weekday — a plan that runs to the exam may have
   * a different week for every week.
   */
  dayCapacity?: Map<string, number>;
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

// ─── helper: สิ่งที่คำนวณจาก ctx ได้ครั้งเดียว ───────────────────────────────
//  computeFitness ถูกเรียก ~5,000 ครั้งต่อการจัดแผนด้วย ctx ตัวเดิม จึง cache ไว้
interface Derived {
  subtopicMap: Map<string, SubtopicData>;
  /** ลำดับของวันที่เรียนได้ 0..n-1 — ใช้วัดว่า gene อยู่ "ต้น" หรือ "ท้าย" แผน */
  dateIndex: Map<string, number>;
  /** สัปดาห์ (วันจันทร์) ทั้งหมดที่มีวันเรียน เรียงตามเวลา */
  weeks: string[];
  /** จำนวนวันเรียนในแต่ละสัปดาห์ */
  studyDaysInWeek: Map<string, number>;
  weekOf: (date: string) => string;
  /** สัดส่วน "ความจำเป็น" ของแต่ละวิชา (รวม = 1) */
  target: Map<string, number>;
}

const derivedCache = new WeakMap<FitnessContext, Derived>();

function derive(ctx: FitnessContext): Derived {
  const cached = derivedCache.get(ctx);
  if (cached) return cached;

  const weekMemo = new Map<string, string>();
  const weekOf = (date: string) => {
    let w = weekMemo.get(date);
    if (w === undefined) {
      w = mondayOf(date);
      weekMemo.set(date, w);
    }
    return w;
  };

  const dates = [...ctx.availableDates].sort();
  const studyDaysInWeek = new Map<string, number>();
  for (const date of dates) studyDaysInWeek.set(weekOf(date), (studyDaysInWeek.get(weekOf(date)) ?? 0) + 1);

  const derived: Derived = {
    subtopicMap: new Map(ctx.subtopics.map((s) => [s.id, s])),
    dateIndex: new Map(dates.map((date, i) => [date, i])),
    weeks: [...studyDaysInWeek.keys()].sort(),
    studyDaysInWeek,
    weekOf,
    target: buildTargetDistribution(ctx.subtopics, ctx.proficiencies, ctx.subjectCodes),
  };
  derivedCache.set(ctx, derived);
  return derived;
}

/** 1 = วันแรกของแผน, 0 = วันสุดท้าย */
function earliness(date: string, d: Derived): number {
  const n = d.dateIndex.size;
  if (n <= 1) return 1;
  const i = d.dateIndex.get(date) ?? n - 1;
  return 1 - i / (n - 1);
}

/**
 * ช่วงสัปดาห์ที่แต่ละวิชา "ยังเรียนไม่จบ": ตั้งแต่สัปดาห์แรกของแผนถึงสัปดาห์
 * สุดท้ายที่มีวิชานั้น — วิชาที่ยังมีเนื้อหาเหลือควรได้เรียนทุกสัปดาห์ แต่เรียน
 * จบแล้วก็ไม่ต้องคาดหวังให้โผล่อีก
 */
function subjectSpans(chromosome: Chromosome, d: Derived): Map<string, [string, string]> {
  const first = d.weeks[0];
  const spans = new Map<string, [string, string]>();
  for (const gene of chromosome) {
    const s = d.subtopicMap.get(gene.subtopicId);
    if (!s) continue;
    const w = d.weekOf(gene.scheduledDate);
    const span = spans.get(s.subjectCode);
    if (!span) spans.set(s.subjectCode, [first !== undefined && first < w ? first : w, w]);
    else if (w > span[1]) span[1] = w;
  }
  return spans;
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
// 2) WEAKNESS FOCUS  (ปรับ — ดูทั้ง "ให้เวลามาก" และ "ได้เรียนก่อน")
// ----------------------------------------------------------------------------
//   (a) share  — สัดส่วนเวลาที่ให้หัวข้ออ่อน (แบบเดิม)
//   (b) timing — หัวข้ออ่อนอยู่ต้นแผนกว่าค่าเฉลี่ยของทั้งแผนแค่ไหน
//  แผนที่ยาวถึงวันสอบมักใส่เนื้อหาได้ครบ (a) จึงเท่ากันทุกลำดับ — (b) คือส่วนที่
//  ให้รางวัล GA เมื่อเอาหัวข้ออ่อนขึ้นก่อน
// ============================================================================
function weaknessFocusScore(
  chromosome: Chromosome,
  proficiencies: ProficiencyMap,
  d: Derived
): number {
  if (chromosome.length === 0) return 0;
  let total = 0;
  let weak = 0;
  let weakEarly = 0;
  let allEarly = 0;
  for (const gene of chromosome) {
    const prof = proficiencies[gene.subtopicId] ?? 0;
    const weakness = Math.max(0, WEAKNESS_THRESHOLD - prof) / WEAKNESS_THRESHOLD;
    const m = gene.durationMins;
    const e = earliness(gene.scheduledDate, d);
    total += m;
    weak += m * weakness;
    weakEarly += m * weakness * e;
    allEarly += m * e;
  }
  if (total === 0) return 0;
  const share = weak / total;
  if (weak === 0) return share;
  // earliness เฉลี่ยของเวลาหัวข้ออ่อน เทียบกับของทั้งแผน: 0.5 = ไม่ต่างกัน
  const timing = Math.min(1, Math.max(0, 0.5 + (weakEarly / weak - allEarly / total)));
  return 0.5 * share + 0.5 * timing;
}

// ============================================================================
// 3) TIME FEASIBILITY  (ปรับ — ไม่เกินเวลาว่าง และใช้เวลาว่างคุ้ม)
// ----------------------------------------------------------------------------
//   (a) feasible    — สัดส่วนวันที่ไม่ได้ยัดเกินเวลาว่าง (แบบเดิม)
//   (b) utilization — ตั้งแต่วันแรกถึงวันสุดท้ายที่มีเรียน ใช้เวลาว่างไปกี่ %
//  packDays ไม่ยัดเกินอยู่แล้ว (a) จึงมักได้ 1 ทุกลำดับ; (b) แยกลำดับที่วางแล้ว
//  เหลือช่องว่างเป็นเศษ ๆ (จบช้า) ออกจากลำดับที่เติมวันได้เต็ม (จบเร็ว)
// ============================================================================
function timeFeasibilityScore(
  chromosome: Chromosome,
  slots: AvailabilitySlotInput[],
  availableDates: string[],
  d: Derived,
  dayCapacity?: Map<string, number>
): number {
  if (chromosome.length === 0) return 0;
  const dateGroups = new Map<string, number>();
  for (const gene of chromosome) {
    const current = dateGroups.get(gene.scheduledDate) ?? 0;
    dateGroups.set(gene.scheduledDate, current + gene.durationMins);
  }
  const capacityOf = (date: string) => dayCapacity?.get(date) ?? slotMinutesForDate(slots, date);

  let violations = 0;
  let first = Infinity;
  let last = -Infinity;
  for (const [date, totalMins] of dateGroups) {
    const i = d.dateIndex.get(date);
    if (i === undefined) {
      violations++;
      continue;
    }
    if (totalMins > capacityOf(date) * 1.2) violations++;
    first = Math.min(first, i);
    last = Math.max(last, i);
  }
  const feasible = Math.max(0, 1 - violations / dateGroups.size);
  if (first === Infinity) return 0;

  let used = 0;
  let capacity = 0;
  for (const date of availableDates) {
    const i = d.dateIndex.get(date)!;
    if (i < first || i > last) continue;
    const cap = capacityOf(date);
    capacity += cap;
    used += Math.min(cap, dateGroups.get(date) ?? 0);
  }
  const utilization = capacity === 0 ? 0 : used / capacity;

  return feasible * (0.5 + 0.5 * utilization);
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
//   (a) D1 — KL-divergence จาก target distribution  → กระจายเทียบ "ความจำเป็น" (รายสัปดาห์)
//   (b) D2 — distinct-subjects-per-day              → แต่ละวันแตะ 2-3 วิชา
//   (c) D4 — weekly-presence                        → ทุกวิชาควรโผล่หลายวันในทุกสัปดาห์
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

// (a) รายสัปดาห์: แต่ละสัปดาห์ควรแบ่งเวลาตามความจำเป็นของวิชาที่ยังเรียนอยู่
//     ในสัปดาห์นั้น — วัดรวมทั้งแผนจะปล่อยให้ "MATH ล้วน 3 สัปดาห์ แล้ว SCI ล้วน"
//     ได้คะแนนดี ทั้งที่ไม่มีสัปดาห์ไหนสมดุลเลย
function distributionScore(chromosome: Chromosome, d: Derived): number {
  const spans = subjectSpans(chromosome, d);
  const minutes = new Map<string, Map<string, number>>(); // week → subject → minutes
  for (const gene of chromosome) {
    const s = d.subtopicMap.get(gene.subtopicId);
    if (!s || !d.target.has(s.subjectCode)) continue;
    const w = d.weekOf(gene.scheduledDate);
    const bySubject = minutes.get(w) ?? new Map<string, number>();
    bySubject.set(s.subjectCode, (bySubject.get(s.subjectCode) ?? 0) + gene.durationMins);
    minutes.set(w, bySubject);
  }

  const eps = 1e-6;
  let weighted = 0;
  let totalMins = 0;
  for (const [week, bySubject] of minutes) {
    const active = [...spans].filter(([, [a, b]]) => a <= week && week <= b).map(([code]) => code);
    const weekMins = active.reduce((a, c) => a + (bySubject.get(c) ?? 0), 0);
    const targetSum = active.reduce((a, c) => a + (d.target.get(c) ?? 0), 0);
    if (weekMins === 0 || targetSum === 0) continue;
    let kl = 0;
    for (const code of active) {
      const p = (bySubject.get(code) ?? 0) / weekMins + eps;
      const q = (d.target.get(code) ?? 0) / targetSum + eps;
      kl += p * Math.log(p / q);
    }
    weighted += weekMins / (1 + Math.max(0, kl));
    totalMins += weekMins;
  }
  return totalMins === 0 ? 0 : weighted / totalMins;
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

// (c) รายสัปดาห์: ทุกวิชาที่ยังเรียนไม่จบควรโผล่อย่างน้อย 3 วันในทุกสัปดาห์
//     (หรือทุกวันเรียน ถ้าสัปดาห์นั้นมีไม่ถึง 3 วัน) — นับรวมทั้งแผน 50 วัน
//     ผ่านเกณฑ์เสมอ จึงไม่ได้วัดอะไร
function weeklyPresenceScore(chromosome: Chromosome, d: Derived): number {
  const spans = subjectSpans(chromosome, d);
  const days = new Map<string, Set<string>>(); // `${subject}|${week}` → dates
  for (const gene of chromosome) {
    const s = d.subtopicMap.get(gene.subtopicId);
    if (!s) continue;
    const key = `${s.subjectCode}|${d.weekOf(gene.scheduledDate)}`;
    const set = days.get(key) ?? new Set<string>();
    set.add(gene.scheduledDate);
    days.set(key, set);
  }

  let sum = 0;
  let n = 0;
  for (const [code, [from, to]] of spans) {
    for (const week of d.weeks) {
      if (week < from || week > to) continue;
      const need = Math.min(MIN_DAYS_PER_SUBJECT, d.studyDaysInWeek.get(week) ?? 0);
      if (need === 0) continue;
      sum += Math.min(1, (days.get(`${code}|${week}`)?.size ?? 0) / need);
      n++;
    }
  }
  return n === 0 ? 0 : sum / n;
}

function varietyScore(
  chromosome: Chromosome,
  ctx: FitnessContext,
  d: Derived
): number {
  if (chromosome.length === 0) return 0;
  const dist = distributionScore(chromosome, d);
  const dayVar = dayVarietyScore(chromosome, ctx.subtopics);
  const presence = weeklyPresenceScore(chromosome, d);
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
  const d = derive(ctx);
  const coverage = coverageScore(chromosome, ctx.subtopics, ctx.proficiencies);
  const weaknessFocus = weaknessFocusScore(chromosome, ctx.proficiencies, d);
  const timeFeasibility = timeFeasibilityScore(
    chromosome,
    ctx.slots,
    ctx.availableDates,
    d,
    ctx.dayCapacity
  );
  const prerequisiteOrder = prerequisiteOrderScore(chromosome, ctx.subtopics);
  const variety = varietyScore(chromosome, ctx, d);
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

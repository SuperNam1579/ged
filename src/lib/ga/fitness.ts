import type {
  Chromosome,
  FitnessBreakdown,
  SubtopicData,
  ProficiencyMap,
} from "@/types";

// Fitness weights matching the system spec
const WEIGHTS = {
  coverage: 0.30,
  weaknessFocus: 0.25,
  timeFeasibility: 0.20,
  prerequisiteOrder: 0.15,
  balance: 0.10,
};

const WEAKNESS_THRESHOLD = 60; // below this = weak subtopic

interface FitnessContext {
  subtopics: SubtopicData[];
  proficiencies: ProficiencyMap;
  hoursPerDay: number;
  availability: Record<string, boolean>;
  availableDates: string[];
  subjectCodes: string[];
}

function coverageScore(
  chromosome: Chromosome,
  subtopics: SubtopicData[],
  proficiencies: ProficiencyMap
): number {
  const scheduledIds = new Set(chromosome.map((g) => g.subtopicId));
  // Weak subtopics that MUST be covered
  const criticalIds = subtopics
    .filter((s) => (proficiencies[s.id] ?? 0) < WEAKNESS_THRESHOLD)
    .map((s) => s.id);

  if (criticalIds.length === 0) {
    // All subtopics strong — reward any coverage
    return Math.min(scheduledIds.size / Math.max(subtopics.length, 1), 1);
  }

  const coveredCritical = criticalIds.filter((id) => scheduledIds.has(id)).length;
  return coveredCritical / criticalIds.length;
}

function weaknessFocusScore(
  chromosome: Chromosome,
  proficiencies: ProficiencyMap
): number {
  if (chromosome.length === 0) return 0;

  // Genes that target weak subtopics, weighted by weakness severity
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

function timeFeasibilityScore(
  chromosome: Chromosome,
  hoursPerDay: number,
  availableDates: string[]
): number {
  if (chromosome.length === 0) return 0;

  const minutesPerDay = hoursPerDay * 60;
  const dateGroups = new Map<string, number>();

  for (const gene of chromosome) {
    const current = dateGroups.get(gene.scheduledDate) ?? 0;
    dateGroups.set(gene.scheduledDate, current + gene.durationMins);
  }

  let violations = 0;
  let totalDays = dateGroups.size;

  for (const [date, totalMins] of dateGroups) {
    if (!availableDates.includes(date)) {
      violations++;
    } else if (totalMins > minutesPerDay * 1.2) {
      // Allow 20% over — penalise beyond that
      violations++;
    }
  }

  return totalDays === 0 ? 0 : Math.max(0, 1 - violations / totalDays);
}

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

    for (const prereqId of subtopic.prerequisiteIds) {
      const prereqPos = positionMap.get(prereqId);
      // If prereq is not in the plan at all, skip — not an ordering violation;
      // missing coverage is handled by the Coverage fitness component.
      if (prereqPos === undefined) continue;

      const currentPos = positionMap.get(gene.subtopicId)!;
      totalPrereqs++;
      if (prereqPos >= currentPos) violations++;
    }
  }

  return totalPrereqs === 0 ? 1 : Math.max(0, 1 - violations / totalPrereqs);
}

function balanceScore(
  chromosome: Chromosome,
  subtopics: SubtopicData[]
): number {
  if (chromosome.length === 0) return 0;

  const subtopicMap = new Map(subtopics.map((s) => [s.id, s]));
  const subjectMinutes = new Map<string, number>();

  for (const gene of chromosome) {
    const subtopic = subtopicMap.get(gene.subtopicId);
    if (!subtopic) continue;
    const current = subjectMinutes.get(subtopic.subjectCode) ?? 0;
    subjectMinutes.set(subtopic.subjectCode, current + gene.durationMins);
  }

  if (subjectMinutes.size === 0) return 0;

  const values = Array.from(subjectMinutes.values());
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Coefficient of variation — lower = more balanced
  const cv = mean === 0 ? 1 : stdDev / mean;
  return Math.max(0, 1 - Math.min(cv, 1));
}

export function computeFitness(
  chromosome: Chromosome,
  ctx: FitnessContext
): FitnessBreakdown {
  const coverage = coverageScore(chromosome, ctx.subtopics, ctx.proficiencies);
  const weaknessFocus = weaknessFocusScore(chromosome, ctx.proficiencies);
  const timeFeasibility = timeFeasibilityScore(
    chromosome,
    ctx.hoursPerDay,
    ctx.availableDates
  );
  const prerequisiteOrder = prerequisiteOrderScore(chromosome, ctx.subtopics);
  const balance = balanceScore(chromosome, ctx.subtopics);

  const total =
    coverage * WEIGHTS.coverage +
    weaknessFocus * WEIGHTS.weaknessFocus +
    timeFeasibility * WEIGHTS.timeFeasibility +
    prerequisiteOrder * WEIGHTS.prerequisiteOrder +
    balance * WEIGHTS.balance;

  return { coverage, weaknessFocus, timeFeasibility, prerequisiteOrder, balance, total };
}

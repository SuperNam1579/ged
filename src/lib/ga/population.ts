import type { Chromosome, GASubtopicGene, SubtopicData, ProficiencyMap } from "@/types";

const WEAKNESS_THRESHOLD = 60;

/**
 * Generate available study dates from today up to exam date,
 * filtered by user's day-of-week availability.
 */
export function buildAvailableDates(
  targetExamDate: Date,
  availability: Record<string, boolean>
): string[] {
  const dayKeys = [
    "sunday", "monday", "tuesday", "wednesday",
    "thursday", "friday", "saturday"
  ];
  const dates: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const exam = new Date(targetExamDate);
  exam.setHours(0, 0, 0, 0);

  const current = new Date(today);
  while (current < exam) {
    const dayKey = dayKeys[current.getDay()];
    if (availability[dayKey]) {
      dates.push(current.toISOString().split("T")[0]);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Build one chromosome (study plan) prioritising weak subtopics.
 * Uses a greedy date-filling approach seeded with randomness.
 */
export function createIndividual(
  subtopics: SubtopicData[],
  proficiencies: ProficiencyMap,
  availableDates: string[],
  hoursPerDay: number,
  random: boolean = false
): Chromosome {
  if (availableDates.length === 0) return [];

  const minutesPerDay = hoursPerDay * 60;

  // Sort: weak topics first, then by difficulty
  const sorted = [...subtopics].sort((a, b) => {
    const profA = proficiencies[a.id] ?? 0;
    const profB = proficiencies[b.id] ?? 0;
    const weakA = profA < WEAKNESS_THRESHOLD ? 1 : 0;
    const weakB = profB < WEAKNESS_THRESHOLD ? 1 : 0;
    if (weakA !== weakB) return weakB - weakA;
    return b.difficultyLevel - a.difficultyLevel;
  });

  // Optionally shuffle some items to create population diversity
  if (random) {
    for (let i = sorted.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    }
  }

  const chromosome: Chromosome = [];
  const dateLoad = new Map<string, number>(availableDates.map((d) => [d, 0]));

  for (const subtopic of sorted) {
    const targetMins = subtopic.estimatedMinutes;

    // Find best-fit date with available capacity
    let bestDate = availableDates[0];
    let bestLoad = Infinity;

    for (const date of availableDates) {
      const load = dateLoad.get(date) ?? 0;
      const remaining = minutesPerDay - load;
      if (remaining >= targetMins && load < bestLoad) {
        bestLoad = load;
        bestDate = date;
      }
    }

    // If no date has enough space, just use least-loaded date
    if (bestLoad === Infinity) {
      bestDate = availableDates.reduce((best, d) =>
        (dateLoad.get(d) ?? 0) < (dateLoad.get(best) ?? 0) ? d : best
      );
    }

    const gene: GASubtopicGene = {
      subtopicId: subtopic.id,
      durationMins: targetMins,
      scheduledDate: bestDate,
      order: chromosome.length,
    };

    chromosome.push(gene);
    dateLoad.set(bestDate, (dateLoad.get(bestDate) ?? 0) + targetMins);
  }

  return chromosome;
}

/**
 * Build the initial population for the GA.
 * First individual is a fully deterministic greedy solution;
 * the rest add randomness for diversity.
 */
export function initPopulation(
  populationSize: number,
  subtopics: SubtopicData[],
  proficiencies: ProficiencyMap,
  availableDates: string[],
  hoursPerDay: number
): Chromosome[] {
  const population: Chromosome[] = [];

  // Seed with one deterministic best-greedy individual
  population.push(
    createIndividual(subtopics, proficiencies, availableDates, hoursPerDay, false)
  );

  // Rest are random variations
  for (let i = 1; i < populationSize; i++) {
    population.push(
      createIndividual(subtopics, proficiencies, availableDates, hoursPerDay, true)
    );
  }

  return population;
}

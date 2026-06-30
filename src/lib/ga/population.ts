import type { Chromosome, GASubtopicGene, SubtopicData, ProficiencyMap, AvailabilitySlotInput } from "@/types";
import { recommendOrder } from "./ordering";

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

export function buildAvailableDates(
  slots: AvailabilitySlotInput[],
  startDate: Date,
  endDate: Date
): string[] {
  const availableDays = new Set(slots.map((s) => s.dayOfWeek));
  const dates: string[] = [];
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const current = new Date(start);
  while (current < end) {
    if (availableDays.has(current.getDay())) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}`);
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function createIndividual(
  subtopics: SubtopicData[],
  proficiencies: ProficiencyMap,
  availableDates: string[],
  slots: AvailabilitySlotInput[],
  random: boolean = false
): Chromosome {
  if (availableDates.length === 0) return [];

  const sorted = random
    ? [...subtopics].sort(() => Math.random() - 0.5)
    : recommendOrder({ subtopics, proficiencies });

  const chromosome: Chromosome = [];
  const dateLoad = new Map<string, number>(availableDates.map((d) => [d, 0]));

  for (const subtopic of sorted) {
    const targetMins = subtopic.estimatedMinutes;

    let bestDate = availableDates[0];
    let bestLoad = Infinity;

    for (const date of availableDates) {
      const load = dateLoad.get(date) ?? 0;
      const capacity = slotMinutesForDate(slots, date);
      const remaining = capacity - load;
      if (remaining >= targetMins && load < bestLoad) {
        bestLoad = load;
        bestDate = date;
      }
    }

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

export function initPopulation(
  populationSize: number,
  subtopics: SubtopicData[],
  proficiencies: ProficiencyMap,
  availableDates: string[],
  slots: AvailabilitySlotInput[]
): Chromosome[] {
  const population: Chromosome[] = [];

  population.push(
    createIndividual(subtopics, proficiencies, availableDates, slots, false)
  );

  for (let i = 1; i < populationSize; i++) {
    population.push(
      createIndividual(subtopics, proficiencies, availableDates, slots, true)
    );
  }

  return population;
}

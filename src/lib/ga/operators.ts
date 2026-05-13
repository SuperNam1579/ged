import type { Chromosome, GASubtopicGene, SubtopicData } from "@/types";

// ─── Selection ─────────────────────────────────────────────────────────────────

export function tournamentSelect(
  population: { chromosome: Chromosome; fitness: number }[],
  tournamentSize: number
): Chromosome {
  let best = population[Math.floor(Math.random() * population.length)];
  for (let i = 1; i < tournamentSize; i++) {
    const candidate = population[Math.floor(Math.random() * population.length)];
    if (candidate.fitness > best.fitness) best = candidate;
  }
  return best.chromosome;
}

// ─── Crossover (Order-based / PMX-inspired) ────────────────────────────────────

export function orderCrossover(
  parent1: Chromosome,
  parent2: Chromosome
): [Chromosome, Chromosome] {
  if (parent1.length === 0 || parent2.length === 0) {
    return [parent1.slice(), parent2.slice()];
  }

  // Build ordered subtopic-id sequences
  const ids1 = parent1.map((g) => g.subtopicId);
  const ids2 = parent2.map((g) => g.subtopicId);

  const allIds = Array.from(new Set([...ids1, ...ids2]));
  const n = allIds.length;

  const cut1 = Math.floor(Math.random() * n);
  const cut2 = Math.floor(Math.random() * n);
  const [start, end] = [Math.min(cut1, cut2), Math.max(cut1, cut2)];

  function buildChild(p1Ids: string[], p2Ids: string[]): string[] {
    const segment = p1Ids.slice(start, end + 1);
    const segSet = new Set(segment);
    const remainder = p2Ids.filter((id) => !segSet.has(id));
    const child: string[] = [];
    let ri = 0;
    for (let i = 0; i < p1Ids.length; i++) {
      if (i >= start && i <= end) {
        child.push(segment[i - start]);
      } else {
        child.push(remainder[ri++] ?? p1Ids[i]);
      }
    }
    return child;
  }

  const childIds1 = buildChild(ids1, ids2);
  const childIds2 = buildChild(ids2, ids1);

  const geneMap1 = new Map(parent1.map((g) => [g.subtopicId, g]));
  const geneMap2 = new Map(parent2.map((g) => [g.subtopicId, g]));

  function idsToChromosome(ids: string[], primary: Map<string, GASubtopicGene>, fallback: Map<string, GASubtopicGene>): Chromosome {
    return ids
      .map((id, i) => {
        const gene = primary.get(id) ?? fallback.get(id);
        if (!gene) return null;
        return { ...gene, subtopicId: id, order: i };
      })
      .filter(Boolean) as Chromosome;
  }

  return [
    idsToChromosome(childIds1, geneMap1, geneMap2),
    idsToChromosome(childIds2, geneMap2, geneMap1),
  ];
}

// ─── Mutation ──────────────────────────────────────────────────────────────────

export function mutate(
  chromosome: Chromosome,
  mutationRate: number,
  availableDates: string[],
  subtopics: SubtopicData[]
): Chromosome {
  const result = chromosome.map((gene) => ({ ...gene }));

  for (let i = 0; i < result.length; i++) {
    if (Math.random() > mutationRate) continue;

    const mutationType = Math.floor(Math.random() * 3);

    if (mutationType === 0 && result.length > 1) {
      // Swap two genes
      const j = Math.floor(Math.random() * result.length);
      [result[i], result[j]] = [result[j], result[i]];
      result[i].order = i;
      result[j].order = j;
    } else if (mutationType === 1 && availableDates.length > 0) {
      // Re-assign to a random available date
      result[i] = {
        ...result[i],
        scheduledDate: availableDates[Math.floor(Math.random() * availableDates.length)],
      };
    } else {
      // Adjust duration ±15 minutes
      const subtopic = subtopics.find((s) => s.id === result[i].subtopicId);
      const base = subtopic?.estimatedMinutes ?? result[i].durationMins;
      const delta = (Math.random() - 0.5) * 30;
      result[i] = {
        ...result[i],
        durationMins: Math.max(15, Math.round(base + delta)),
      };
    }
  }

  return result;
}

// ─── Elitism ───────────────────────────────────────────────────────────────────

export function selectElites<T extends { fitness: number }>(
  population: T[],
  count: number
): T[] {
  return [...population].sort((a, b) => b.fitness - a.fitness).slice(0, count);
}

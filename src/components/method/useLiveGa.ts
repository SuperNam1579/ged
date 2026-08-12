"use client";

import { useCallback, useState } from "react";
import { computeFitness } from "@/lib/ga/fitness";
import { tournamentSelect, orderCrossover, mutate, selectElites } from "@/lib/ga/operators";
import { DEFAULT_CONFIG } from "@/lib/ga/constants";
import { LANDING_SUBJECTS } from "@/components/landing/subjects";
import type { AvailabilitySlotInput, Chromosome, ProficiencyMap, SubtopicData } from "@/types";

/**
 * Runs the real genetic algorithm in the browser.
 *
 * Only `engine.ts` touches Prisma; `fitness`, `operators` and `constants` are
 * pure, so the same scoring the server uses runs here unchanged. Measured at
 * ~100ms for a week-sized problem, so this runs synchronously on click — no
 * worker needed.
 *
 * Two deliberate differences from a production run, both to make the demo
 * legible rather than to flatter it:
 *   1. The population starts fully random. `initPopulation` seeds one
 *      individual from the `recommendOrder` heuristic, which already scores
 *      ~86 — starting there would show almost no evolution.
 *   2. It plans one week over a subset of the curriculum, not the whole
 *      syllabus to the exam date.
 * Every score shown is computed by `computeFitness`; none are authored.
 */

export const POP = DEFAULT_CONFIG.populationSize;
export const GENS = DEFAULT_CONFIG.generations;

/** Snapshots are sampled rather than shown one-per-generation: 100 frames is
 *  too fast to read, 20 is watchable. */
const SAMPLE_EVERY = 5;

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
/** The example learner is free on these weekdays (0=Sun). Wed and Sat are not. */
const FREE_DAYS = [1, 2, 4, 5, 0];

export type Snapshot = {
  generation: number;
  best: number;
  average: number;
  worst: number;
  /** The best chromosome of this generation, grouped by weekday index. */
  week: Record<number, { subject: string; lesson: string }[]>;
};

/** Twelve real lessons from the published curriculum, three per subject. */
function buildSubtopics(): SubtopicData[] {
  const out: SubtopicData[] = [];

  for (const subject of LANDING_SUBJECTS) {
    const flat = subject.categories
      .flatMap((c) => c.topics)
      .flatMap((t) => t.subtopics)
      .slice(0, 3);

    flat.forEach((sub, i) => {
      out.push({
        id: `${subject.code}-${i}`,
        name: sub.name,
        topicId: subject.code,
        subjectCode: subject.code,
        estimatedMinutes: sub.minutes,
        difficultyLevel: i + 2,
        // A real chain within each subject: the second lesson needs the first.
        prerequisiteIds: i > 0 ? [`${subject.code}-${i - 1}`] : [],
      });
    });
  }

  return out;
}

const SUBTOPICS = buildSubtopics();

const SLOTS: AvailabilitySlotInput[] = FREE_DAYS.map((dayOfWeek) => ({
  dayOfWeek,
  startTime: "17:00",
  endTime: "20:00",
}));

/**
 * Format as YYYY-MM-DD in *local* time.
 *
 * Not `toISOString()`: east of UTC that converts local midnight to the previous
 * day, so every session landed one weekday early and the winner appeared to
 * book the days the learner had marked busy.
 */
function localISODate(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** The next seven days, keeping only the ones the example learner is free. */
function weekDates(): string[] {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base.getTime() + i * 86400000);
    if (FREE_DAYS.includes(d.getDay())) dates.push(localISODate(d));
  }
  return dates;
}

/**
 * One example learner. There is no signed-in user on a public page, so the
 * proficiencies have to come from somewhere — these are an example, and the
 * page says so. The lessons and their durations are the real curriculum.
 */
function exampleProficiencies(): ProficiencyMap {
  const map: ProficiencyMap = {};
  // Weakest at Math, strongest at Social Studies, so "most time where you're
  // weakest" has something real to act on.
  const bySubject: Record<string, number> = { MATH: 25, SCI: 45, RLA: 65, SS: 80 };
  SUBTOPICS.forEach((s, i) => {
    const base = bySubject[s.subjectCode] ?? 50;
    map[s.id] = Math.max(5, Math.min(95, base + ((i * 7) % 21) - 10));
  });
  return map;
}

export function runGaInBrowser(): Snapshot[] {
  const availableDates = weekDates();
  const proficiencies = exampleProficiencies();
  const ctx = {
    subtopics: SUBTOPICS,
    proficiencies,
    slots: SLOTS,
    availableDates,
    subjectCodes: [...new Set(SUBTOPICS.map((s) => s.subjectCode))],
  };

  const randomChromosome = (): Chromosome => {
    const shuffled = [...SUBTOPICS].sort(() => Math.random() - 0.5);
    return shuffled.map((s, i) => ({
      subtopicId: s.id,
      durationMins: s.estimatedMinutes,
      scheduledDate: availableDates[Math.floor(Math.random() * availableDates.length)],
      order: i,
    }));
  };

  const score = (c: Chromosome) => {
    const breakdown = computeFitness(c, ctx);
    return { chromosome: c, fitness: breakdown.total, fitnessBreakdown: breakdown };
  };

  let population = Array.from({ length: POP }, randomChromosome).map(score);
  const snapshots: Snapshot[] = [];

  const capture = (generation: number) => {
    const fits = population.map((i) => i.fitness);
    const best = Math.max(...fits);
    const winner = population.find((i) => i.fitness === best)!;

    const week: Snapshot["week"] = {};
    for (const gene of winner.chromosome) {
      const day = new Date(`${gene.scheduledDate}T00:00:00`).getDay();
      const subtopic = SUBTOPICS.find((s) => s.id === gene.subtopicId);
      if (!subtopic) continue;
      (week[day] ??= []).push({ subject: subtopic.subjectCode, lesson: subtopic.name });
    }

    snapshots.push({
      generation,
      best: Math.round(best * 100),
      average: Math.round((fits.reduce((a, b) => a + b, 0) / fits.length) * 100),
      worst: Math.round(Math.min(...fits) * 100),
      week,
    });
  };

  for (let gen = 0; gen < GENS; gen++) {
    if (gen % SAMPLE_EVERY === 0) capture(gen + 1);

    const next = [...selectElites(population, DEFAULT_CONFIG.elitismCount)];
    while (next.length < POP) {
      const p1 = tournamentSelect(population, DEFAULT_CONFIG.tournamentSize);
      const p2 = tournamentSelect(population, DEFAULT_CONFIG.tournamentSize);
      let [c1, c2] =
        Math.random() < DEFAULT_CONFIG.crossoverRate
          ? orderCrossover(p1, p2)
          : [p1.slice(), p2.slice()];
      c1 = mutate(c1, DEFAULT_CONFIG.mutationRate, availableDates, SUBTOPICS);
      c2 = mutate(c2, DEFAULT_CONFIG.mutationRate, availableDates, SUBTOPICS);
      for (const child of [c1, c2]) {
        if (next.length >= POP) break;
        next.push(score(child));
      }
    }
    population = next;
  }

  capture(GENS);
  return snapshots;
}

/** Owns one run and the playback position within it. */
export function useLiveGa() {
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const [frame, setFrame] = useState(0);

  const start = useCallback(() => {
    setSnapshots(runGaInBrowser());
    setFrame(0);
  }, []);

  return { snapshots, frame, setFrame, start };
}

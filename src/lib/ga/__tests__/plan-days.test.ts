import { describe, expect, it, vi } from "vitest";

// planDays is pure, but engine.ts also holds the Prisma-backed savePlan.
vi.mock("@/lib/db", () => ({ db: {} }));

import { planDays } from "../engine";
import type { WorkItem } from "@/lib/schedule/parts";
import type { SubtopicData } from "@/types";

const SUBJECTS = ["MATH", "SCI", "RLA", "SS"];

/** n subtopics of 3 units × 3 lessons of 10 minutes: 90 minutes each. */
function curriculum(n: number): { subtopics: SubtopicData[]; items: WorkItem[] } {
  const subtopics: SubtopicData[] = [];
  const items: WorkItem[] = [];
  for (let i = 0; i < n; i++) {
    const id = `s${i}`;
    const subjectCode = SUBJECTS[i % SUBJECTS.length];
    subtopics.push({ id, name: id, topicId: "t", subjectCode, estimatedMinutes: 90, difficultyLevel: (i % 5) + 1, prerequisiteIds: [] });
    items.push({
      subtopicId: id,
      subjectCode,
      difficultyLevel: (i % 5) + 1,
      prerequisiteIds: [],
      clips: Array.from({ length: 9 }, (_, c) => ({
        resourceId: `${id}-c${c}`,
        unitKey: `${id}-u${Math.floor(c / 3)}`,
        lessonKey: `${id}-l${c}`,
        minutes: 10,
      })),
      atomicMinutes: 0,
      started: false,
    });
  }
  return { subtopics, items };
}

function dates(from: string, n: number): string[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(start + i * 86400000).toISOString().slice(0, 10));
}

describe("planDays — one run from today to the exam", () => {
  it("spreads the plan over every week, keeping each day within its own length", () => {
    const { subtopics, items } = curriculum(40);
    // 50 days; the first three weeks 60 min a day, then 120 min a day.
    const days = dates("2026-10-03", 50).map((date, i) => ({ date, capacity: i < 21 ? 60 : 120 }));

    const plan = planDays({ items, subtopics, proficiencies: {}, days, config: { generations: 5, populationSize: 8 } })!;

    const byDay = new Map<string, number>();
    for (const s of plan.sessions) byDay.set(s.scheduledDate, (byDay.get(s.scheduledDate) ?? 0) + s.durationMins);
    for (const d of days) expect(byDay.get(d.date) ?? 0).toBeLessThanOrEqual(d.capacity);

    // 40 × 90 = 3600 minutes needed, 21×60 + 29×120 = 4740 available: all of it fits.
    expect(plan.leftovers).toHaveLength(0);
    expect(new Set(plan.sessions.map((s) => s.scheduledDate)).size).toBeGreaterThan(35);
    expect(plan.sessions.at(-1)!.scheduledDate > "2026-11-01").toBe(true);
  });

  it("skips days with no time and returns what doesn't fit before the exam", () => {
    const { subtopics, items } = curriculum(20);
    const days = dates("2026-10-05", 14).map((date, i) => ({ date, capacity: i % 7 === 6 ? 0 : 90 }));

    const plan = planDays({ items, subtopics, proficiencies: {}, days, config: { generations: 5, populationSize: 8 } })!;

    expect(plan.sessions.some((s) => s.scheduledDate === "2026-10-11")).toBe(false); // a Sunday off
    // 12 study days × 90 minutes hold 12 subtopics; the other 8 are left over.
    expect(plan.sessions).toHaveLength(12);
    expect(plan.leftovers).toHaveLength(8);
  });

  it("returns null when there is no study time", () => {
    const { subtopics, items } = curriculum(3);
    const days = dates("2026-10-05", 7).map((date) => ({ date, capacity: 0 }));
    expect(planDays({ items, subtopics, proficiencies: {}, days })).toBeNull();
  });
});

describe("planDays — reproducible, with a baseline", () => {
  const { subtopics, items } = curriculum(24);
  const days = dates("2026-10-05", 21).map((date) => ({ date, capacity: 120 }));
  const proficiencies = Object.fromEntries(subtopics.map((s, i) => [s.id, (i * 37) % 100]));
  const run = (seed?: number) =>
    planDays({ items, subtopics, proficiencies, days, seed, config: { generations: 10, populationSize: 10 } })!;

  it("gives the same plan for the same seed", () => {
    const a = run(1234);
    const b = run(1234);
    expect(a.seed).toBe(1234);
    expect(b.sessions).toEqual(a.sessions);
    expect(b.fitness.total).toBe(a.fitness.total);
  });

  it("records a fresh seed when none is given, and the fitness without the GA", () => {
    const plan = run();
    expect(Number.isInteger(plan.seed)).toBe(true);
    expect(plan.baseline.total).toBeGreaterThan(0);
    // The GA starts from the recommended order among others and keeps its elites.
    expect(plan.fitness.total).toBeGreaterThanOrEqual(plan.baseline.total - 1e-9);
  });
});

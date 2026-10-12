import { describe, expect, it } from "vitest";
import { PACE_MARGIN, paceShare, scaleDays } from "../pace";
import { packDays, type WorkItem } from "../parts";
import type { SubtopicData } from "@/types";

/** n subtopics, each 3 units × 3 lessons of 10-minute clips: 90 minutes. */
function curriculum(n: number) {
  const subtopics: SubtopicData[] = [];
  const items: WorkItem[] = [];
  for (let i = 0; i < n; i++) {
    const id = `s${i}`;
    subtopics.push({ id, name: id, topicId: "t", subjectCode: "MATH", estimatedMinutes: 90, difficultyLevel: 3, prerequisiteIds: [] });
    items.push({
      subtopicId: id,
      subjectCode: "MATH",
      difficultyLevel: 3,
      prerequisiteIds: [],
      clips: Array.from({ length: 9 }, (_, c) => ({
        resourceId: `${id}-${c}`,
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
const days = (n: number, capacity: number) =>
  Array.from({ length: n }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, 12 + i)).toISOString().slice(0, 10), capacity }));

describe("paceShare", () => {
  it("spreads plenty of time evenly instead of filling the first weeks", () => {
    const { subtopics, items } = curriculum(10); // 900 minutes
    const run = days(60, 180); // 10,800 minutes: 8% needed
    const share = paceShare({ items, days: run, subtopics, proficiencies: {} });
    expect(share).toBeLessThan(0.5);

    const full = packDays(items, run).placements;
    const paced = packDays(items, scaleDays(run, share)).placements;
    const lastDay = (p: { date: string }[]) => p.map((x) => x.date).sort().at(-1)!;
    expect(lastDay(full) < "2026-10-20").toBe(true); // full days: done in a week
    expect(lastDay(paced) > "2026-11-20").toBe(true); // paced: spread across the run
    expect(packDays(items, scaleDays(run, share)).leftovers).toHaveLength(0);
  });

  it("is the tightest share that fits, raised by the margin", () => {
    const { subtopics, items } = curriculum(10);
    const run = days(60, 180);
    const share = paceShare({ items, days: run, subtopics, proficiencies: {} });
    const tightest = share / (1 + PACE_MARGIN);
    expect(packDays(items, scaleDays(run, tightest)).leftovers).toHaveLength(0);
    expect(packDays(items, scaleDays(run, tightest * 0.8)).leftovers.length).toBeGreaterThan(0);
  });

  it("keeps full days when the content needs them", () => {
    const { subtopics, items } = curriculum(20); // 1800 minutes
    expect(paceShare({ items, days: days(15, 120), subtopics, proficiencies: {} })).toBe(1); // 1800 of 1800
    expect(paceShare({ items, days: days(5, 120), subtopics, proficiencies: {} })).toBe(1); // doesn't fit at all
  });
});

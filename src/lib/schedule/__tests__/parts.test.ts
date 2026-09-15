import { describe, expect, it } from "vitest";
import { packDays, remainingMinutes, takeCount, type Clip, type Day, type WorkItem } from "../parts";

// Fractions as it is in the curriculum today: 5 units, lesson study-minutes as
// computed from the real clip runtimes (rounded). One clip per lesson keeps the
// fixture readable; the cutting rules only look at unit/lesson runs.
const FRACTIONS_UNITS: [string, number[]][] = [
  ["Unit 4", [8, 10, 15, 13, 24]],
  ["Unit 9", [25, 22, 13, 7, 13, 14, 15]],
  ["Unit 13", [21, 12, 24, 18, 12]],
  ["Unit 10", [4, 8, 3, 11, 11, 11, 16, 14, 11]],
  ["Unit 15", [19, 7, 6, 6, 33, 3]],
];

function clipsFrom(prefix: string, units: [string, number[]][]): Clip[] {
  return units.flatMap(([unit, lessons]) =>
    lessons.map((minutes, i) => ({
      resourceId: `${prefix}-${unit}-L${i}`,
      unitKey: `${prefix}-${unit}`,
      lessonKey: `${prefix}-${unit}-L${i}`,
      minutes,
    }))
  );
}

function item(id: string, clips: Clip[], extra: Partial<WorkItem> = {}): WorkItem {
  return {
    subtopicId: id,
    subjectCode: "MATH",
    difficultyLevel: 3,
    prerequisiteIds: [],
    clips,
    atomicMinutes: 0,
    started: false,
    ...extra,
  };
}

const atomic = (id: string, minutes: number, extra: Partial<WorkItem> = {}) =>
  item(id, [], { atomicMinutes: minutes, subjectCode: "RLA", ...extra });

const weekdays = (capacity: number, n = 5): Day[] =>
  Array.from({ length: n }, (_, i) => ({ date: `2026-09-${String(21 + i).padStart(2, "0")}`, capacity }));

const unitsOf = (resourceIds: string[]) => [...new Set(resourceIds.map((r) => r.split("-L")[0]))];

const fractions = () => item("fractions", clipsFrom("fr", FRACTIONS_UNITS));
const totalOf = (units: [string, number[]][]) => units.flatMap(([, l]) => l).reduce((a, b) => a + b, 0);

describe("packDays — cutting at unit boundaries (ข3)", () => {
  it("splits Fractions into one session per unit on two-hour evenings", () => {
    const { placements, leftovers } = packDays([fractions()], weekdays(120));

    expect(placements.map((p) => unitsOf(p.resourceIds))).toEqual([
      ["fr-Unit 4"], ["fr-Unit 9"], ["fr-Unit 13"], ["fr-Unit 10"], ["fr-Unit 15"],
    ]);
    expect(placements.map((p) => p.date)).toEqual(weekdays(120).map((d) => d.date));
    expect(leftovers).toEqual([]);
  });

  it("never loses or repeats content: every clip lands exactly once, in curriculum order", () => {
    const source = fractions();
    const { placements } = packDays([source], weekdays(120));
    const scheduled = placements.flatMap((p) => p.resourceIds);

    expect(scheduled).toEqual(source.clips.map((c) => c.resourceId));
    expect(placements.reduce((a, p) => a + p.minutes, 0)).toBeCloseTo(totalOf(FRACTIONS_UNITS));
  });

  it("puts two whole units in one session when both fit", () => {
    const { placements } = packDays([fractions()], weekdays(200, 3));
    expect(unitsOf(placements[0].resourceIds)).toEqual(["fr-Unit 4", "fr-Unit 9"]);
  });

  it("cuts a unit at lesson boundaries only when the unit is longer than a whole day", () => {
    // One-hour evenings: Unit 9 (109 min) can never fit a day, so it is split —
    // but Unit 4 (70 min) is also longer than an hour, and Unit 13 (87) too.
    const { placements } = packDays([fractions()], weekdays(60, 12));
    for (const p of placements) {
      expect(p.minutes).toBeLessThanOrEqual(60);
      // A session never straddles two units once units themselves are cut.
      expect(unitsOf(p.resourceIds)).toHaveLength(1);
    }
    const unit9Sessions = placements.filter((p) => unitsOf(p.resourceIds)[0] === "fr-Unit 9");
    expect(unit9Sessions.length).toBeGreaterThan(1);
    // Lessons stay whole: each resource (= lesson here) appears in one session.
    const all = placements.flatMap((p) => p.resourceIds);
    expect(new Set(all).size).toBe(all.length);
  });

  it("does not cut a unit that fits in a day just because today is partly used", () => {
    const short = atomic("short", 60);
    const unit90 = item("u", clipsFrom("u", [["U", [30, 30, 30]]]));
    const { placements } = packDays([short, unit90], weekdays(120, 2));

    // Day 1: 60 min left, the 90-min unit fits a day → it waits for day 2 whole.
    expect(placements.filter((p) => p.date === "2026-09-21").map((p) => p.subtopicId)).toEqual(["short"]);
    const day2 = placements.filter((p) => p.date === "2026-09-22");
    expect(day2).toHaveLength(1);
    expect(day2[0].resourceIds).toHaveLength(3);
  });

  it("cuts a lesson at clip boundaries only when the lesson is longer than a day", () => {
    const longLesson: Clip[] = [20, 20, 20].map((m, i) => ({ resourceId: `c${i}`, unitKey: "U", lessonKey: "L", minutes: m }));
    const { placements } = packDays([item("x", longLesson)], weekdays(45, 3));
    expect(placements.map((p) => p.resourceIds)).toEqual([["c0", "c1"], ["c2"]]);
  });

  it("gives a single clip longer than a day a day to itself rather than never scheduling it", () => {
    const huge: Clip[] = [{ resourceId: "big", unitKey: "U", lessonKey: "L", minutes: 150 }];
    const { placements, leftovers } = packDays([atomic("a", 20), item("x", huge)], weekdays(120, 2));
    expect(placements.find((p) => p.subtopicId === "x")?.date).toBe("2026-09-22");
    expect(leftovers).toEqual([]);
  });
});

describe("packDays — filling days (ก1)", () => {
  it("fills the time left after a unit with a shorter subtopic", () => {
    const circles = atomic("circles", 37, { subjectCode: "MATH" });
    const { placements } = packDays([fractions(), circles], weekdays(120));
    const monday = placements.filter((p) => p.date === "2026-09-21");
    expect(monday.map((p) => p.subtopicId)).toEqual(["fractions", "circles"]);
  });

  it("starts every day with the subtopic already in progress", () => {
    const other = atomic("other", 50);
    const { placements } = packDays([fractions(), other], weekdays(120));
    for (const date of weekdays(120).map((d) => d.date)) {
      const first = placements.find((p) => p.date === date);
      if (placements.some((p) => p.date === date && p.subtopicId === "fractions")) {
        expect(first?.subtopicId).toBe("fractions");
      }
    }
  });

  it("does not start a subtopic before its unfinished prerequisite", () => {
    const prereq = item("prereq", clipsFrom("p", [["A", [100]], ["B", [100]]]));
    const dependent = atomic("dependent", 15, { prerequisiteIds: ["prereq"] });
    const { placements } = packDays([prereq, dependent], weekdays(120, 3));

    const depDay = placements.find((p) => p.subtopicId === "dependent")!.date;
    const lastPrereqDay = placements.filter((p) => p.subtopicId === "prereq").map((p) => p.date).sort().at(-1)!;
    expect(depDay >= lastPrereqDay).toBe(true);
  });

  it("returns what doesn't fit as leftovers that continue first next time", () => {
    const first = packDays([fractions(), atomic("next", 30)], weekdays(120, 2));
    expect(first.leftovers.map((l) => l.subtopicId)).toEqual(["fractions", "next"].filter((id) =>
      first.leftovers.some((l) => l.subtopicId === id)
    ));
    const carried = first.leftovers.find((l) => l.subtopicId === "fractions")!;
    expect(carried.started).toBe(true);
    expect(unitsOf(carried.clips.map((c) => c.resourceId))[0]).toBe("fr-Unit 13");

    const second = packDays(first.leftovers, weekdays(120, 1));
    expect(second.placements[0].subtopicId).toBe("fractions");
    expect(unitsOf(second.placements[0].resourceIds)).toEqual(["fr-Unit 13"]);
  });

  it("does not start a subtopic in leftover room with a sliver of a too-long unit", () => {
    // 200-min unit (longer than a day) behind a 100-min subtopic: day 1 has 20
    // min left, but the long unit waits for a fresh day instead of starting there.
    const first = atomic("first", 100);
    const long = item("long", clipsFrom("l", [["U", [10, 60, 60, 70]]]));
    const { placements } = packDays([first, long], weekdays(120, 3));

    expect(placements.filter((p) => p.date === "2026-09-21").map((p) => p.subtopicId)).toEqual(["first"]);
    const longDays = placements.filter((p) => p.subtopicId === "long").map((p) => p.date);
    expect(longDays[0]).toBe("2026-09-22");
    // Once started it continues on consecutive days.
    expect(longDays).toEqual(["2026-09-22", "2026-09-23"]);
  });

  it("does not mutate its inputs", () => {
    const f = fractions();
    const before = remainingMinutes(f);
    packDays([f], weekdays(120, 2));
    expect(remainingMinutes(f)).toBe(before);
    expect(f.started).toBe(false);
  });
});

describe("takeCount", () => {
  const clips = clipsFrom("t", [["A", [30, 30]], ["B", [50]]]);

  it("takes whole units that fit", () => {
    expect(takeCount(clips, 120, 120, true)).toBe(3);
    expect(takeCount(clips, 60, 120, true)).toBe(2);
  });

  it("returns 0 when the next unit fits a day but not the room left", () => {
    expect(takeCount(clips, 59, 120, false)).toBe(0);
  });

  it("returns 0 with no room", () => {
    expect(takeCount(clips, 0, 120, true)).toBe(0);
  });
});

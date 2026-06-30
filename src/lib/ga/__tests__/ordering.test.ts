import { describe, it, expect } from "vitest";
import { recommendOrder } from "../ordering";
import type { SubtopicData } from "@/types";

function makeSub(
  id: string,
  subjectCode: string,
  difficultyLevel: number,
  prerequisiteIds: string[] = []
): SubtopicData {
  return { id, name: id, topicId: "t1", subjectCode, estimatedMinutes: 60, difficultyLevel, prerequisiteIds };
}

// isHeavy mirrors the logic in constants.ts — used only for assertions
const HEAVY_SUBS = new Set(["MATH", "SCI"]);
const heavy = (s: SubtopicData) => HEAVY_SUBS.has(s.subjectCode) || s.difficultyLevel >= 4;

// ─── basic ────────────────────────────────────────────────────────────────────

describe("recommendOrder — basic", () => {
  it("returns empty array for empty input", () => {
    expect(recommendOrder({ subtopics: [], proficiencies: {} })).toEqual([]);
  });

  it("returns a single subtopic unchanged", () => {
    const result = recommendOrder({ subtopics: [makeSub("a", "MATH", 3)], proficiencies: {} });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });

  it("returns all subtopics (no duplicates, no drops)", () => {
    const subs = [makeSub("a", "MATH", 3), makeSub("b", "THAI", 2), makeSub("c", "SCI", 4)];
    const result = recommendOrder({ subtopics: subs, proficiencies: {} });
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.id).sort()).toEqual(["a", "b", "c"]);
  });
});

// ─── prerequisite ordering ────────────────────────────────────────────────────

describe("recommendOrder — prerequisite ordering", () => {
  it("places the prerequisite before its dependent", () => {
    const subs = [
      makeSub("b", "MATH", 3, ["a"]), // b requires a
      makeSub("a", "MATH", 2),
    ];
    const result = recommendOrder({ subtopics: subs, proficiencies: {} });
    expect(result.findIndex((s) => s.id === "a")).toBeLessThan(
      result.findIndex((s) => s.id === "b")
    );
  });

  it("respects a chain: a → b → c", () => {
    const subs = [
      makeSub("c", "MATH", 3, ["b"]),
      makeSub("b", "MATH", 2, ["a"]),
      makeSub("a", "MATH", 1),
    ];
    const result = recommendOrder({ subtopics: subs, proficiencies: {} });
    const idx = (id: string) => result.findIndex((s) => s.id === id);
    expect(idx("a")).toBeLessThan(idx("b"));
    expect(idx("b")).toBeLessThan(idx("c"));
  });

  it("schedules a subtopic whose prerequisite is not in the pool", () => {
    // "z" is not in the subtopic list — should not block "a"
    const result = recommendOrder({
      subtopics: [makeSub("a", "MATH", 3, ["z"])],
      proficiencies: {},
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });

  it("handles prerequisite cycles without hanging, returning all subtopics", () => {
    const subs = [
      makeSub("a", "MATH", 3, ["b"]),
      makeSub("b", "MATH", 3, ["a"]),
    ];
    const result = recommendOrder({ subtopics: subs, proficiencies: {} });
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id).sort()).toEqual(["a", "b"]);
  });
});

// ─── weakness-first ───────────────────────────────────────────────────────────

describe("recommendOrder — weakness-first", () => {
  it("places a weak subtopic (prof=20) before a strong one (prof=90)", () => {
    const subs = [makeSub("strong", "THAI", 2), makeSub("weak", "THAI", 2)];
    const result = recommendOrder({
      subtopics: subs,
      proficiencies: { strong: 90, weak: 20 },
    });
    expect(result[0].id).toBe("weak");
  });

  it("places all weak subtopics before all strong ones when no prereqs exist", () => {
    const subs = [
      makeSub("s1", "THAI", 2),
      makeSub("w1", "THAI", 2),
      makeSub("s2", "THAI", 2),
      makeSub("w2", "THAI", 2),
    ];
    const result = recommendOrder({
      subtopics: subs,
      proficiencies: { s1: 80, s2: 90, w1: 10, w2: 30 },
    });
    const weakIdxs = ["w1", "w2"].map((id) => result.findIndex((s) => s.id === id));
    const strongIdxs = ["s1", "s2"].map((id) => result.findIndex((s) => s.id === id));
    expect(Math.max(...weakIdxs)).toBeLessThan(Math.min(...strongIdxs));
  });
});

// ─── heavy/light alternation ──────────────────────────────────────────────────

describe("recommendOrder — heavy/light alternation", () => {
  it("does not place two heavy subjects consecutively when a light alternative exists", () => {
    // All equally weak (prof=0) so weakness score is the same — alternation is the only differentiator
    const subs = [
      makeSub("m1", "MATH", 5), // heavy: MATH + diff>=4
      makeSub("m2", "MATH", 5), // heavy
      makeSub("t1", "THAI", 1), // light
      makeSub("t2", "THAI", 1), // light
    ];
    const result = recommendOrder({
      subtopics: subs,
      proficiencies: { m1: 0, m2: 0, t1: 0, t2: 0 },
    });
    for (let i = 0; i < result.length - 1; i++) {
      expect(
        heavy(result[i]) && heavy(result[i + 1]),
        `positions ${i} and ${i + 1} are both heavy`
      ).toBe(false);
    }
  });
});

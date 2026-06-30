import { describe, it, expect } from "vitest";
import { computeFitness } from "../fitness";
import type { SubtopicData, GASubtopicGene, ProficiencyMap, AvailabilitySlotInput } from "@/types";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeSub(
  id: string,
  subjectCode: string,
  difficultyLevel: number,
  prerequisiteIds: string[] = []
): SubtopicData {
  return { id, name: id, topicId: "t1", subjectCode, estimatedMinutes: 60, difficultyLevel, prerequisiteIds };
}

function makeGene(
  subtopicId: string,
  scheduledDate: string,
  order: number,
  durationMins = 60
): GASubtopicGene {
  return { subtopicId, scheduledDate, order, durationMins };
}

const D1 = "2026-07-01";
const D2 = "2026-07-02";
const D3 = "2026-07-03";

function ctx(
  subtopics: SubtopicData[],
  proficiencies: ProficiencyMap = {},
  opts: { hoursPerDay?: number; availableDates?: string[]; subjectCodes?: string[] } = {}
) {
  const hoursPerDay = opts.hoursPerDay ?? 4;
  const availableDates = opts.availableDates ?? [D1, D2, D3];
  const endHour = 8 + hoursPerDay;
  const endTime = `${String(endHour).padStart(2, "0")}:00`;
  const dows = [...new Set(availableDates.map((d) => new Date(d).getDay()))];
  const slots: AvailabilitySlotInput[] = dows.map((dow) => ({
    dayOfWeek: dow,
    startTime: "08:00",
    endTime,
  }));
  return {
    subtopics,
    proficiencies,
    slots,
    availableDates,
    subjectCodes: opts.subjectCodes ?? [...new Set(subtopics.map((s) => s.subjectCode))],
  };
}

// ─── empty chromosome ─────────────────────────────────────────────────────────

describe("empty chromosome", () => {
  it("returns 0 for every component", () => {
    const result = computeFitness([], ctx([]));
    expect(result.coverage).toBe(0);
    expect(result.weaknessFocus).toBe(0);
    expect(result.timeFeasibility).toBe(0);
    expect(result.prerequisiteOrder).toBe(0);
    expect(result.variety).toBe(0);
    expect(result.balance).toBe(0);
    expect(result.total).toBe(0);
  });
});

// ─── total ────────────────────────────────────────────────────────────────────

describe("total", () => {
  it("is always in [0, 1]", () => {
    const subs = [makeSub("a", "MATH", 3), makeSub("b", "THAI", 2)];
    const result = computeFitness(
      [makeGene("a", D1, 0), makeGene("b", D1, 1)],
      ctx(subs, { a: 30, b: 90 })
    );
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(1);
  });

  it("equals the weighted sum of all components", () => {
    const subs = [makeSub("a", "MATH", 3), makeSub("b", "THAI", 2)];
    const result = computeFitness(
      [makeGene("a", D1, 0), makeGene("b", D2, 0)],
      ctx(subs, { a: 30, b: 80 })
    );
    const expected =
      result.coverage * 0.25 +
      result.weaknessFocus * 0.2 +
      result.timeFeasibility * 0.15 +
      result.prerequisiteOrder * 0.15 +
      result.variety * 0.15 +
      result.balance * 0.1;
    expect(result.total).toBeCloseTo(expected, 10);
  });
});

// ─── coverage ─────────────────────────────────────────────────────────────────

describe("coverage", () => {
  it("= 1 when all weak subtopics (prof < 60) are scheduled", () => {
    const subs = [makeSub("a", "MATH", 3), makeSub("b", "THAI", 2)];
    const { coverage } = computeFitness(
      [makeGene("a", D1, 0), makeGene("b", D1, 1)],
      ctx(subs, { a: 30, b: 30 })
    );
    expect(coverage).toBe(1);
  });

  it("= 0 when no weak subtopics are scheduled", () => {
    const subs = [makeSub("a", "MATH", 3), makeSub("b", "THAI", 2)];
    const { coverage } = computeFitness([], ctx(subs, { a: 30, b: 30 }));
    expect(coverage).toBe(0);
  });

  it("is proportional when only some critical subtopics are covered", () => {
    const subs = [makeSub("a", "MATH", 3), makeSub("b", "THAI", 2), makeSub("c", "SCI", 2)];
    // covers 1 of 3 weak subtopics
    const { coverage } = computeFitness(
      [makeGene("a", D1, 0)],
      ctx(subs, { a: 20, b: 20, c: 20 })
    );
    expect(coverage).toBeCloseTo(1 / 3);
  });

  it("uses scheduled / total fraction when no weak subtopics exist", () => {
    const subs = [makeSub("a", "MATH", 3), makeSub("b", "THAI", 2)];
    // 1 of 2 scheduled, both strong
    const { coverage } = computeFitness(
      [makeGene("a", D1, 0)],
      ctx(subs, { a: 90, b: 90 })
    );
    expect(coverage).toBeCloseTo(0.5);
  });
});

// ─── weaknessFocus ────────────────────────────────────────────────────────────

describe("weaknessFocus", () => {
  it("= 0 when chromosome targets only fully-mastered subtopics", () => {
    const subs = [makeSub("a", "MATH", 3)];
    const { weaknessFocus } = computeFitness(
      [makeGene("a", D1, 0)],
      ctx(subs, { a: 100 })
    );
    expect(weaknessFocus).toBe(0);
  });

  it("is higher when targeting weaker subtopics", () => {
    const subs = [makeSub("weak", "MATH", 3), makeSub("strong", "MATH", 2)];
    const profs = { weak: 0, strong: 100 };
    const c = ctx(subs, profs);
    const wfWeak = computeFitness([makeGene("weak", D1, 0)], c).weaknessFocus;
    const wfStrong = computeFitness([makeGene("strong", D1, 0)], c).weaknessFocus;
    expect(wfWeak).toBeGreaterThan(wfStrong);
  });

  it("is weighted by session duration", () => {
    const subs = [makeSub("weak", "MATH", 3), makeSub("strong", "MATH", 2)];
    const profs = { weak: 0, strong: 100 };
    const c = ctx(subs, profs);
    // same two sessions but weak gets double time
    const longWeak = computeFitness(
      [makeGene("weak", D1, 0, 120), makeGene("strong", D1, 1, 60)],
      c
    ).weaknessFocus;
    const equalTime = computeFitness(
      [makeGene("weak", D1, 0, 60), makeGene("strong", D1, 1, 60)],
      c
    ).weaknessFocus;
    expect(longWeak).toBeGreaterThan(equalTime);
  });
});

// ─── timeFeasibility ──────────────────────────────────────────────────────────

describe("timeFeasibility", () => {
  const subs = [makeSub("a", "MATH", 3)];

  it("= 1 when sessions are on valid dates and within the daily time limit", () => {
    const { timeFeasibility } = computeFitness(
      [makeGene("a", D1, 0, 60)],
      ctx(subs, {}, { hoursPerDay: 4, availableDates: [D1] })
    );
    expect(timeFeasibility).toBe(1);
  });

  it("penalises sessions scheduled on unavailable dates", () => {
    const { timeFeasibility } = computeFitness(
      [makeGene("a", "2099-01-01", 0, 60)],
      ctx(subs, {}, { availableDates: [D1] })
    );
    expect(timeFeasibility).toBeLessThan(1);
  });

  it("penalises days that exceed 120% of the daily time limit", () => {
    // limit = 2 hr = 120 min; 120% cap = 144 min; 150 min triggers violation
    const { timeFeasibility } = computeFitness(
      [makeGene("a", D1, 0, 150)],
      ctx(subs, {}, { hoursPerDay: 2, availableDates: [D1] })
    );
    expect(timeFeasibility).toBeLessThan(1);
  });

  it("does not penalise days within the 120% grace period", () => {
    // limit = 2 hr = 120 min; 120% cap = 144 min; 140 min is fine
    const { timeFeasibility } = computeFitness(
      [makeGene("a", D1, 0, 140)],
      ctx(subs, {}, { hoursPerDay: 2, availableDates: [D1] })
    );
    expect(timeFeasibility).toBe(1);
  });
});

// ─── prerequisiteOrder ────────────────────────────────────────────────────────

describe("prerequisiteOrder", () => {
  it("= 1 when all prerequisites appear before their dependents", () => {
    const subs = [makeSub("a", "MATH", 2), makeSub("b", "MATH", 3, ["a"])];
    const { prerequisiteOrder } = computeFitness(
      [makeGene("a", D1, 0), makeGene("b", D1, 1)],
      ctx(subs)
    );
    expect(prerequisiteOrder).toBe(1);
  });

  it("= 0 when all prerequisites appear after their dependents", () => {
    const subs = [makeSub("a", "MATH", 2), makeSub("b", "MATH", 3, ["a"])];
    // b before a — violates the prerequisite
    const { prerequisiteOrder } = computeFitness(
      [makeGene("b", D1, 0), makeGene("a", D1, 1)],
      ctx(subs)
    );
    expect(prerequisiteOrder).toBe(0);
  });

  it("= 1 when there are no prerequisites to violate", () => {
    const subs = [makeSub("a", "MATH", 2), makeSub("b", "THAI", 2)];
    const { prerequisiteOrder } = computeFitness(
      [makeGene("a", D1, 0), makeGene("b", D1, 1)],
      ctx(subs)
    );
    expect(prerequisiteOrder).toBe(1);
  });

  it("does not count a missing prerequisite as a violation", () => {
    // "z" is not scheduled — coverage handles this, not ordering
    const subs = [makeSub("a", "MATH", 2, ["z"])];
    const { prerequisiteOrder } = computeFitness([makeGene("a", D1, 0)], ctx(subs));
    expect(prerequisiteOrder).toBe(1);
  });

  it("is partial when only some prerequisites are violated", () => {
    const subs = [
      makeSub("a", "MATH", 1),
      makeSub("b", "MATH", 2, ["a"]),
      makeSub("c", "MATH", 3, ["b"]),
    ];
    // a and b are correct (a→b), but c violates its prereq b (c before b)
    const chromosome = [
      makeGene("a", D1, 0),
      makeGene("c", D1, 1), // c before b — violation
      makeGene("b", D1, 2),
    ];
    const { prerequisiteOrder } = computeFitness(chromosome, ctx(subs));
    expect(prerequisiteOrder).toBeGreaterThan(0);
    expect(prerequisiteOrder).toBeLessThan(1);
  });
});

// ─── balance ─────────────────────────────────────────────────────────────────

describe("balance", () => {
  it("= 1 when each day has exactly one session (no adjacent pairs, uniform load)", () => {
    const subs = [makeSub("a", "MATH", 3), makeSub("b", "MATH", 3)];
    const { balance } = computeFitness(
      [makeGene("a", D1, 0), makeGene("b", D2, 0)],
      ctx(subs)
    );
    expect(balance).toBe(1);
  });

  it("is lower when heavy sessions are placed consecutively on the same day", () => {
    const subs = [
      makeSub("m1", "MATH", 5), // heavy: MATH subject + diff >= 4
      makeSub("m2", "MATH", 5), // heavy
      makeSub("t1", "THAI", 1), // light
    ];
    const c = ctx(subs);
    // alternated — no two heavy sessions are adjacent
    const alt = computeFitness(
      [makeGene("m1", D1, 0), makeGene("t1", D1, 1), makeGene("m2", D1, 2)],
      c
    ).balance;
    // consecutive — m1 and m2 are both heavy and adjacent
    const consec = computeFitness(
      [makeGene("m1", D1, 0), makeGene("m2", D1, 1), makeGene("t1", D1, 2)],
      c
    ).balance;
    expect(alt).toBeGreaterThan(consec);
  });

  it("is lower when difficulty loads are uneven across days", () => {
    // Using SOCIAL (not in HEAVY_SUBJECTS) + diff=2 to isolate the variance penalty
    const subs = [
      makeSub("a", "SOCIAL", 2),
      makeSub("b", "SOCIAL", 2),
      makeSub("c", "SOCIAL", 2),
      makeSub("d", "SOCIAL", 2),
    ];
    const c = ctx(subs);
    // even: load=2 each day, one session per day
    const even = computeFitness(
      [makeGene("a", D1, 0), makeGene("b", D2, 0), makeGene("c", D3, 0)],
      c
    ).balance;
    // uneven: D1 load=6, D2 load=2
    const uneven = computeFitness(
      [makeGene("a", D1, 0), makeGene("b", D1, 1), makeGene("c", D1, 2), makeGene("d", D2, 0)],
      c
    ).balance;
    expect(even).toBeGreaterThan(uneven);
  });
});

// ─── variety ─────────────────────────────────────────────────────────────────

describe("variety", () => {
  it("= 0 for an empty chromosome", () => {
    expect(computeFitness([], ctx([])).variety).toBe(0);
  });

  it("is higher when subjects are spread across multiple days (vs all bunched on day 1)", () => {
    const subs = [
      makeSub("m", "MATH", 3),
      makeSub("t", "THAI", 2),
      makeSub("s", "SCI", 3),
    ];
    const profs = { m: 30, t: 30, s: 30 }; // equal weakness → equal target distribution
    const c = ctx(subs, profs, { subjectCodes: ["MATH", "THAI", "SCI"] });

    // spread: 2 subjects per day, each subject appears on 2 of 3 days
    const spread = computeFitness(
      [
        makeGene("m", D1, 0), makeGene("t", D1, 1),
        makeGene("m", D2, 0), makeGene("s", D2, 1),
        makeGene("t", D3, 0), makeGene("s", D3, 1),
      ],
      c
    ).variety;

    // bunched: all sessions on D1 only, m appears twice
    const bunched = computeFitness(
      [
        makeGene("m", D1, 0),
        makeGene("t", D1, 1),
        makeGene("s", D1, 2),
        makeGene("m", D1, 3),
      ],
      c
    ).variety;

    expect(spread).toBeGreaterThan(bunched);
  });

  it("is lower when all sessions belong to a single subject (while another subject also needs attention)", () => {
    // Both MATH and THAI have equally weak subtopics in the pool,
    // so the target distribution is 50/50. Studying only MATH diverges from target.
    const subs = [
      makeSub("m1", "MATH", 3),
      makeSub("m2", "MATH", 4),
      makeSub("t1", "THAI", 2),
      makeSub("t2", "THAI", 2),
    ];
    const profs = { m1: 30, m2: 30, t1: 30, t2: 30 }; // all equally weak
    const c = ctx(subs, profs, { subjectCodes: ["MATH", "THAI"] });

    // mixed: 2 subjects per day → distributionScore≈1, dayVariety=1
    const mixed = computeFitness(
      [makeGene("m1", D1, 0), makeGene("t1", D1, 1), makeGene("m2", D2, 0), makeGene("t2", D2, 1)],
      c
    ).variety;

    // single: only MATH → large KL divergence from 50/50 target, dayVariety=0.5
    const single = computeFitness(
      [makeGene("m1", D1, 0), makeGene("m2", D2, 0)],
      c
    ).variety;

    expect(mixed).toBeGreaterThan(single);
  });
});

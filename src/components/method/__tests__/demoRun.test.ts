import { describe, expect, it } from "vitest";
import { runDemo } from "../demoRun";

describe("runDemo — the real planner on the example learner", () => {
  it("is repeatable with a seed", () => {
    const a = runDemo(7);
    const b = runDemo(7);
    expect(b.result).toEqual(a.result);
    expect(b.frames.map((f) => f.best)).toEqual(a.frames.map((f) => f.best));
  });

  it("never does worse than the simple rule it is measured against", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = runDemo(seed);
      expect(r.result.score).toBeGreaterThanOrEqual(r.baseline.score);
    }
  });

  it("plans only on the free days, and frames end at the result", () => {
    const r = runDemo(3, 1);
    expect(r.frames.length).toBe(r.generationsRun);
    expect(r.frames.at(-1)!.best).toBe(r.result.score);
    for (const busy of ["Wed", "Sat"]) expect(r.result.week[busy] ?? []).toHaveLength(0);
    for (const f of r.frames) expect(f.worst).toBeLessThanOrEqual(f.best);
  });
});

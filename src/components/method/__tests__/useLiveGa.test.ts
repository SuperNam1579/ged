import { describe, it, expect } from "vitest";
import { runGaInBrowser, GENS } from "../useLiveGa";

/** Weekday indices the example learner marked unavailable (Wed, Sat). */
const BUSY_DAYS = ["3", "6"];

describe("landing live GA demo", () => {
  it("never schedules a session on a day the learner isn't free", () => {
    // Regression: dates were built with toISOString(), which east of UTC rolls
    // local midnight back a day — every session landed one weekday early, so
    // the winning plan appeared to book the busy days. Run repeatedly because
    // the population is randomised on every call.
    for (let run = 0; run < 5; run++) {
      const snapshots = runGaInBrowser();

      for (const snapshot of snapshots) {
        const booked = Object.keys(snapshot.week);
        for (const day of BUSY_DAYS) {
          expect(booked, `generation ${snapshot.generation} booked day ${day}`).not.toContain(day);
        }
      }
    }
  });

  it("schedules every lesson exactly once", () => {
    const snapshots = runGaInBrowser();
    const last = snapshots[snapshots.length - 1];
    const lessons = Object.values(last.week).flat();

    expect(lessons).toHaveLength(12);
    expect(new Set(lessons.map((l) => l.lesson)).size).toBe(12);
  });

  it("improves the whole population, not just the winner", () => {
    const snapshots = runGaInBrowser();
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];

    expect(last.average).toBeGreaterThan(first.average);
    expect(last.best).toBeGreaterThanOrEqual(first.best);
    expect(last.worst).toBeGreaterThan(first.worst);
    // best >= average >= worst must hold at every frame.
    for (const s of snapshots) {
      expect(s.best).toBeGreaterThanOrEqual(s.average);
      expect(s.average).toBeGreaterThanOrEqual(s.worst);
    }
  });

  it("runs the configured number of generations", () => {
    const snapshots = runGaInBrowser();
    expect(snapshots[0].generation).toBe(1);
    expect(snapshots[snapshots.length - 1].generation).toBe(GENS);
  });
});

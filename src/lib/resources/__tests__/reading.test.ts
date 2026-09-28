import { describe, expect, it } from "vitest";
import { readingSec, requiredReadSec, requiredSecFor } from "../types";
import { clipMinutes } from "../../schedule/parts";

// The numbers agreed with the team on 2026-09-27: 238 words per minute, 20%
// slack in the schedule, "read" unlocking at 60% of the scheduled time.

describe("article reading time", () => {
  it("is word count at 238 words per minute", () => {
    expect(readingSec(238)).toBe(60);
    expect(readingSec(1190)).toBe(300);
  });

  it("never rounds a short article down to nothing", () => {
    expect(readingSec(0)).toBe(1);
    expect(readingSec(1)).toBe(1);
  });

  it("is scheduled with 20% slack", () => {
    expect(clipMinutes(readingSec(1190), "ARTICLE")).toBeCloseTo(6);
  });

  it("keeps the 1.3 study factor for videos", () => {
    expect(clipMinutes(600, "VIDEO")).toBeCloseTo(13);
    expect(clipMinutes(600)).toBeCloseTo(13);
  });
});

describe("the read button", () => {
  it("unlocks at 60% of the scheduled reading time", () => {
    // 1190 words → 300 s plain → 360 s scheduled → 216 s to unlock.
    expect(requiredReadSec(readingSec(1190))).toBe(216);
  });

  it("works out at roughly 330 words per minute", () => {
    const words = 2380;
    const wpm = words / (requiredReadSec(readingSec(words)) / 60);
    expect(wpm).toBeGreaterThan(325);
    expect(wpm).toBeLessThan(335);
  });

  it("is what the gate asks of an article, and 80% watched of a video", () => {
    expect(requiredSecFor({ kind: "ARTICLE", durationSec: 300 })).toBe(216);
    expect(requiredSecFor({ kind: "VIDEO", durationSec: 300 })).toBe(240);
  });
});

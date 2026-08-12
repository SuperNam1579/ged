import { describe, expect, it } from "vitest";
import { isComplete, requiredWatchSec, COMPLETION_THRESHOLD } from "../types";
import { parseIsoDuration } from "../../youtube/duration";

describe("requiredWatchSec", () => {
  it("floors the threshold so a whole-second counter can actually reach it", () => {
    // 100 * 0.8 = 80 exactly; 101 * 0.8 = 80.8, which no integer watchedSec
    // would ever equal if we rounded up.
    expect(requiredWatchSec(100)).toBe(80);
    expect(requiredWatchSec(101)).toBe(80);
  });

  it("uses the configured threshold", () => {
    expect(requiredWatchSec(600)).toBe(Math.floor(600 * COMPLETION_THRESHOLD));
  });
});

describe("isComplete", () => {
  it("is true at exactly the threshold", () => {
    expect(isComplete(80, 100)).toBe(true);
  });

  it("is false one second short", () => {
    expect(isComplete(79, 100)).toBe(false);
  });

  it("refuses to complete a zero-length video", () => {
    // A live stream or a bad fixture row reports 0. Treating that as complete
    // would hand out a finished session for watching nothing.
    expect(isComplete(0, 0)).toBe(false);
    expect(isComplete(999, 0)).toBe(false);
  });
});

describe("parseIsoDuration", () => {
  it("handles every combination of omitted components", () => {
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("PT4M")).toBe(240);
    expect(parseIsoDuration("PT2H")).toBe(7200);
    expect(parseIsoDuration("PT10M24S")).toBe(624);
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
  });

  it("returns 0 for live streams and unparseable input", () => {
    expect(parseIsoDuration("P0D")).toBe(0);
    expect(parseIsoDuration("nonsense")).toBe(0);
  });
});

/**
 * The rate clamp from the progress route, restated.
 *
 * This is the rule that makes a client-reported number trustworthy, so it is
 * worth pinning down independently of the route's I/O.
 */
function clampDelta(claimed: number, stored: number, elapsedSec: number): number {
  const MAX_RATE = 2;
  const GRACE_SEC = 3;
  return Math.min(Math.max(claimed - stored, 0), elapsedSec * MAX_RATE + GRACE_SEC);
}

describe("progress clamp", () => {
  it("accepts an honest 10-second heartbeat", () => {
    expect(clampDelta(30, 20, 10)).toBe(10);
  });

  it("discards a backwards claim rather than subtracting", () => {
    expect(clampDelta(5, 20, 10)).toBe(0);
  });

  it("caps a forged jump at what wall-clock time allows", () => {
    // The whole attack: claim the video is finished after one heartbeat.
    expect(clampDelta(999999, 20, 10)).toBe(23);
  });

  it("still allows 2x playback", () => {
    expect(clampDelta(40, 20, 10)).toBe(20);
  });
});

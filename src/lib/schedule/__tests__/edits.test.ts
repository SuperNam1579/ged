import { describe, expect, it } from "vitest";
import { findConflicts, pickClips, restorableSessions } from "../edits";
import type { CalendarDay } from "../calendar";
import type { Clip } from "../parts";

const clip = (id: string, minutes: number): Clip => ({ resourceId: id, unitKey: "u", lessonKey: id, minutes });

describe("pickClips", () => {
  const clips = [clip("a", 20), clip("b", 25), clip("c", 30)];

  it("takes the leading clips that fit the session", () => {
    expect(pickClips(clips, 45).map((c) => c.resourceId)).toEqual(["a", "b"]);
  });

  it("always takes one clip, even one longer than the session", () => {
    expect(pickClips(clips, 10).map((c) => c.resourceId)).toEqual(["a"]);
  });

  it("takes everything when no length is given", () => {
    expect(pickClips(clips)).toHaveLength(3);
  });
});

describe("restorableSessions", () => {
  const base = { scheduledDate: "2026-10-12", durationMins: 60, order: 0 };
  const original = [
    { ...base, subtopicId: "math1", resourceIds: ["m1", "m2"], order: 0 },
    { ...base, subtopicId: "math2", resourceIds: ["m3"], order: 1 },
    { ...base, subtopicId: "atomic", resourceIds: [], order: 2 },
    { ...base, subtopicId: "math1", resourceIds: [], kind: "REVIEW" as const, scheduledDate: "2026-11-20", order: 3 },
    { ...base, subtopicId: "sci1", resourceIds: ["s1"], order: 4 },
  ];

  it("brings the GA's sessions back, less what was completed since and dropped subjects", () => {
    const restored = restorableSessions({
      original,
      completedClips: new Set(["m1", "m3"]),
      completedWhole: new Set(["atomic"]),
      completedReviews: new Set(),
      allowed: new Set(["math1", "math2", "atomic"]), // SCI dropped
    });
    expect(restored.map((s) => [s.subtopicId, s.resourceIds])).toEqual([
      ["math1", ["m2"]], // part done, the rest comes back
      ["math1", []], // the review
    ]);
  });

  it("drops a review already done that day", () => {
    const restored = restorableSessions({
      original,
      completedClips: new Set(),
      completedWhole: new Set(),
      completedReviews: new Set(["math1|2026-11-20"]),
      allowed: new Set(["math1", "math2", "atomic", "sci1"]),
    });
    expect(restored.some((s) => s.kind === "REVIEW")).toBe(false);
    expect(restored).toHaveLength(4);
  });
});

describe("findConflicts", () => {
  const day = (date: string, capacity: number): CalendarDay => ({ date, capacity, dayOfWeek: 1, weekStartDate: "2026-10-12" });
  const days = [day("2026-10-12", 120), day("2026-10-13", 0), day("2026-10-14", 60)];

  it("flags days with no free time, too much planned, and anything on or after the exam", () => {
    const conflicts = findConflicts({
      sessions: [
        { date: "2026-10-12", minutes: 90 }, // fits
        { date: "2026-10-13", minutes: 30 }, // no free time that day
        { date: "2026-10-14", minutes: 45 },
        { date: "2026-10-14", minutes: 30 }, // 75 > 60
        { date: "2026-10-20", minutes: 30 }, // exam day
        { date: "2026-10-01", minutes: 30 }, // missed: not a conflict
      ],
      days,
      today: "2026-10-12",
      examDate: "2026-10-20",
    });
    expect(conflicts.map((c) => [c.date, c.reason])).toEqual([
      ["2026-10-13", "no-time"],
      ["2026-10-14", "over-time"],
      ["2026-10-20", "after-exam"],
    ]);
    expect(conflicts[1]).toMatchObject({ plannedMinutes: 75, availableMinutes: 60 });
  });
});

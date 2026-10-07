import { describe, expect, it } from "vitest";
import { buildStudyCalendar, mondayOf } from "../calendar";

// Mon–Fri 18:00–20:00 (120 min), Saturday 09:00–12:00 (180 min), Sunday off.
const USUAL = [
  ...[1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startTime: "18:00", endTime: "20:00" })),
  { dayOfWeek: 6, startTime: "09:00", endTime: "12:00" },
];

describe("mondayOf", () => {
  it("finds the Monday of the week, Sunday belonging to the week before", () => {
    expect(mondayOf("2026-10-05")).toBe("2026-10-05"); // Monday
    expect(mondayOf("2026-10-07")).toBe("2026-10-05"); // Wednesday
    expect(mondayOf("2026-10-11")).toBe("2026-10-05"); // Sunday
  });
});

describe("buildStudyCalendar", () => {
  it("runs from today up to, not including, the exam — 50 days ahead is 50 days", () => {
    const cal = buildStudyCalendar({ from: "2026-10-03", examDate: "2026-11-22", template: USUAL, weekOverrides: new Map() });
    expect(cal.days).toHaveLength(50);
    expect(cal.days[0].date).toBe("2026-10-03");
    expect(cal.days.at(-1)!.date).toBe("2026-11-21");
  });

  it("splits the run into Monday weeks, partial at either end", () => {
    // Saturday 3 Oct → Wednesday 21 Oct (exam).
    const cal = buildStudyCalendar({ from: "2026-10-03", examDate: "2026-10-21", template: USUAL, weekOverrides: new Map() });
    expect(cal.weeks.map((w) => [w.weekStartDate, w.days.length])).toEqual([
      ["2026-09-28", 2], // Sat, Sun
      ["2026-10-05", 7],
      ["2026-10-12", 7],
      ["2026-10-19", 2], // Mon, Tue
    ]);
  });

  it("gives every week the usual availability unless the week was set on its own", () => {
    const cal = buildStudyCalendar({
      from: "2026-10-05",
      examDate: "2026-10-26",
      template: USUAL,
      weekOverrides: new Map([
        ["2026-10-12", [{ dayOfWeek: 0, startTime: "13:00", endTime: "17:00" }]], // only Sunday, 4 h
        ["2026-10-19", []], // a week off
      ]),
    });
    expect(cal.weeks.map((w) => [w.source, w.totalMinutes])).toEqual([
      ["template", 5 * 120 + 180],
      ["week", 240],
      ["week", 0],
    ]);
    expect(cal.days.find((d) => d.date === "2026-10-18")!.capacity).toBe(240);
    expect(cal.days.find((d) => d.date === "2026-10-13")!.capacity).toBe(0);
    expect(cal.totalMinutes).toBe(780 + 240);
  });

  it("adds up several slots on one day", () => {
    const cal = buildStudyCalendar({
      from: "2026-10-05",
      examDate: "2026-10-06",
      template: [
        { dayOfWeek: 1, startTime: "08:00", endTime: "09:30" },
        { dayOfWeek: 1, startTime: "19:00", endTime: "20:00" },
      ],
      weekOverrides: new Map(),
    });
    expect(cal.days[0].capacity).toBe(150);
  });

  it("is empty once the exam has passed", () => {
    const cal = buildStudyCalendar({ from: "2026-10-03", examDate: "2026-10-01", template: USUAL, weekOverrides: new Map() });
    expect(cal.days).toHaveLength(0);
    expect(cal.weeks).toHaveLength(0);
  });
});

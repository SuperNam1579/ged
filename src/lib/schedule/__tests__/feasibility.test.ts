import { describe, expect, it } from "vitest";
import { assessFeasibility } from "../feasibility";
import { buildStudyCalendar } from "../calendar";
import type { WorkItem } from "../parts";
import type { SubtopicData } from "@/types";

/** n subtopics per subject, each 3 units of 30 minutes (90 min). */
function curriculum(subjects: Record<string, number>) {
  const subtopics: SubtopicData[] = [];
  const items: WorkItem[] = [];
  for (const [subjectCode, n] of Object.entries(subjects)) {
    for (let i = 0; i < n; i++) {
      const id = `${subjectCode}${i}`;
      subtopics.push({ id, name: id, topicId: "t", subjectCode, estimatedMinutes: 90, difficultyLevel: 3, prerequisiteIds: [] });
      items.push({
        subtopicId: id,
        subjectCode,
        difficultyLevel: 3,
        prerequisiteIds: [],
        clips: [0, 1, 2].map((u) => ({ resourceId: `${id}-${u}`, unitKey: `${id}-u${u}`, lessonKey: `${id}-l${u}`, minutes: 30 })),
        atomicMinutes: 0,
        started: false,
      });
    }
  }
  return { subtopics, items };
}

/** Mon–Fri, `minutes` a day, from Monday 2026-10-12 for `days` days. */
function check(days: number, minutes: number, subjects: Record<string, number>) {
  const from = "2026-10-12";
  const examDate = new Date(Date.parse(`${from}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  const endTime = `${String(18 + Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  const calendar = buildStudyCalendar({
    from,
    examDate,
    template: [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startTime: "18:00", endTime })),
    weekOverrides: new Map(),
  });
  const { subtopics, items } = curriculum(subjects);
  return assessFeasibility({ calendarDays: calendar.days, from, examDate, items, subtopics, proficiencies: {} });
}

describe("assessFeasibility", () => {
  // 28 days = 20 weekdays; 2 kept for review → 18 content days.

  it("lets the GA run when the content fits with room to spare", () => {
    // 18 days × 120 = 2160 min of content time; 16 × 90 = 1440 needed (0.67)
    const f = check(28, 120, { MATH: 8, SCI: 8 });
    expect(f.status).toBe("comfortable");
    expect(f.canPlan).toBe(true);
    expect(f.reviewDays).toBe(2);
    expect(f.subjects).toEqual([
      { subjectCode: "MATH", requiredMinutes: 720, subtopics: 8, estimatedSubtopics: 0, source: "clips" },
      { subjectCode: "SCI", requiredMinutes: 720, subtopics: 8, estimatedSubtopics: 0, source: "clips" },
    ]);
  });

  it("calls it tight above 90% of the time, and light under half", () => {
    expect(check(28, 120, { MATH: 12, SCI: 12 }).status).toBe("tight"); // 2160 of 2160
    expect(check(28, 120, { MATH: 4, SCI: 4 }).status).toBe("light"); // 720 of 2160
  });

  it("stops the GA when the content doesn't fit, and says what would fix it", () => {
    const f = check(28, 60, { MATH: 8, SCI: 8 }); // 1080 of time for 1440 of content
    expect(f.status).toBe("not-enough");
    expect(f.canPlan).toBe(false);
    expect(f.shortfallMinutes).toBeGreaterThan(0);
    expect(f.suggestions.extraMinutesPerWeek).toBeGreaterThan(0);
    expect(f.suggestions.suggestedExamDate! > f.examDate).toBe(true);
    // Either subject alone (720 min) fits in 1080.
    expect(f.suggestions.dropOneOf).toEqual(["MATH", "SCI"]);
  });

  it("counts what actually packs, not just total minutes", () => {
    // 45-minute days: a 30-minute unit fits once a day, leaving 15 minutes unusable.
    // 18 days × 45 = 810 minutes "available" for 720 needed, yet only 18 units fit of 24.
    const f = check(28, 45, { MATH: 8 });
    expect(f.load).toBeLessThan(1);
    expect(f.status).toBe("not-enough");
  });

  it("names the exam being past or no free time at all", () => {
    expect(check(0, 120, { MATH: 2 }).status).toBe("exam-passed");
    expect(check(28, 0, { MATH: 2 }).status).toBe("no-time");
  });

  it("warns about very long study days", () => {
    const f = check(28, 420, { MATH: 8 });
    expect(f.warnings.map((w) => w.code)).toContain("long-days");
  });
});

describe("assessFeasibility — incomplete content", () => {
  const from = "2026-10-12";
  const examDate = "2026-11-09"; // 28 days
  const calendar = buildStudyCalendar({
    from,
    examDate,
    template: [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startTime: "18:00", endTime: "20:00" })),
    weekOverrides: new Map(),
  });

  it("counts a subject with no videos yet at its estimates, and says so", () => {
    const { subtopics, items } = curriculum({ MATH: 6 });
    // RLA: 4 subtopics, no clips, estimated at 60 minutes each.
    const rla = [0, 1, 2, 3].map((i) => ({
      id: `RLA${i}`, name: `RLA${i}`, topicId: "t", subjectCode: "RLA", estimatedMinutes: 60, difficultyLevel: 2, prerequisiteIds: [],
    }));
    const rlaItems = rla.map((s) => ({
      subtopicId: s.id, subjectCode: "RLA", difficultyLevel: 2, prerequisiteIds: [], clips: [], atomicMinutes: 60, started: false,
    }));
    const f = assessFeasibility({
      calendarDays: calendar.days, from, examDate,
      items: [...items, ...rlaItems], subtopics: [...subtopics, ...rla], proficiencies: {},
      subjectCodes: ["MATH", "RLA"],
    });
    expect(f.canPlan).toBe(true);
    expect(f.requiredMinutes).toBe(6 * 90 + 4 * 60);
    expect(f.subjects.find((s) => s.subjectCode === "RLA")).toMatchObject({ source: "estimate", estimatedSubtopics: 4 });
    expect(f.subjects.find((s) => s.subjectCode === "MATH")).toMatchObject({ source: "clips" });
    expect(f.warnings.find((w) => w.code === "estimated-time")?.subjects).toEqual(["RLA"]);
  });

  it("names a chosen subject with no lessons at all instead of counting it as nothing", () => {
    const { subtopics, items } = curriculum({ MATH: 6 });
    const f = assessFeasibility({
      calendarDays: calendar.days, from, examDate, items, subtopics, proficiencies: {},
      subjectCodes: ["MATH", "RLA"],
    });
    expect(f.subjects.find((s) => s.subjectCode === "RLA")).toMatchObject({ source: "missing", requiredMinutes: 0 });
    expect(f.warnings.find((w) => w.code === "no-content")?.subjects).toEqual(["RLA"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  pickStable,
  resolvePostSignInRoute,
  summarizePreAssessment,
  type AvailablePreAssessment,
  type PreAttempt,
} from "../status";

const available: AvailablePreAssessment[] = [
  { id: "a-sci", subjectCode: "SCI", subjectName: "Science" },
  { id: "a-math", subjectCode: "MATH", subjectName: "Mathematical Reasoning" },
  { id: "a-rla", subjectCode: "RLA", subjectName: "Reasoning Through Language Arts" },
  { id: "a-ss", subjectCode: "SS", subjectName: "Social Studies" },
];

function attempt(subjectCode: string, rawScore: number, at: string): PreAttempt {
  return {
    subjectCode,
    subjectName: subjectCode,
    rawScore,
    maxScore: 5,
    score: (rawScore / 5) * 100,
    completedAt: new Date(at),
  };
}

describe("summarizePreAssessment", () => {
  it("is incomplete when the learner dropped out after some subjects", () => {
    const s = summarizePreAssessment({
      selectedSubjectCodes: ["MATH", "RLA", "SCI"],
      available,
      attempts: [attempt("MATH", 3, "2026-09-01")],
    });
    expect(s.isComplete).toBe(false);
    expect(s.required).toEqual(["MATH", "RLA", "SCI"]);
    expect(s.remaining).toEqual(["RLA", "SCI"]);
    expect(s.completed.map((c) => c.subjectCode)).toEqual(["MATH"]);
  });

  it("is incomplete with no attempts at all — onboarding finished, assessment never submitted", () => {
    const s = summarizePreAssessment({ selectedSubjectCodes: ["MATH"], available, attempts: [] });
    expect(s.isComplete).toBe(false);
    expect(s.remaining).toEqual(["MATH"]);
  });

  it("is complete once every selected subject has an attempt", () => {
    const s = summarizePreAssessment({
      selectedSubjectCodes: ["SCI", "MATH"],
      available,
      attempts: [attempt("SCI", 4, "2026-09-02"), attempt("MATH", 2, "2026-09-01")],
    });
    expect(s.isComplete).toBe(true);
    expect(s.remaining).toEqual([]);
  });

  it("does not require a selected subject that has no takeable pre-assessment", () => {
    // Otherwise the learner is sent back to /pre-assessment on every sign-in,
    // for a section that can never be offered to them.
    const s = summarizePreAssessment({
      selectedSubjectCodes: ["MATH", "SS"],
      available: available.filter((a) => a.subjectCode !== "SS"),
      attempts: [attempt("MATH", 5, "2026-09-01")],
    });
    expect(s.required).toEqual(["MATH"]);
    expect(s.isComplete).toBe(true);
  });

  it("requires every available subject when nothing was selected (legacy accounts)", () => {
    const s = summarizePreAssessment({ selectedSubjectCodes: [], available, attempts: [] });
    expect(s.required).toEqual(["MATH", "RLA", "SCI", "SS"]);
  });

  it("ignores attempts on subjects the learner no longer has selected", () => {
    const s = summarizePreAssessment({
      selectedSubjectCodes: ["MATH"],
      available,
      attempts: [attempt("SCI", 5, "2026-09-01")],
    });
    expect(s.completed).toEqual([]);
    expect(s.isComplete).toBe(false);
  });

  it("reports the latest attempt when a subject was taken more than once", () => {
    const s = summarizePreAssessment({
      selectedSubjectCodes: ["MATH"],
      available,
      attempts: [attempt("MATH", 5, "2026-09-03"), attempt("MATH", 1, "2026-09-01")],
    });
    expect(s.completed).toHaveLength(1);
    expect(s.completed[0].rawScore).toBe(5);
  });

  it("lists subjects in canonical order regardless of input order", () => {
    const s = summarizePreAssessment({
      selectedSubjectCodes: ["SS", "SCI", "MATH", "RLA"],
      available,
      attempts: [attempt("SS", 1, "2026-09-01"), attempt("MATH", 1, "2026-09-01")],
    });
    expect(s.required).toEqual(["MATH", "RLA", "SCI", "SS"]);
    expect(s.completed.map((c) => c.subjectCode)).toEqual(["MATH", "SS"]);
    expect(s.remaining).toEqual(["RLA", "SCI"]);
  });
});

describe("resolvePostSignInRoute", () => {
  it("sends a learner with no preferences to onboarding", () => {
    expect(resolvePostSignInRoute({ hasPreferences: false, preAssessmentComplete: false })).toBe("/onboarding");
    // Preferences are checked first: completion without them isn't a real state.
    expect(resolvePostSignInRoute({ hasPreferences: false, preAssessmentComplete: true })).toBe("/onboarding");
  });

  it("sends a learner who dropped out of the pre-assessment back to it", () => {
    expect(resolvePostSignInRoute({ hasPreferences: true, preAssessmentComplete: false })).toBe("/pre-assessment");
  });

  it("sends a learner who finished to the dashboard", () => {
    expect(resolvePostSignInRoute({ hasPreferences: true, preAssessmentComplete: true })).toBe("/dashboard");
  });
});

describe("pickStable", () => {
  const items = ["a", "b", "c"];

  it("returns the same item for the same seed every time", () => {
    const first = pickStable(items, "user-1:MATH");
    for (let i = 0; i < 20; i++) expect(pickStable(items, "user-1:MATH")).toBe(first);
  });

  it("always returns a member of the list", () => {
    for (const seed of ["", "x", "user-2:SCI", "a very long seed ".repeat(50)]) {
      expect(items).toContain(pickStable(items, seed));
    }
  });

  it("spreads different seeds across the variants", () => {
    const picks = new Set(Array.from({ length: 60 }, (_, i) => pickStable(items, `user-${i}`)));
    expect(picks.size).toBe(3);
  });
});

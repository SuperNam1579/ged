import { describe, expect, it } from "vitest";
import {
  clearProgress,
  progressKey,
  pruneAnswers,
  readProgress,
  resumePosition,
  writeProgress,
  type ResumableSection,
} from "../progress";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const sections: ResumableSection[] = [
  { id: "math", completed: false, questions: [{ id: "m1" }, { id: "m2" }, { id: "m3" }] },
  { id: "rla", completed: false, questions: [{ id: "r1" }, { id: "r2" }] },
  { id: "sci", completed: false, questions: [{ id: "s1" }] },
];

const withDone = (done: string[]) =>
  sections.map((s) => ({ ...s, completed: done.includes(s.id) }));

describe("readProgress / writeProgress", () => {
  it("round-trips answers for the same learner", () => {
    const storage = fakeStorage();
    writeProgress(storage, "u1", { math: { m1: "A" } });
    expect(readProgress(storage, "u1")).toEqual({ math: { m1: "A" } });
  });

  it("keeps each learner's progress separate on a shared browser", () => {
    const storage = fakeStorage();
    writeProgress(storage, "u1", { math: { m1: "A" } });
    expect(readProgress(storage, "u2")).toEqual({});
  });

  it("drops the legacy unscoped key instead of resuming someone else's answers", () => {
    const storage = fakeStorage({
      "ged-pre-assessment-v1": JSON.stringify({ answers: { math: { m1: "B" } }, currentAssessmentIdx: 1 }),
    });
    expect(readProgress(storage, "u1")).toEqual({});
    expect(storage.data.has("ged-pre-assessment-v1")).toBe(false);
  });

  it("discards corrupt or wrongly-shaped data", () => {
    for (const raw of ["{not json", "[]", '{"math": ["A"]}', '{"math": {"m1": 3}}', "null"]) {
      const storage = fakeStorage({ [progressKey("u1")]: raw });
      expect(readProgress(storage, "u1")).toEqual({});
    }
  });

  it("survives storage that throws (private mode, blocked site data)", () => {
    const throwing = {
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => { throw new Error("QuotaExceededError"); },
      removeItem: () => { throw new Error("SecurityError"); },
    };
    expect(readProgress(throwing, "u1")).toEqual({});
    expect(() => writeProgress(throwing, "u1", { math: { m1: "A" } })).not.toThrow();
    expect(() => clearProgress(throwing, "u1")).not.toThrow();
  });

  it("clears only this learner's key", () => {
    const storage = fakeStorage();
    writeProgress(storage, "u1", { math: { m1: "A" } });
    writeProgress(storage, "u2", { math: { m1: "C" } });
    clearProgress(storage, "u1");
    expect(readProgress(storage, "u1")).toEqual({});
    expect(readProgress(storage, "u2")).toEqual({ math: { m1: "C" } });
  });
});

describe("pruneAnswers", () => {
  it("drops answers for sections the server already has", () => {
    const pruned = pruneAnswers(withDone(["math"]), { math: { m1: "A" }, rla: { r1: "B" } });
    expect(pruned).toEqual({ rla: { r1: "B" } });
  });

  it("drops answers for questions and sections that no longer exist", () => {
    const pruned = pruneAnswers(sections, {
      math: { m1: "A", gone: "B" },
      "old-assessment": { x: "C" },
    });
    expect(pruned).toEqual({ math: { m1: "A" } });
  });
});

describe("resumePosition", () => {
  it("starts at the beginning with nothing saved", () => {
    expect(resumePosition(sections, {})).toEqual({ assessmentIdx: 0, questionIdx: 0, selectedOption: null });
  });

  it("resumes mid-section at the first unanswered question", () => {
    expect(resumePosition(sections, { math: { m1: "A", m2: "B" } })).toEqual({
      assessmentIdx: 0, questionIdx: 2, selectedOption: null,
    });
  });

  it("skips sections already submitted", () => {
    expect(resumePosition(withDone(["math"]), {})).toEqual({
      assessmentIdx: 1, questionIdx: 0, selectedOption: null,
    });
  });

  it("lands on the last question with its answer selected when the submission never arrived", () => {
    expect(resumePosition(sections, { math: { m1: "A", m2: "B", m3: "D" } })).toEqual({
      assessmentIdx: 0, questionIdx: 2, selectedOption: "D",
    });
  });

  it("answers out of order still resume at the first gap", () => {
    expect(resumePosition(sections, { math: { m1: "A", m3: "C" } })).toEqual({
      assessmentIdx: 0, questionIdx: 1, selectedOption: null,
    });
  });

  it("returns null when every section is done", () => {
    expect(resumePosition(withDone(["math", "rla", "sci"]), {})).toBeNull();
  });

  it("skips a section with no questions rather than getting stuck on it", () => {
    const s = [{ id: "empty", completed: false, questions: [] }, ...sections];
    expect(resumePosition(s, {})?.assessmentIdx).toBe(1);
  });

  it("looks forward from the given section, then wraps to earlier open ones", () => {
    expect(resumePosition(withDone(["rla"]), {}, 1)?.assessmentIdx).toBe(2);
    expect(resumePosition(withDone(["rla", "sci"]), {}, 2)?.assessmentIdx).toBe(0);
  });
});

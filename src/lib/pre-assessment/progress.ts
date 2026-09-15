// In-browser pre-assessment progress: saving answers as they are given, and
// working out where to resume.
//
// Takes the Storage as a parameter instead of touching window.localStorage, so
// the page passes the real one and the tests pass a fake.

/** assessmentId -> questionId -> chosen option ID */
export type SavedAnswers = Record<string, Record<string, string>>;

/** The minimum a section needs to expose for resuming. */
export interface ResumableSection {
  id: string;
  completed: boolean;
  questions: { id: string }[];
}

export interface ResumePosition {
  assessmentIdx: number;
  questionIdx: number;
  /** The saved answer for that question, so a learner can press Finish straight away. */
  selectedOption: string | null;
}

/**
 * Pre-v2 progress lived under one fixed key for everyone on the browser, and
 * held a section index. Both were wrong: a second account signing in on the
 * same machine resumed the first account's answers, and an index goes stale as
 * soon as the section list changes. It is dropped rather than migrated.
 */
const LEGACY_KEY = "ged-pre-assessment-v1";

export function progressKey(userId: string): string {
  return `ged-pre-assessment-v2:${userId}`;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isAnswers(value: unknown): value is SavedAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every(
    (section) =>
      section !== null &&
      typeof section === "object" &&
      !Array.isArray(section) &&
      Object.values(section).every((v) => typeof v === "string")
  );
}

/**
 * Reads this learner's saved answers. Anything unreadable is discarded rather
 * than thrown — losing a half-finished section is recoverable, a page that
 * crashes on load is not. Storage can itself throw (private mode, blocked site
 * data), which is treated the same way.
 */
export function readProgress(storage: StorageLike, userId: string): SavedAnswers {
  try {
    storage.removeItem(LEGACY_KEY);
    const raw = storage.getItem(progressKey(userId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (isAnswers(parsed)) return parsed;
    storage.removeItem(progressKey(userId));
  } catch {
    // fall through
  }
  return {};
}

export function writeProgress(storage: StorageLike, userId: string, answers: SavedAnswers): void {
  try {
    storage.setItem(progressKey(userId), JSON.stringify(answers));
  } catch {
    // Quota or blocked storage: the assessment still works, it just can't resume.
  }
}

export function clearProgress(storage: StorageLike, userId: string): void {
  try {
    storage.removeItem(progressKey(userId));
  } catch {
    // nothing to do
  }
}

/**
 * Keeps only answers that still belong to a question in an unfinished section.
 * Answers for a section the server already has, or for questions that no
 * longer exist, would otherwise be resubmitted or skew the resume position.
 */
export function pruneAnswers(sections: ResumableSection[], answers: SavedAnswers): SavedAnswers {
  const pruned: SavedAnswers = {};
  for (const s of sections) {
    if (s.completed) continue;
    const saved = answers[s.id];
    if (!saved) continue;
    const valid = new Set(s.questions.map((q) => q.id));
    const kept = Object.fromEntries(Object.entries(saved).filter(([qid]) => valid.has(qid)));
    if (Object.keys(kept).length) pruned[s.id] = kept;
  }
  return pruned;
}

/**
 * The first unfinished section, at its first unanswered question.
 *
 * If every question in that section is already answered — the learner reached
 * the end but the submission never landed — it resumes on the last question
 * with its answer selected, one press away from submitting again.
 *
 * Returns null when nothing is left to take.
 */
export function resumePosition(
  sections: ResumableSection[],
  answers: SavedAnswers,
  fromIdx = 0
): ResumePosition | null {
  // Look forward from the current section first, then wrap: normally every
  // earlier section is done, but a subject finished out of order (in another
  // tab, say) must not hide one still open before it.
  const indexes = sections.map((_, i) => i);
  const order = [...indexes.filter((i) => i >= fromIdx), ...indexes.filter((i) => i < fromIdx)];

  for (const assessmentIdx of order) {
    const s = sections[assessmentIdx];
    if (s.completed || s.questions.length === 0) continue;

    const saved = answers[s.id] ?? {};
    const firstOpen = s.questions.findIndex((q) => saved[q.id] === undefined);
    if (firstOpen !== -1) {
      return { assessmentIdx, questionIdx: firstOpen, selectedOption: null };
    }
    const last = s.questions.length - 1;
    return { assessmentIdx, questionIdx: last, selectedOption: saved[s.questions[last].id] };
  }
  return null;
}

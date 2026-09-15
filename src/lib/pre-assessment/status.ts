// Pure decision logic for the pre-assessment: which subjects a learner still
// owes, and where they belong after signing in.
//
// Kept free of Prisma and of Next so it can be unit-tested directly — the
// database-facing half lives in ./index.ts and only gathers the inputs.

import { bySubjectOrder } from "@/lib/subject-order";

/** A PRE assessment the learner could actually take: it has at least one question. */
export interface AvailablePreAssessment {
  id: string;
  subjectCode: string;
  subjectName: string;
}

/** A finished PRE attempt, reduced to what the decision and the results screen need. */
export interface PreAttempt {
  subjectCode: string;
  subjectName: string;
  rawScore: number;
  maxScore: number;
  score: number;
  completedAt: Date;
}

export interface SubjectResult {
  subjectCode: string;
  subjectName: string;
  rawScore: number;
  maxScore: number;
  score: number;
}

export interface PreAssessmentStatus {
  /** Subject codes the learner has to cover, in canonical subject order. */
  required: string[];
  /** The latest result for each required subject already submitted. */
  completed: SubjectResult[];
  /** Required subject codes with no submitted attempt yet. */
  remaining: string[];
  isComplete: boolean;
}

/**
 * Works out which subjects are still outstanding.
 *
 * `required` is the learner's selection intersected with the subjects that have
 * a takeable PRE assessment. The intersection is what stops a redirect loop: a
 * learner who picked a subject nobody seeded a pre-assessment for could never
 * finish it, and sending them back to /pre-assessment on every sign-in would
 * lock them out of the app. An empty selection (accounts from before selection
 * was saved) means every available subject, matching GET /api/assessment/pre.
 */
export function summarizePreAssessment(input: {
  selectedSubjectCodes: string[];
  available: AvailablePreAssessment[];
  attempts: PreAttempt[];
}): PreAssessmentStatus {
  const availableCodes = new Set(input.available.map((a) => a.subjectCode));
  const wanted = input.selectedSubjectCodes.length
    ? input.selectedSubjectCodes.filter((c) => availableCodes.has(c))
    : [...availableCodes];

  const required = [...new Set(wanted)]
    .map((subjectCode) => ({ subjectCode }))
    .sort(bySubjectOrder)
    .map((s) => s.subjectCode);
  const requiredSet = new Set(required);

  // Latest attempt wins, so a subject that was somehow taken twice reports the
  // most recent score rather than whichever row the query returned first.
  const latest = new Map<string, PreAttempt>();
  for (const a of input.attempts) {
    if (!requiredSet.has(a.subjectCode)) continue;
    const seen = latest.get(a.subjectCode);
    if (!seen || a.completedAt > seen.completedAt) latest.set(a.subjectCode, a);
  }

  const completed = [...latest.values()]
    .map(({ subjectCode, subjectName, rawScore, maxScore, score }) => ({
      subjectCode, subjectName, rawScore, maxScore, score,
    }))
    .sort(bySubjectOrder);

  const remaining = required.filter((c) => !latest.has(c));

  return { required, completed, remaining, isComplete: remaining.length === 0 };
}

export type PostSignInRoute = "/onboarding" | "/pre-assessment" | "/dashboard";

/**
 * Where a signed-in learner belongs.
 *
 * Onboarding creates the preferences row and then sends the learner straight
 * into the pre-assessment, so "has preferences but has not finished the
 * pre-assessment" can only mean they left part-way — a dropped connection, a
 * closed tab. That learner goes back to the assessment, not to a dashboard
 * built from results that don't exist.
 */
export function resolvePostSignInRoute(input: {
  hasPreferences: boolean;
  preAssessmentComplete: boolean;
}): PostSignInRoute {
  if (!input.hasPreferences) return "/onboarding";
  if (!input.preAssessmentComplete) return "/pre-assessment";
  return "/dashboard";
}

/**
 * Chooses one assessment per subject when several exist, stably per learner.
 *
 * The route used to pick with Math.random(), so a reload could hand back a
 * different assessment for the same subject — and the answers saved in the
 * browser, keyed by assessment ID, would no longer match anything. Hashing the
 * user ID keeps the choice fixed for a learner while still spreading learners
 * across the variants.
 */
export function pickStable<T>(items: T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return items[Math.abs(hash) % items.length];
}

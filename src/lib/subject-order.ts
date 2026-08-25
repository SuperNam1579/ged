/**
 * Canonical order of the four GED subjects, by database code.
 *
 * The order a learner meets subjects in has to be the same everywhere — the
 * onboarding picker, the pre-assessment's sections, the dashboard's summaries.
 * Left to the database it isn't: rows come back in `createdAt` order, which is
 * whatever order the seed happened to insert them in and can change the next
 * time the data is rebuilt.
 *
 * This lives in its own module rather than in `components/landing/subjects.tsx`
 * because that file carries an icon per subject as JSX. Importing it from an
 * API route would pull React elements into the server bundle for the sake of a
 * four-item array.
 */

/** MATH → RLA → SCI → SS: numeracy first, then the three reading-led subjects. */
export const SUBJECT_CODE_ORDER = ["MATH", "RLA", "SCI", "SS"] as const;

export type SubjectCode = (typeof SUBJECT_CODE_ORDER)[number];

/**
 * Sort position for a subject code.
 *
 * Unknown codes sort last rather than first, so a subject added to the database
 * before it is added here still appears — at the end, where it is obvious —
 * instead of silently displacing Math from the front.
 */
export function subjectOrder(code: string): number {
  const i = SUBJECT_CODE_ORDER.indexOf(code as SubjectCode);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

/**
 * Comparator for anything carrying a subject code.
 *
 * Ties — two unknown codes, or two entries of the same subject — fall back to
 * comparing the codes themselves so the result is stable rather than dependent
 * on the input order.
 */
export function bySubjectOrder<T extends { subjectCode: string }>(a: T, b: T): number {
  return subjectOrder(a.subjectCode) - subjectOrder(b.subjectCode) || a.subjectCode.localeCompare(b.subjectCode);
}

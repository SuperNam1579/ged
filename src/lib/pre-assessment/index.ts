// Database-facing half of the pre-assessment status. Server-only.
//
// Gathers the inputs for summarizePreAssessment() in three parallel queries.
// Both GET /api/user/next-step and GET /api/assessment/pre go through here, so
// the sign-in redirect and the assessment page can never disagree about which
// subjects are done.

import { db } from "@/lib/db";
import {
  pickStable,
  summarizePreAssessment,
  type AvailablePreAssessment,
  type PreAssessmentStatus,
} from "./status";

export interface PreAssessmentSnapshot {
  hasPreferences: boolean;
  status: PreAssessmentStatus;
  /** One takeable PRE assessment per subject, chosen stably for this learner. */
  assessments: AvailablePreAssessment[];
}

export async function getPreAssessmentSnapshot(userId: string): Promise<PreAssessmentSnapshot> {
  const [prefs, rows, attempts] = await Promise.all([
    db.userPreferences.findUnique({
      where: { userId },
      select: { selectedSubjectCodes: true },
    }),
    db.assessment.findMany({
      // An assessment with no questions can't be taken, and counting it as
      // required would send its subject's learners back here forever.
      where: { type: "PRE", subjectId: { not: null }, questions: { some: {} } },
      select: { id: true, subject: { select: { code: true, name: true } } },
      // Stable input order is what makes pickStable() stable.
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    db.userAssessmentAttempt.findMany({
      where: { userId, completedAt: { not: null }, assessment: { type: "PRE" } },
      select: {
        rawScore: true,
        maxScore: true,
        score: true,
        completedAt: true,
        assessment: { select: { subject: { select: { code: true, name: true } } } },
      },
    }),
  ]);

  const bySubject = new Map<string, AvailablePreAssessment[]>();
  for (const r of rows) {
    if (!r.subject) continue;
    const list = bySubject.get(r.subject.code) ?? [];
    list.push({ id: r.id, subjectCode: r.subject.code, subjectName: r.subject.name });
    bySubject.set(r.subject.code, list);
  }
  const assessments = [...bySubject.entries()].map(([code, list]) =>
    pickStable(list, `${userId}:${code}`)
  );

  const status = summarizePreAssessment({
    selectedSubjectCodes: prefs?.selectedSubjectCodes ?? [],
    available: assessments,
    attempts: attempts.flatMap((a) =>
      a.assessment.subject && a.completedAt
        ? [{
            subjectCode: a.assessment.subject.code,
            subjectName: a.assessment.subject.name,
            rawScore: a.rawScore,
            maxScore: a.maxScore,
            score: a.score,
            completedAt: a.completedAt,
          }]
        : []
    ),
  });

  return { hasPreferences: prefs !== null, status, assessments };
}

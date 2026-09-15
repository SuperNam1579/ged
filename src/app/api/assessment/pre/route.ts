import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getPreAssessmentSnapshot } from "@/lib/pre-assessment";

/**
 * GET /api/assessment/pre
 *
 * The learner's pre-assessment, one section per required subject in canonical
 * subject order, plus what they have already submitted.
 *
 * Sections already submitted come back with `completed: true` and no questions:
 * the page needs them for the stepper and the results screen, not to be taken
 * again. That is what lets a learner who dropped out part-way resume at the
 * first unfinished subject instead of starting over — or, worse, re-submitting
 * a subject and having its proficiency counted twice.
 */
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status, assessments: picked } = await getPreAssessmentSnapshot(authUser.id);

  const doneCodes = new Set(status.completed.map((c) => c.subjectCode));
  const sections = status.required
    .map((code) => picked.find((a) => a.subjectCode === code))
    .filter((a) => a !== undefined);

  const pendingIds = sections.filter((s) => !doneCodes.has(s.subjectCode)).map((s) => s.id);
  const questionRows = pendingIds.length
    ? await db.question.findMany({
        where: { assessmentId: { in: pendingIds } },
        select: {
          id: true,
          assessmentId: true,
          text: true,
          options: true,
          difficulty: true,
          subtopicId: true,
        },
        // Fixed order, so a question index saved in the browser still points
        // at the same question after a reload.
        orderBy: { id: "asc" },
      })
    : [];

  // Flattened `subjectCode` / `subjectName` rather than the raw Prisma
  // relation — the client's Assessment interface declares those two fields,
  // and the raw row left them undefined and blanked every subject label.
  const assessments = sections.map((s) => ({
    id: s.id,
    subjectCode: s.subjectCode,
    subjectName: s.subjectName,
    completed: doneCodes.has(s.subjectCode),
    questions: questionRows
      .filter((q) => q.assessmentId === s.id)
      .map((q) => ({
        id: q.id,
        text: q.text,
        options: q.options,
        difficulty: q.difficulty,
        subtopicId: q.subtopicId,
      })),
  }));

  return NextResponse.json({
    userId: authUser.id,
    assessments,
    results: status.completed,
  });
}

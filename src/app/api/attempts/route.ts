import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attempts = await db.userAssessmentAttempt.findMany({
    where: { userId: authUser.id, completedAt: { not: null } },
    include: {
      assessment: {
        select: {
          type: true,
          title: true,
          subject: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: { completedAt: "desc" },
    take: 20,
  });

  const formatted = attempts.map((a: typeof attempts[0]) => ({
    id: a.id,
    assessmentType: a.assessment.type,
    title: a.assessment.title,
    subjectCode: a.assessment.subject?.code,
    subjectName: a.assessment.subject?.name,
    score: a.score,
    rawScore: a.rawScore,
    maxScore: a.maxScore,
    completedAt: a.completedAt,
  }));

  return NextResponse.json({ attempts: formatted });
}

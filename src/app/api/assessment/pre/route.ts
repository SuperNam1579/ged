import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prefs = await db.userPreferences.findUnique({
    where: { userId: authUser.id },
    select: { selectedSubjectCodes: true },
  });

  // Fall back to every subject for accounts from before subject selection was
  // persisted (empty/missing selection) so their pre-assessment isn't blank.
  const subjectCodes = prefs?.selectedSubjectCodes?.length ? prefs.selectedSubjectCodes : null;

  const all = await db.assessment.findMany({
    where: {
      type: "PRE",
      ...(subjectCodes ? { subject: { code: { in: subjectCodes } } } : {}),
    },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      questions: {
        select: {
          id: true,
          text: true,
          options: true,
          difficulty: true,
          subtopicId: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by subject, then randomly pick one per subject
  const bySubject = new Map<string, typeof all>();
  for (const a of all) {
    if (!a.subjectId) continue;
    const list = bySubject.get(a.subjectId) ?? [];
    list.push(a);
    bySubject.set(a.subjectId, list);
  }

  const assessments = Array.from(bySubject.values()).map((list) =>
    list[Math.floor(Math.random() * list.length)]
  );

  return NextResponse.json({ assessments });
}

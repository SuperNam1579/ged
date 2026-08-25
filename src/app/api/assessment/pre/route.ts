import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { bySubjectOrder } from "@/lib/subject-order";

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

  // Flatten `subject: { code, name }` into the `subjectCode` / `subjectName`
  // pair the client's Assessment interface declares — the same shape the quiz
  // route returns. Handing back the raw Prisma row instead left both fields
  // undefined on the client, which silently blanked every subject label and
  // made `key={r.subjectCode}` a missing key on the results breakdown.
  //
  // Sorted into the canonical subject order rather than left in the order the
  // rows arrived: `bySubject` preserves the insertion order of the `createdAt`
  // query, so which subject a learner met first depended on the order the seed
  // inserted assessments in. It also has to hold for any subset — someone who
  // picked only Science and Math should still get Math first, not whichever of
  // the two happens to be older.
  const assessments = Array.from(bySubject.values())
    .map((list) => {
      const picked = list[Math.floor(Math.random() * list.length)];
      return {
        id: picked.id,
        subjectCode: picked.subject?.code ?? "",
        subjectName: picked.subject?.name ?? "",
        questions: picked.questions,
      };
    })
    .sort(bySubjectOrder);

  return NextResponse.json({ assessments });
}

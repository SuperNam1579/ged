import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const subjects = searchParams.get("subjects")?.split(",") ?? ["MATH", "RLA", "SS", "SCI"];

  // Use the pre-assessment questions as mock test questions (10 per subject)
  const assessments = await db.assessment.findMany({
    where: {
      type: "PRE",
      subject: { code: { in: subjects } },
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
  });

  return NextResponse.json({ assessments });
}

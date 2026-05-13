import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const proficiencies = await db.userSubtopicProficiency.findMany({
    where: { userId: authUser.id },
    include: {
      subtopic: {
        include: {
          topic: {
            include: {
              category: {
                include: { subject: { select: { code: true, name: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: { score: "asc" },
  });

  const formatted = proficiencies.map((p: typeof proficiencies[0]) => ({
    subtopicId: p.subtopicId,
    subtopicName: p.subtopic.name,
    topicName: p.subtopic.topic.name,
    subjectCode: p.subtopic.topic.category.subject.code,
    subjectName: p.subtopic.topic.category.subject.name,
    score: p.score,
    attemptCount: p.attemptCount,
    lastUpdated: p.lastUpdated,
  }));

  return NextResponse.json({ proficiencies: formatted });
}

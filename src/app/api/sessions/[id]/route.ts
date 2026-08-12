import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const session = await db.studySession.findUnique({
    where: { id },
    include: {
      studyPlan: { select: { userId: true } },
      subtopic: {
        include: {
          topic: {
            include: {
              category: {
                include: { subject: { select: { code: true, name: true } } },
              },
            },
          },
          // Shown in the session meta bar. Named "prerequisites" on the
          // dependent side: these are the subtopics this one builds on.
          prerequisites: {
            select: { prerequisite: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  if (!session || session.studyPlan.userId !== authUser.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({
    session: {
      id: session.id,
      subtopicId: session.subtopicId,
      subtopicName: session.subtopic.name,
      subtopicDescription: session.subtopic.description,
      subjectCode: session.subtopic.topic.category.subject.code,
      subjectName: session.subtopic.topic.category.subject.name,
      topicName: session.subtopic.topic.name,
      scheduledDate: session.scheduledDate.toISOString().split("T")[0],
      durationMins: session.durationMins,
      order: session.order,
      status: session.status,
      learningUrl: session.subtopic.learningUrl,
      difficultyLevel: session.subtopic.difficultyLevel,
      estimatedMinutes: session.subtopic.estimatedMinutes,
      prerequisites: session.subtopic.prerequisites.map((p) => p.prerequisite.name),
    },
  });
}

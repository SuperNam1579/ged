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
      resources: {
        select: { resource: { select: { order: true, lessonRef: { select: { unit: { select: { name: true } } } } } } },
      },
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

  // For a session that is one part of a split subtopic: the units it covers,
  // and the next part still to do, so the page can say "next: Thursday"
  // instead of offering the subtopic quiz halfway through the subtopic.
  const isPart = session.resources.length > 0;
  const firstOrder = isPart ? Math.min(...session.resources.map((r) => r.resource.order)) : 0;
  const unitNames = [
    ...new Set(
      [...session.resources]
        .sort((a, b) => a.resource.order - b.resource.order)
        .map((r) => r.resource.lessonRef?.unit.name)
        .filter((n): n is string => !!n)
    ),
  ];

  let nextPart: { id: string; scheduledDate: string } | null = null;
  if (isPart) {
    const siblings = await db.studySession.findMany({
      where: {
        studyPlanId: session.studyPlanId,
        subtopicId: session.subtopicId,
        id: { not: session.id },
        status: { not: "COMPLETED" },
        resources: { some: {} },
      },
      select: { id: true, scheduledDate: true, resources: { select: { resource: { select: { order: true } } } } },
    });
    const later = siblings
      .map((s) => ({ ...s, first: Math.min(...s.resources.map((r) => r.resource.order)) }))
      .filter((s) => s.first > firstOrder)
      .sort((a, b) => a.first - b.first)[0];
    if (later) nextPart = { id: later.id, scheduledDate: later.scheduledDate.toISOString().split("T")[0] };
  }

  // The subtopic quiz belongs after its last part. partCount stays null until
  // every clip is scheduled, so an unknown total is never treated as "last".
  const isLastPart = !isPart || (session.partIndex !== null && session.partIndex === session.partCount) ||
    (session.partIndex === null && nextPart === null);

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
      partIndex: session.partIndex,
      partCount: session.partCount,
      unitNames,
      isLastPart,
      nextPart,
    },
  });
}

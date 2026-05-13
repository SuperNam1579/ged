import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD

  const activePlan = await db.studyPlan.findFirst({
    where: { userId: authUser.id, isActive: true },
    orderBy: { version: "desc" },
    select: { id: true, version: true, fitnessScore: true, triggerReason: true, generatedAt: true },
  });

  if (!activePlan) {
    return NextResponse.json({ sessions: [], plan: null });
  }

  const dateFilter = date
    ? { gte: new Date(date), lt: new Date(new Date(date).getTime() + 86400000) }
    : undefined;

  const sessions = await db.studySession.findMany({
    where: {
      studyPlanId: activePlan.id,
      ...(dateFilter ? { scheduledDate: dateFilter } : {}),
    },
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
    orderBy: [{ scheduledDate: "asc" }, { order: "asc" }],
  });

  const formatted = sessions.map((s: typeof sessions[0]) => ({
    id: s.id,
    subtopicId: s.subtopicId,
    subtopicName: s.subtopic.name,
    subjectCode: s.subtopic.topic.category.subject.code,
    subjectName: s.subtopic.topic.category.subject.name,
    topicName: s.subtopic.topic.name,
    scheduledDate: s.scheduledDate.toISOString().split("T")[0],
    durationMins: s.durationMins,
    order: s.order,
    status: s.status,
    learningUrl: s.subtopic.learningUrl,
    difficultyLevel: s.subtopic.difficultyLevel,
  }));

  return NextResponse.json({ sessions: formatted, plan: activePlan });
}

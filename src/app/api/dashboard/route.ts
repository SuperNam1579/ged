import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { differenceInDays } from "date-fns";

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Load user + preferences
  const user = await db.user.findUnique({
    where: { id: authUser.id },
    include: { preferences: true },
  });

  // Load active plan + today's sessions
  const activePlan = await db.studyPlan.findFirst({
    where: { userId: authUser.id, isActive: true },
    orderBy: { version: "desc" },
    include: {
      sessions: {
        where: { scheduledDate: { gte: today, lt: tomorrow } },
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
        orderBy: { order: "asc" },
      },
    },
  });

  // Overall progress (% of sessions completed across active plan)
  let overallProgress = 0;
  if (activePlan) {
    const totalSessions = await db.studySession.count({
      where: { studyPlanId: activePlan.id },
    });
    const completedSessions = await db.studySession.count({
      where: { studyPlanId: activePlan.id, status: "COMPLETED" },
    });
    overallProgress = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  }

  // Subject summaries
  const subjects = await db.subject.findMany({
    include: {
      categories: {
        include: {
          topics: {
            include: {
              subtopics: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  const proficiencies = await db.userSubtopicProficiency.findMany({
    where: { userId: authUser.id },
    select: { subtopicId: true, score: true },
  });
  const profMap = new Map(proficiencies.map((p: { subtopicId: string; score: number }) => [p.subtopicId, p.score]));

  const subjectSummaries = subjects.map((subject) => {
    const allSubtopicIds = subject.categories.flatMap((c) =>
      c.topics.flatMap((t) => t.subtopics.map((s) => s.id))
    );
    const totalCount = allSubtopicIds.length;

    const attemptedScores = allSubtopicIds
      .map((id) => profMap.get(id))
      .filter((score): score is number => score !== undefined);

    const attemptedCount = attemptedScores.length;
    const proficiencyScore = attemptedCount > 0
      ? Math.round(attemptedScores.reduce((a, b) => a + b, 0) / attemptedCount)
      : 0;
    const coveragePercent = totalCount > 0
      ? Math.round((attemptedCount / totalCount) * 100)
      : 0;

    return {
      id: subject.id,
      name: subject.name,
      code: subject.code,
      passingScore: subject.passingScore,
      proficiencyScore,
      coveragePercent,
      attemptedCount,
      totalCount,
      progress: coveragePercent,
    };
  });

  // Today's sessions formatted
  const todaySessions = (activePlan?.sessions ?? []).map((s) => ({
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

  const daysUntilExam = user?.preferences
    ? Math.max(0, differenceInDays(user.preferences.targetExamDate, today))
    : 0;

  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const recentCompletions = await db.studySession.findMany({
    where: {
      studyPlan: { userId: authUser.id },
      status: "COMPLETED",
      completedAt: { not: null, gte: ninetyDaysAgo },
    },
    select: { completedAt: true },
    orderBy: { completedAt: "desc" },
  });

  const completionDateSet = new Set(
    recentCompletions.map((c) => c.completedAt!.toISOString().split("T")[0])
  );

  let streakDays = 0;
  const streakCursor = new Date();
  streakCursor.setHours(0, 0, 0, 0);

  while (completionDateSet.has(streakCursor.toISOString().split("T")[0])) {
    streakDays++;
    streakCursor.setDate(streakCursor.getDate() - 1);
  }

  return NextResponse.json({
    overallProgress,
    todaySessions,
    subjectSummaries,
    currentPlanVersion: activePlan?.version ?? 0,
    daysUntilExam,
    streakDays,
    lastPlanUpdate: activePlan
      ? {
          reason: activePlan.triggerReason,
          generatedAt: activePlan.generatedAt.toISOString(),
        }
      : undefined,
  });
}

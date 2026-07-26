import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { WEAKNESS_THRESHOLD } from "@/lib/ga/constants";
import { differenceInDays } from "date-fns";

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // These queries are independent of each other, so fire them in a single
  // parallel wave instead of awaiting one at a time — each await was a
  // separate round-trip to the (remote) database, which is what made the
  // dashboard slow to load after deploy.
  const [user, activePlan, subjects, proficiencies, recentCompletions] = await Promise.all([
    // User + preferences
    db.user.findUnique({
      where: { id: authUser.id },
      include: { preferences: true },
    }),
    // Active plan + today's sessions
    db.studyPlan.findFirst({
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
    }),
    // Subject tree for summaries
    db.subject.findMany({
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
    }),
    // Proficiency scores
    db.userSubtopicProficiency.findMany({
      where: { userId: authUser.id },
      select: { subtopicId: true, score: true },
    }),
    // Recent completions (for streak calc)
    db.studySession.findMany({
      where: {
        studyPlan: { userId: authUser.id },
        status: "COMPLETED",
        completedAt: { not: null, gte: ninetyDaysAgo },
      },
      select: { completedAt: true },
      orderBy: { completedAt: "desc" },
    }),
  ]);

  // Overall progress (% of sessions completed across active plan)
  let overallProgress = 0;
  if (activePlan) {
    const [totalSessions, completedSessions] = await Promise.all([
      db.studySession.count({ where: { studyPlanId: activePlan.id } }),
      db.studySession.count({ where: { studyPlanId: activePlan.id, status: "COMPLETED" } }),
    ]);
    overallProgress = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  }
  const profMap = new Map(proficiencies.map((p: { subtopicId: string; score: number }) => [p.subtopicId, p.score]));

  // Only surface the subjects the user chose in onboarding (fall back to all
  // for legacy accounts that never saved a selection).
  const selectedCodes = user?.preferences?.selectedSubjectCodes?.length
    ? new Set(user.preferences.selectedSubjectCodes)
    : null;
  const scopedSubjects = selectedCodes
    ? subjects.filter((s) => selectedCodes.has(s.code))
    : subjects;

  const subjectSummaries = scopedSubjects.map((subject) => {
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

  // ── Has studied work fallen behind? ──────────────────────────────────────
  // Quiz and mock results update proficiency immediately, but the schedule is
  // only rebuilt when the learner asks for it.
  //
  // What matters is a topic the learner has already worked through that is still
  // below the threshold — studied, but it didn't stick, so the plan should come
  // back to it. Topics that were never scheduled are excluded on purpose: the
  // plan only covers as many weeks as there is availability for, so counting
  // those would flag dozens of topics from day one and read as noise rather
  // than a signal.
  //
  // Deliberately derived rather than stored: a flag on the user would have to be
  // set on every submission and cleared on every regeneration, and would drift
  // out of sync the moment either path missed it. Comparing completed work
  // against current proficiency can't go stale.
  let staleWeakSubtopics = 0;
  if (activePlan) {
    const [completed, queued] = await Promise.all([
      db.studySession.findMany({
        where: { studyPlan: { userId: authUser.id }, status: "COMPLETED" },
        select: { subtopicId: true },
        distinct: ["subtopicId"],
      }),
      // Already lined up for another pass — no need to prompt for those.
      db.studySession.findMany({
        where: { studyPlanId: activePlan.id, status: { not: "COMPLETED" } },
        select: { subtopicId: true },
        distinct: ["subtopicId"],
      }),
    ]);
    const queuedIds = new Set<string>(queued.map((s: { subtopicId: string }) => s.subtopicId));
    const needsAnotherPass = new Set<string>(
      completed
        .map((s: { subtopicId: string }) => s.subtopicId)
        .filter((id: string) => !queuedIds.has(id))
    );
    staleWeakSubtopics = proficiencies.filter(
      (p: { subtopicId: string; score: number }) =>
        p.score < WEAKNESS_THRESHOLD && needsAnotherPass.has(p.subtopicId)
    ).length;
  }

  return NextResponse.json({
    overallProgress,
    todaySessions,
    subjectSummaries,
    currentPlanVersion: activePlan?.version ?? 0,
    daysUntilExam,
    streakDays,
    staleWeakSubtopics,
    lastPlanUpdate: activePlan
      ? {
          reason: activePlan.triggerReason,
          generatedAt: activePlan.generatedAt.toISOString(),
        }
      : undefined,
  });
}

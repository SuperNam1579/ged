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

  // ── Has attempted work fallen behind? ────────────────────────────────────
  // Quiz and mock results update proficiency on submit, but the schedule is only
  // rebuilt when the learner asks for it. This counts topics they have actually
  // attempted a quiz on that still sit below the weakness threshold, with no
  // further pass queued — "tried it, still not sticking".
  //
  // Keyed on quiz attempts rather than completed sessions on purpose. The study
  // screen offers "Take Quiz" alongside "Mark as Complete", so a learner can
  // work through a topic and fail it repeatedly without ever completing the
  // session; keying on completion would miss exactly the case worth flagging.
  //
  // Topics never attempted are excluded: the plan only spans the weeks
  // availability exists for, so counting those would flag dozens from day one
  // and read as noise rather than a signal.
  //
  // Deliberately derived rather than stored: a flag would have to be set on
  // every submission and cleared on every regeneration, and would drift the
  // moment either path missed it. Comparing attempts against current
  // proficiency cannot go stale.
  let staleWeakSubtopics = 0;
  if (activePlan) {
    const [attempts, queued] = await Promise.all([
      db.userAssessmentAttempt.findMany({
        where: {
          userId: authUser.id,
          completedAt: { not: null },
          assessment: { type: "QUIZ", subtopicId: { not: null } },
        },
        select: { assessment: { select: { subtopicId: true } } },
      }),
      // Already lined up for another pass — no need to prompt for those.
      db.studySession.findMany({
        where: { studyPlanId: activePlan.id, status: { not: "COMPLETED" } },
        select: { subtopicId: true },
        distinct: ["subtopicId"],
      }),
    ]);

    const queuedIds = new Set<string>(queued.map((s: { subtopicId: string }) => s.subtopicId));
    const attemptedIds = new Set<string>(
      attempts
        .map((a: { assessment: { subtopicId: string | null } }) => a.assessment.subtopicId)
        .filter((id: string | null): id is string => id !== null)
    );

    staleWeakSubtopics = proficiencies.filter(
      (p: { subtopicId: string; score: number }) =>
        p.score < WEAKNESS_THRESHOLD &&
        attemptedIds.has(p.subtopicId) &&
        !queuedIds.has(p.subtopicId)
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

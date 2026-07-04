import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUserStrict } from "@/lib/auth";
import { runGeneticAlgorithm } from "@/lib/ga/engine";
import { recommendOrder } from "@/lib/ga/ordering";
import { checkCsrf } from "@/lib/csrf";
import { audit, extractRequestContext } from "@/lib/audit";
import type { TriggerReason } from "@/types";
import { z } from "zod";

const GenerateSchema = z.object({
  triggerReason: z.enum([
    "INITIAL",
    "QUIZ_FAILURE",
    "MOCK_TEST_LOW",
    "SCHEDULE_CHANGE",
    "MANUAL_REQUEST",
  ]),
});

function calcSlotMins(slots: { startTime: string; endTime: string }[]): number {
  return slots.reduce((sum, s) => {
    const [sh, sm] = s.startTime.split(":").map(Number);
    const [eh, em] = s.endTime.split(":").map(Number);
    return sum + Math.max(0, eh * 60 + em - (sh * 60 + sm));
  }, 0);
}

export async function POST(req: NextRequest) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  const authUser = await getAuthUserStrict(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = GenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { triggerReason } = parsed.data;

  const preferences = await db.userPreferences.findUnique({
    where: { userId: authUser.id },
  });
  if (!preferences) {
    return NextResponse.json(
      { error: "User preferences not found. Complete onboarding first." },
      { status: 400 }
    );
  }

  // Current week's Monday in UTC (matches stored weekStartDate which is also UTC midnight)
  const now = new Date();
  const dayUTC = now.getUTCDay();
  const daysBack = dayUTC === 0 ? 6 : dayUTC - 1;
  const currentMonday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysBack)
  );

  // All weeks from this week onwards that have availability set
  const allWeeks = await db.weeklyAvailability.findMany({
    where: { userId: authUser.id, weekStartDate: { gte: currentMonday } },
    orderBy: { weekStartDate: "asc" },
    include: { slots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] } },
  });

  const validWeeks = allWeeks.filter((w) => w.slots.length > 0);
  if (validWeeks.length === 0) {
    return NextResponse.json(
      { error: "Weekly availability not set. Please enter your available time slots first." },
      { status: 400 }
    );
  }

  // Load all subtopics
  const subtopics = await db.subtopic.findMany({
    include: {
      prerequisites: { select: { prerequisiteId: true } },
      topic: {
        include: { category: { include: { subject: { select: { code: true } } } } },
      },
    },
  });
  const allSubtopicData = subtopics.map((s: typeof subtopics[0]) => ({
    id: s.id,
    name: s.name,
    topicId: s.topicId,
    subjectCode: s.topic.category.subject.code,
    estimatedMinutes: s.estimatedMinutes,
    difficultyLevel: s.difficultyLevel,
    prerequisiteIds: s.prerequisites.map((p) => p.prerequisiteId),
  }));

  // Restrict regeneration to the subjects chosen in onboarding (fall back to
  // all subjects for legacy accounts with no selection saved).
  const selectedCodes = preferences.selectedSubjectCodes?.length
    ? new Set(preferences.selectedSubjectCodes)
    : null;
  const subtopicData = selectedCodes
    ? allSubtopicData.filter((s) => selectedCodes.has(s.subjectCode))
    : allSubtopicData;

  // Load proficiency scores
  const proficiencies = await db.userSubtopicProficiency.findMany({
    where: { userId: authUser.id },
    select: { subtopicId: true, score: true },
  });
  const profMap = Object.fromEntries(
    proficiencies.map((p: { subtopicId: string; score: number }) => [p.subtopicId, p.score])
  );

  // Start exclusion set from already-completed subtopics only (fresh regeneration)
  const completed = await db.studySession.findMany({
    where: { studyPlan: { userId: authUser.id }, status: "COMPLETED" },
    select: { subtopicId: true },
    distinct: ["subtopicId"],
  });
  const assignedIds = new Set<string>(
    completed.map((s: { subtopicId: string }) => s.subtopicId)
  );

  if (assignedIds.size >= subtopicData.length) {
    return NextResponse.json({ message: "All subtopics have been scheduled. Great work!" });
  }

  const latestPlan = await db.studyPlan.findFirst({
    where: { userId: authUser.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  // 20s per week — allows up to 3 weeks before hitting a 60s function limit
  const GA_TIMEOUT_MS = 20000;

  let lastResult: { studyPlanId: string; bestFitness: number; fitnessBreakdown: object; generationLogs: unknown[] } | null = null;

  for (let i = 0; i < validWeeks.length; i++) {
    const week = validWeeks[i];
    const weekSlots = week.slots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    }));

    const remaining = subtopicData.filter((s) => !assignedIds.has(s.id));
    if (remaining.length === 0) break;

    const budget = Math.max(Math.floor(calcSlotMins(weekSlots) * 0.95), 30);
    const ordered = recommendOrder({ subtopics: remaining, proficiencies: profMap });
    let cumMins = 0;
    const weekSubtopics = ordered.filter((s) => {
      if (cumMins + s.estimatedMinutes <= budget) {
        cumMins += s.estimatedMinutes;
        return true;
      }
      return false;
    });
    if (weekSubtopics.length === 0) weekSubtopics.push(ordered[0]);

    // Reserve these subtopics for this week so next weeks don't re-use them
    weekSubtopics.forEach((s) => assignedIds.add(s.id));

    try {
      const result = await Promise.race([
        runGeneticAlgorithm({
          userId: authUser.id,
          proficiencies: profMap,
          preferences: {
            targetExamDate: preferences.targetExamDate,
            targetScore: preferences.targetScore,
          },
          weeklyAvailability: weekSlots,
          weekStartDate: week.weekStartDate,
          weeklyAvailabilityId: week.id,
          subtopics: weekSubtopics,
          triggerReason: triggerReason as TriggerReason,
          existingPlanVersion: latestPlan?.version,
          // Week 0: replace mode (deactivates old plan, creates fresh one)
          // Week 1+: append mode (adds sessions to the new plan)
          appendToExisting: i > 0,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Week ${i + 1} generation timed out.`)),
            GA_TIMEOUT_MS
          )
        ),
      ]);
      lastResult = result;
    } catch (err) {
      console.error(`GA failed for week starting ${week.weekStartDate.toISOString()}:`, err);
      // If week 0 fails, abort entirely; subsequent weeks are best-effort
      if (i === 0) {
        const message = err instanceof Error ? err.message : "GA execution failed";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
  }

  if (!lastResult) {
    return NextResponse.json({ error: "Failed to generate study plan." }, { status: 500 });
  }

  const ctx = extractRequestContext(req);
  audit({
    action: "STUDY_PLAN_GENERATED",
    userId: authUser.id,
    entityType: "studyPlan",
    entityId: lastResult.studyPlanId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    metadata: {
      triggerReason,
      fitnessScore: lastResult.bestFitness,
      weeksGenerated: validWeeks.length,
    },
    success: true,
  });

  return NextResponse.json({
    success: true,
    studyPlanId: lastResult.studyPlanId,
    fitnessScore: lastResult.bestFitness,
    weeksGenerated: validWeeks.length,
  });
}

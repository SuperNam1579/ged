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

  // Load user preferences
  const preferences = await db.userPreferences.findUnique({
    where: { userId: authUser.id },
  });

  if (!preferences) {
    return NextResponse.json(
      { error: "User preferences not found. Complete onboarding first." },
      { status: 400 }
    );
  }

  // Load latest weekly availability (most recent week the user entered)
  const weeklyAvail = await db.weeklyAvailability.findFirst({
    where: { userId: authUser.id },
    orderBy: { weekStartDate: "desc" },
    include: { slots: true },
  });

  if (!weeklyAvail || weeklyAvail.slots.length === 0) {
    return NextResponse.json(
      { error: "Weekly availability not set. Please enter your available time slots first." },
      { status: 400 }
    );
  }

  const weeklyAvailabilitySlots = weeklyAvail.slots.map((s) => ({
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
  }));

  // Load all subtopics with subject code
  const subtopics = await db.subtopic.findMany({
    include: {
      prerequisites: { select: { prerequisiteId: true } },
      topic: {
        include: {
          category: {
            include: { subject: { select: { code: true } } },
          },
        },
      },
    },
  });

  const subtopicData = subtopics.map((s: typeof subtopics[0]) => ({
    id: s.id,
    name: s.name,
    topicId: s.topicId,
    subjectCode: s.topic.category.subject.code,
    estimatedMinutes: s.estimatedMinutes,
    difficultyLevel: s.difficultyLevel,
    prerequisiteIds: s.prerequisites.map((p) => p.prerequisiteId), // Changed
  }));

  // Load proficiency scores
  const proficiencies = await db.userSubtopicProficiency.findMany({
    where: { userId: authUser.id },
    select: { subtopicId: true, score: true },
  });

  const profMap = Object.fromEntries(proficiencies.map((p: { subtopicId: string; score: number }) => [p.subtopicId, p.score]));

  // ── Limit subtopics to what fits in this week's time budget ─────────────
  const totalSlotMins = weeklyAvailabilitySlots.reduce((sum, s) => {
    const [sh, sm] = s.startTime.split(":").map(Number);
    const [eh, em] = s.endTime.split(":").map(Number);
    return sum + Math.max(0, eh * 60 + em - (sh * 60 + sm));
  }, 0);

  const completed = await db.studySession.findMany({
    where: { studyPlan: { userId: authUser.id }, status: "COMPLETED" },
    select: { subtopicId: true },
    distinct: ["subtopicId"],
  });
  const completedIds = new Set(
    completed.map((s: { subtopicId: string }) => s.subtopicId)
  );
  const remaining = subtopicData.filter((s) => !completedIds.has(s.id));

  if (remaining.length === 0) {
    return NextResponse.json({ message: "All subtopics have been scheduled. Great work!" });
  }

  const budget = Math.max(Math.floor(totalSlotMins * 0.95), 30);
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
  // ─────────────────────────────────────────────────────────────────────────

  // Current plan version
  const latestPlan = await db.studyPlan.findFirst({
    where: { userId: authUser.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const GA_TIMEOUT_MS = 25000;

  try {
    const result = await Promise.race([
      runGeneticAlgorithm({
        userId: authUser.id,
        proficiencies: profMap,
        preferences: {
          targetExamDate: preferences.targetExamDate,
          targetScore: preferences.targetScore,
        },
        weeklyAvailability: weeklyAvailabilitySlots,
        subtopics: weekSubtopics,
        triggerReason: triggerReason as TriggerReason,
        existingPlanVersion: latestPlan?.version,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Study plan generation timed out. Please try again.")),
          GA_TIMEOUT_MS
        )
      ),
    ]);

    const ctx = extractRequestContext(req);
    audit({
      action: "STUDY_PLAN_GENERATED",
      userId: authUser.id,
      entityType: "studyPlan",
      entityId: result.studyPlanId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        triggerReason,
        fitnessScore: result.bestFitness,
        generationsRun: result.generationLogs.length,
      },
      success: true,
    });

    return NextResponse.json({
      success: true,
      studyPlanId: result.studyPlanId,
      fitnessScore: result.bestFitness,
      fitnessBreakdown: result.fitnessBreakdown,
      generationsRun: result.generationLogs.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "GA execution failed";
    console.error("GA error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

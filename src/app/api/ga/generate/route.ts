import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUserStrict } from "@/lib/auth";
import { runGeneticAlgorithm } from "@/lib/ga/engine";
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

  // Load all subtopics with subject code
  const subtopics = await db.subtopic.findMany({
    include: {
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
    prerequisiteIds: s.prerequisiteIds,
  }));

  // Load proficiency scores
  const proficiencies = await db.userSubtopicProficiency.findMany({
    where: { userId: authUser.id },
    select: { subtopicId: true, score: true },
  });

  const profMap = Object.fromEntries(proficiencies.map((p: { subtopicId: string; score: number }) => [p.subtopicId, p.score]));

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
          hoursPerDay: preferences.hoursPerDay,
          availability: preferences.availability as Record<string, boolean>,
          targetScore: preferences.targetScore,
        },
        subtopics: subtopicData,
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

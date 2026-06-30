import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUserStrict } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { runGeneticAlgorithm } from "@/lib/ga/engine";
import { recommendOrder } from "@/lib/ga/ordering";
import type { TriggerReason } from "@/types";

const SlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
}).refine(
  (s) => s.startTime < s.endTime,
  { message: "startTime must be before endTime" }
);

const AvailabilitySchema = z.object({
  weekStartDate: z.string().refine((d) => {
    const date = new Date(d);
    if (isNaN(date.getTime())) return false;
    return date.getDay() === 1; // must be Monday
  }, "weekStartDate must be a valid Monday (ISO date)"),
  slots: z.array(SlotSchema).min(1, "At least one time slot is required"),
});

export async function POST(req: NextRequest) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  const authUser = await getAuthUserStrict(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = AvailabilitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { weekStartDate: weekStartStr, slots } = parsed.data;
  const weekStart = new Date(weekStartStr);

  const preferences = await db.userPreferences.findUnique({
    where: { userId: authUser.id },
  });
  if (!preferences) {
    return NextResponse.json(
      { error: "Complete onboarding before submitting availability." },
      { status: 400 }
    );
  }

  // Save WeeklyAvailability + replace slots in a single transaction
  const weeklyAvail = await db.$transaction(async (tx) => {
    const avail = await tx.weeklyAvailability.upsert({
      where: { userId_weekStartDate: { userId: authUser.id, weekStartDate: weekStart } },
      create: { userId: authUser.id, weekStartDate: weekStart },
      update: {},
    });

    await tx.availabilitySlot.deleteMany({ where: { weeklyAvailabilityId: avail.id } });
    await tx.availabilitySlot.createMany({
      data: slots.map((s) => ({
        weeklyAvailabilityId: avail.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    });

    return avail;
  });

  // Load subtopics
  const subtopics = await db.subtopic.findMany({
    include: {
      prerequisites: { select: { prerequisiteId: true } },
      topic: {
        include: { category: { include: { subject: { select: { code: true } } } } },
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
    prerequisiteIds: s.prerequisites.map((p) => p.prerequisiteId),
  }));

  // Load proficiency scores
  const proficiencies = await db.userSubtopicProficiency.findMany({
    where: { userId: authUser.id },
    select: { subtopicId: true, score: true },
  });
  const profMap = Object.fromEntries(
    proficiencies.map((p: { subtopicId: string; score: number }) => [p.subtopicId, p.score])
  );

  // ── Week budget: total available minutes from slots ──────────────────────
  const totalSlotMins = slots.reduce((sum, s) => {
    const [sh, sm] = s.startTime.split(":").map(Number);
    const [eh, em] = s.endTime.split(":").map(Number);
    return sum + Math.max(0, eh * 60 + em - (sh * 60 + sm));
  }, 0);

  // ── Exclude only COMPLETED subtopics (unfinished ones can be re-scheduled) ─
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
    return NextResponse.json({
      message: "All subtopics have been scheduled. Great work!",
      weeklyAvailabilityId: weeklyAvail.id,
    });
  }

  // ── Pick subtopics that fit within this week's budget (95% of capacity) ─
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
  // Always schedule at least one subtopic even if it exceeds budget
  if (weekSubtopics.length === 0) weekSubtopics.push(ordered[0]);

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
        weeklyAvailability: slots,
        weekStartDate: weekStart,
        weeklyAvailabilityId: weeklyAvail.id,
        subtopics: weekSubtopics,
        triggerReason: "SCHEDULE_CHANGE" as TriggerReason,
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
      weeklyAvailabilityId: weeklyAvail.id,
      studyPlanId: result.studyPlanId,
      bestFitness: result.bestFitness,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate study plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const authUser = await getAuthUserStrict(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const weekStartDate = searchParams.get("weekStartDate");

  if (weekStartDate) {
    // Get specific week
    const avail = await db.weeklyAvailability.findUnique({
      where: {
        userId_weekStartDate: {
          userId: authUser.id,
          weekStartDate: new Date(weekStartDate),
        },
      },
      include: { slots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] } },
    });
    return NextResponse.json({ weeklyAvailability: avail });
  }

  // List all weeks (latest first)
  const all = await db.weeklyAvailability.findMany({
    where: { userId: authUser.id },
    orderBy: { weekStartDate: "desc" },
    include: { slots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] } },
  });
  return NextResponse.json({ weeklyAvailabilities: all });
}

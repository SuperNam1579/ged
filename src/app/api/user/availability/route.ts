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
  // "Apply these changes to future weeks" — also save the edited slots as the
  // recurring template, so later weeks pre-fill with them.
  applyToFutureWeeks: z.boolean().optional(),
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

  const { weekStartDate: weekStartStr, slots, applyToFutureWeeks } = parsed.data;
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

    // "Apply to future weeks" → also persist these slots as the recurring
    // template so upcoming weeks pre-fill with them. Past snapshots are untouched.
    if (applyToFutureWeeks) {
      const template = await tx.weeklyAvailabilityTemplate.upsert({
        where: { userId: authUser.id },
        create: { userId: authUser.id },
        update: {},
      });
      await tx.weeklyAvailabilityTemplateSlot.deleteMany({ where: { templateId: template.id } });
      await tx.weeklyAvailabilityTemplateSlot.createMany({
        data: slots.map((s) => ({
          templateId: template.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      });
    }

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

  const allSubtopicData = subtopics.map((s: typeof subtopics[0]) => ({
    id: s.id,
    name: s.name,
    topicId: s.topicId,
    subjectCode: s.topic.category.subject.code,
    estimatedMinutes: s.estimatedMinutes,
    difficultyLevel: s.difficultyLevel,
    prerequisiteIds: s.prerequisites.map((p) => p.prerequisiteId),
  }));

  // Restrict the plan to the subjects the user chose in onboarding. Legacy
  // accounts with no saved selection fall back to all subjects so their plan
  // isn't left empty.
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

  // ── Generation window + budget ────────────────────────────────────────────
  // Plan only the days of THIS week that haven't passed yet, and size the budget
  // to the capacity of exactly those days — otherwise a full-week budget gets
  // crammed onto the couple of days that are actually left (e.g. everything
  // piled onto Sunday). If the current week has no days left at all, roll the
  // window (and budget) forward to next week so onboarding still gets a plan.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const slotMins = (s: { startTime: string; endTime: string }) => {
    const [sh, sm] = s.startTime.split(":").map(Number);
    const [eh, em] = s.endTime.split(":").map(Number);
    return Math.max(0, eh * 60 + em - (sh * 60 + sm));
  };

  // Capacity (minutes) of the available days inside [max(anchor,today), anchor+7).
  const windowStats = (anchor: Date) => {
    const start = anchor < today ? today : anchor;
    const end = new Date(anchor.getTime() + 7 * DAY_MS);
    let mins = 0;
    let dayCount = 0;
    for (const cur = new Date(start); cur < end; cur.setDate(cur.getDate() + 1)) {
      const daySlots = slots.filter((s) => s.dayOfWeek === cur.getDay());
      if (daySlots.length > 0) {
        dayCount++;
        for (const s of daySlots) mins += slotMins(s);
      }
    }
    return { mins, dayCount };
  };

  let genAnchor = weekStart;
  let { mins: totalSlotMins, dayCount } = windowStats(genAnchor);
  if (dayCount === 0) {
    // No study days left this week → generate for next week instead.
    genAnchor = new Date(weekStart.getTime() + 7 * DAY_MS);
    ({ mins: totalSlotMins, dayCount } = windowStats(genAnchor));
  }

  // ── Exclude subtopics already in the active plan (completed OR still pending) ─
  // This prevents the same topic from appearing twice across weeks.
  const alreadyInPlan = await db.studySession.findMany({
    where: { studyPlan: { userId: authUser.id, isActive: true } },
    select: { subtopicId: true },
    distinct: ["subtopicId"],
  });
  const alreadyIds = new Set(
    alreadyInPlan.map((s: { subtopicId: string }) => s.subtopicId)
  );
  const remaining = subtopicData.filter((s) => !alreadyIds.has(s.id));

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
        weekStartDate: genAnchor,
        weeklyAvailabilityId: weeklyAvail.id,
        // engine computes endDate = genAnchor + 7d and clamps the start to today,
        // so the window matches the [max(genAnchor,today), genAnchor+7) capacity
        // the budget above was sized against.
        subtopics: weekSubtopics,
        triggerReason: "SCHEDULE_CHANGE" as TriggerReason,
        existingPlanVersion: latestPlan?.version,
        appendToExisting: true,
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

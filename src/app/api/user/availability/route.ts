import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUserStrict } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { planWeek, savePlan } from "@/lib/ga/engine";
import { loadWorkItems } from "@/lib/schedule/work-items";
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

/** Saving availability plans the coming week with the GA; see ga/generate. */
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  const authUser = await getAuthUserStrict(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await checkRateLimit("plan-generate", req, authUser.id);
  if (limited) return limited;

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

  // ── Generation window ─────────────────────────────────────────────────────
  // Plan only the days of THIS week that haven't passed yet. If the current
  // week has no study days left, roll forward to next week so onboarding still
  // gets a plan. (planWeek clamps the start to today and sizes the week from
  // each remaining day's own length.)
  const DAY_MS = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hasDaysLeft = (anchor: Date) => {
    const end = new Date(anchor.getTime() + 7 * DAY_MS);
    for (const cur = new Date(anchor < today ? today : anchor); cur < end; cur.setDate(cur.getDate() + 1)) {
      if (slots.some((s) => s.dayOfWeek === cur.getDay())) return true;
    }
    return false;
  };
  const genAnchor = hasDaysLeft(weekStart) ? weekStart : new Date(weekStart.getTime() + 7 * DAY_MS);

  // ── What is left to schedule ─────────────────────────────────────────────
  // Per clip: anything already in the active plan (pending or done) or
  // completed under an earlier plan is covered. A subtopic whose earlier parts
  // are planned continues with its next part instead of being skipped whole.
  const pending = await loadWorkItems(authUser.id, subtopicData, "append");

  if (pending.length === 0) {
    return NextResponse.json({
      message: "All subtopics have been scheduled. Great work!",
      weeklyAvailabilityId: weeklyAvail.id,
    });
  }

  const GA_TIMEOUT_MS = 25000;

  try {
    const plan = await Promise.race([
      Promise.resolve().then(() =>
        planWeek({
          items: pending,
          subtopics: subtopicData,
          proficiencies: profMap,
          slots,
          weekStartDate: genAnchor,
        })
      ),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Study plan generation timed out. Please try again.")),
          GA_TIMEOUT_MS
        )
      ),
    ]);

    if (!plan) {
      return NextResponse.json({ weeklyAvailabilityId: weeklyAvail.id, message: "No study days left this week." });
    }

    const saved = await savePlan({
      userId: authUser.id,
      sessions: plan.sessions,
      fitness: plan.fitness,
      logs: plan.logs,
      cfg: plan.cfg,
      triggerReason: "SCHEDULE_CHANGE" as TriggerReason,
      weeklyAvailabilityId: weeklyAvail.id,
      append: true,
    });

    return NextResponse.json({
      weeklyAvailabilityId: weeklyAvail.id,
      studyPlanId: saved.studyPlanId,
      bestFitness: plan.fitness.total,
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

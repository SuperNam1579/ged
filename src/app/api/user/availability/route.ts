import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUserStrict } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { bangkokDateStr, mondayOf } from "@/lib/schedule/calendar";
import { planSummary, regeneratePlan, WEEK_LOCKED_MESSAGE } from "@/lib/schedule/regenerate";
import type { TriggerReason } from "@/types";

const SlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
}).refine(
  (s) => s.startTime < s.endTime,
  { message: "startTime must be before endTime" }
);

const isMonday = (d: string) => {
  const date = new Date(d);
  return !isNaN(date.getTime()) && date.getUTCDay() === 1;
};
const MondaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
  .refine(isMonday, "weekStartDate must be a valid Monday (ISO date)");

// One week, as the onboarding and the weekly confirm form send it.
const SingleWeekSchema = z.object({
  weekStartDate: MondaySchema,
  slots: z.array(SlotSchema).min(1, "At least one time slot is required"),
  // "Apply these changes to future weeks" — also save the edited slots as the
  // recurring template, so later weeks pre-fill with them.
  applyToFutureWeeks: z.boolean().optional(),
});

// Any number of weeks at once, for setting up the whole run to the exam.
//   slots: []   → a week off
//   slots: null → the week goes back to the learner's usual availability
const ManyWeeksSchema = z.object({
  weeks: z
    .array(z.object({ weekStartDate: MondaySchema, slots: z.array(SlotSchema).nullable() }))
    .min(1)
    .max(104)
    .refine((ws) => new Set(ws.map((w) => w.weekStartDate)).size === ws.length, "Each week may appear once"),
});

const AvailabilitySchema = z.union([SingleWeekSchema, ManyWeeksSchema]);

type Slot = z.infer<typeof SlotSchema>;

/** Saving availability re-plans everything to the exam with the GA; see lib/schedule/regenerate. */
export const maxDuration = 60;

/**
 * Saves the availability of one or more weeks, then plans again from today to
 * the exam with every week's availability — the weeks saved here and the
 * learner's usual week for the rest.
 */
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

  const weeks: { weekStartDate: string; slots: Slot[] | null }[] =
    "weeks" in parsed.data ? parsed.data.weeks : [{ weekStartDate: parsed.data.weekStartDate, slots: parsed.data.slots }];
  const template = "weeks" in parsed.data ? null : parsed.data.applyToFutureWeeks ? parsed.data.slots : null;

  // Weeks already over can't be studied any more; refuse rather than drop them.
  const currentMonday = mondayOf(bangkokDateStr());
  const past = weeks.find((w) => w.weekStartDate < currentMonday);
  if (past) {
    return NextResponse.json({ error: `The week of ${past.weekStartDate} is already over.` }, { status: 400 });
  }

  const preferences = await db.userPreferences.findUnique({
    where: { userId: authUser.id },
  });
  if (!preferences) {
    return NextResponse.json(
      { error: "Complete onboarding before submitting availability." },
      { status: 400 }
    );
  }

  const saved = await db.$transaction(
    async (tx) => {
      const ids: string[] = [];
      for (const week of weeks) {
        const weekStart = new Date(`${week.weekStartDate}T00:00:00Z`);
        const key = { userId_weekStartDate: { userId: authUser.id, weekStartDate: weekStart } };

        if (week.slots === null) {
          await tx.weeklyAvailability.deleteMany({ where: { userId: authUser.id, weekStartDate: weekStart } });
          continue;
        }

        const avail = await tx.weeklyAvailability.upsert({
          where: key,
          create: { userId: authUser.id, weekStartDate: weekStart },
          update: {},
        });
        await tx.availabilitySlot.deleteMany({ where: { weeklyAvailabilityId: avail.id } });
        if (week.slots.length > 0) {
          await tx.availabilitySlot.createMany({
            data: week.slots.map((s) => ({
              weeklyAvailabilityId: avail.id,
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              endTime: s.endTime,
            })),
          });
        }
        ids.push(avail.id);
      }

      // "Apply to future weeks" → also persist these slots as the recurring
      // template, which every week not set on its own follows.
      if (template) {
        const t = await tx.weeklyAvailabilityTemplate.upsert({
          where: { userId: authUser.id },
          create: { userId: authUser.id },
          update: {},
        });
        await tx.weeklyAvailabilityTemplateSlot.deleteMany({ where: { templateId: t.id } });
        await tx.weeklyAvailabilityTemplateSlot.createMany({
          data: template.map((s) => ({
            templateId: t.id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
        });
      }

      return ids;
    },
    { timeout: 30000 }
  );
  // The single-week form reads this back.
  const weeklyAvailabilityId = saved.length === 1 ? saved[0] : undefined;

  try {
    const result = await regeneratePlan(authUser.id, "SCHEDULE_CHANGE" as TriggerReason);

    if (result.status === "all-done") {
      return NextResponse.json({ message: "All subtopics have been scheduled. Great work!", weeklyAvailabilityId });
    }
    if (result.status === "week-locked") {
      return NextResponse.json({ message: WEEK_LOCKED_MESSAGE, weeklyAvailabilityId });
    }
    if (result.status !== "planned") {
      return NextResponse.json({ message: "No study time between now and your exam.", weeklyAvailabilityId });
    }
    return NextResponse.json({ weeklyAvailabilityId, ...planSummary(result) });
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

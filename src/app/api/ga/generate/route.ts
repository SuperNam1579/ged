import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUserStrict } from "@/lib/auth";
import { planWeek, savePlan } from "@/lib/ga/engine";
import { loadWorkItems } from "@/lib/schedule/work-items";
import { checkCsrf } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
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

/** Upper bound for the whole request; the weeks cap below keeps it well inside. */
export const maxDuration = 60;

/** Weeks planned per request — see where validWeeks is built. */
const MAX_WEEKS_PER_RUN = 12;

export async function POST(req: NextRequest) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  const authUser = await getAuthUserStrict(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await checkRateLimit("plan-generate", req, authUser.id);
  if (limited) return limited;

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

  // Bounded so one request can't outgrow the function's time limit: each week
  // is a GA run (≈0.5 s on the full curriculum, measured 2026-09-28), and
  // weeks beyond this are planned by the next regeneration as they come up.
  const validWeeks = allWeeks.filter((w) => w.slots.length > 0).slice(0, MAX_WEEKS_PER_RUN);
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

  // What is left to learn, per clip. A subtopic with one completed part still
  // has its other parts planned — the old "any completed session = finished"
  // rule would have dropped them.
  let pending = await loadWorkItems(authUser.id, subtopicData, "regenerate");

  if (pending.length === 0) {
    return NextResponse.json({ message: "All subtopics have been scheduled. Great work!" });
  }

  // 20s per week — allows up to 3 weeks before hitting a 60s function limit
  const GA_TIMEOUT_MS = 20000;

  let lastResult: { studyPlanId: string; bestFitness: number } | null = null;
  let planCreated = false;

  for (let i = 0; i < validWeeks.length; i++) {
    const week = validWeeks[i];
    if (pending.length === 0) break;

    const weekSlots = week.slots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    }));

    try {
      const plan = await Promise.race([
        Promise.resolve().then(() =>
          planWeek({
            items: pending,
            subtopics: subtopicData,
            proficiencies: profMap,
            slots: weekSlots,
            weekStartDate: week.weekStartDate,
          })
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Week ${i + 1} generation timed out.`)), GA_TIMEOUT_MS)
        ),
      ]);
      if (!plan) continue; // no study days left in this week

      const saved = await savePlan({
        userId: authUser.id,
        sessions: plan.sessions,
        fitness: plan.fitness,
        logs: plan.logs,
        cfg: plan.cfg,
        triggerReason: triggerReason as TriggerReason,
        weeklyAvailabilityId: week.id,
        // The first week that gets sessions replaces the active plan; later
        // weeks add to it.
        append: planCreated,
      });
      planCreated = true;
      // Unfinished parts continue first next week.
      pending = plan.leftovers;
      lastResult = { studyPlanId: saved.studyPlanId, bestFitness: plan.fitness.total };
    } catch (err) {
      console.error(`GA failed for week starting ${week.weekStartDate.toISOString()}:`, err);
      // If the first plan can't be made, abort; later weeks are best-effort.
      if (!planCreated) {
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
      unscheduledSubtopics: pending.length,
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

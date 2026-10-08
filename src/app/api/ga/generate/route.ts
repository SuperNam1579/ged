import { NextRequest, NextResponse } from "next/server";
import { getAuthUserStrict } from "@/lib/auth";
import { createInitialPlan, planSummary } from "@/lib/schedule/create-plan";
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

/** Upper bound for the whole request; createInitialPlan() budgets the GA inside it. */
export const maxDuration = 60;

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

  // The GA plans once. A learner with a plan edits it by hand, or resets it to
  // the GA's original (POST /api/plans/reset).
  const result = await createInitialPlan(authUser.id, triggerReason as TriggerReason);

  if (result.status === "no-preferences") {
    return NextResponse.json(
      { error: "User preferences not found. Complete onboarding first." },
      { status: 400 }
    );
  }
  if (result.status === "exists") {
    return NextResponse.json(
      { error: "You already have a study plan. Edit it, or reset it to the original plan." },
      { status: 409 }
    );
  }
  if (result.status === "all-done") {
    return NextResponse.json({ message: "All subtopics have been scheduled. Great work!" });
  }
  if (result.status === "no-study-days") {
    return NextResponse.json(
      {
        error:
          result.calendar.days.length === 0
            ? "Your exam date has passed. Set a new exam date to plan your study."
            : "No study time between now and your exam. Please enter your available time slots first.",
      },
      { status: 400 }
    );
  }

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
      fitnessScore: result.fitnessScore,
      sessions: result.sessionCount,
      studyDays: result.calendar.days.filter((d) => d.capacity > 0).length,
      unscheduledSubtopics: result.unscheduledSubtopics,
    },
    success: true,
  });

  return NextResponse.json({
    success: true,
    ...planSummary(result),
  });
}

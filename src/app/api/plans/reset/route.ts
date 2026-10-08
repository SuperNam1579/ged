import { NextRequest, NextResponse } from "next/server";
import { getAuthUserStrict } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { audit, extractRequestContext } from "@/lib/audit";
import { PlanEditError, resetPlan } from "@/lib/schedule/manual";

export const maxDuration = 60;

/**
 * POST /api/plans/reset — puts the GA's original plan back, undoing every
 * change the learner made. What they completed stays completed.
 */
export async function POST(req: NextRequest) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;
  const authUser = await getAuthUserStrict(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await resetPlan(authUser.id);
    const ctx = extractRequestContext(req);
    audit({
      action: "STUDY_PLAN_GENERATED",
      userId: authUser.id,
      entityType: "studyPlan",
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { reset: true, restoredSessions: result.restored },
      success: true,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PlanEditError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

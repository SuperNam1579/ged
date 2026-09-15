import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getPreAssessmentSnapshot } from "@/lib/pre-assessment";
import { resolvePostSignInRoute } from "@/lib/pre-assessment/status";

/**
 * GET /api/user/next-step
 *
 * The page a signed-in learner belongs on: onboarding, the pre-assessment, or
 * the dashboard. Every post-sign-in path asks this one route — the password
 * login, the Google /welcome hop, and the dashboard's own guard — so a learner
 * who dropped out of the pre-assessment is sent back to it however they return.
 */
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hasPreferences, status } = await getPreAssessmentSnapshot(authUser.id);

  return NextResponse.json({
    route: resolvePostSignInRoute({
      hasPreferences,
      preAssessmentComplete: status.isComplete,
    }),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getPlanStatus, PlanEditError } from "@/lib/schedule/manual";

/**
 * GET /api/plans/active — the plan's state for the schedule page: whether the
 * learner has edited it, whether it can be reset to the GA's original, and the
 * days where the timetable doesn't fit their free time (`conflicts`).
 */
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await getPlanStatus(authUser.id));
  } catch (err) {
    if (err instanceof PlanEditError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

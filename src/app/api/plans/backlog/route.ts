import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getBacklog, PlanEditError } from "@/lib/schedule/manual";

/**
 * GET /api/plans/backlog — content of the learner's subjects that isn't in the
 * plan: what didn't fit before the exam, what they removed, and the subtopics
 * of a subject they just added. What "add a session" picks from.
 */
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json({ backlog: await getBacklog(authUser.id) });
  } catch (err) {
    if (err instanceof PlanEditError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

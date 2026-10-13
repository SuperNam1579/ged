import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getTopicCatalog, PlanEditError } from "@/lib/schedule/manual";

/**
 * GET /api/plans/topics — every topic of every subject, with where it stands
 * for this learner (new / partly / planned / done), in the planner's order.
 * What the "add a session" picker shows; see getTopicCatalog().
 */
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await getTopicCatalog(authUser.id));
  } catch (err) {
    if (err instanceof PlanEditError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

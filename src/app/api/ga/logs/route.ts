import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activePlan = await db.studyPlan.findFirst({
    where: { userId: authUser.id, isActive: true },
    orderBy: { version: "desc" },
    select: { id: true, version: true, fitnessScore: true, metadata: true },
  });

  if (!activePlan) {
    return NextResponse.json({ logs: [], plan: null });
  }

  const logs = await db.gaExecutionLog.findMany({
    where: { studyPlanId: activePlan.id },
    orderBy: { generation: "asc" },
    select: {
      generation: true,
      bestFitness: true,
      avgFitness: true,
      worstFitness: true,
      metadata: true,
    },
  });

  return NextResponse.json({ logs, plan: activePlan });
}

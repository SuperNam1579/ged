import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plans = await db.studyPlan.findMany({
    where: { userId: authUser.id },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      fitnessScore: true,
      triggerReason: true,
      isActive: true,
      generatedAt: true,
      metadata: true,
      _count: { select: { sessions: true } },
    },
  });

  return NextResponse.json({ plans });
}

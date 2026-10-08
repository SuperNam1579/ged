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

  // `original` (the GA's sessions, kept for reset) is large and only the server needs it.
  return NextResponse.json({
    plans: plans.map((p) => {
      const { original: _original, ...metadata } = (p.metadata ?? {}) as Record<string, unknown>;
      return { ...p, metadata, hasOriginal: Array.isArray(_original) };
    }),
  });
}

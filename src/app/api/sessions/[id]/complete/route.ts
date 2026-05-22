import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUserStrict } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { audit, extractRequestContext } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  const authUser = await getAuthUserStrict(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const session = await db.studySession.findUnique({
    where: { id },
    include: { studyPlan: { select: { userId: true } } },
  });

  if (!session || session.studyPlan.userId !== authUser.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const updated = await db.studySession.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  const ctx = extractRequestContext(req);
  audit({
    action: "STUDY_SESSION_COMPLETED",
    userId: authUser.id,
    entityType: "studySession",
    entityId: id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    success: true,
  });

  return NextResponse.json({ session: updated });
}

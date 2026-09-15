import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUserStrict } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { audit, extractRequestContext } from "@/lib/audit";
import { getSubtopicResources } from "@/lib/resources";

/**
 * POST /api/sessions/:id/complete
 *
 * Marks a session done on request — for sessions whose subtopic has no videos,
 * where there is no watch progress to measure. A subtopic with videos is
 * completed through POST /api/sessions/:id/verify-completion instead, which
 * checks the 80% rule against stored progress.
 */

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

  // Without this, a direct POST marked any session complete and the 80% watch
  // gate on video sessions was decorative.
  const resources = await getSubtopicResources(session.subtopicId);
  if (resources.length > 0) {
    return NextResponse.json(
      { error: "This session has videos. Watch them to complete it." },
      { status: 409 }
    );
  }

  // Repeat calls (a retry after a lost response) succeed without moving the
  // original completion time.
  if (session.status === "COMPLETED") {
    return NextResponse.json({ session });
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

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUserStrict } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { audit, extractRequestContext } from "@/lib/audit";
import { getSessionResourceIds, getSubtopicResources } from "@/lib/resources";
import { isComplete, requiredSecFor } from "@/lib/resources/types";

/**
 * POST /api/sessions/:id/verify-completion
 *
 * Decides, from stored progress alone, whether a study session has been watched
 * through and flips it to COMPLETED if so.
 *
 * The request body is ignored on purpose. The client knows how far it has
 * played and would happily tell us, but a completion percentage supplied by the
 * party that benefits from it is not evidence. Everything below is read from
 * our own tables and our own durations.
 *
 * This is the strict sibling of POST /api/sessions/:id/complete, which marks a
 * session done on request. That one stays for sessions with no video attached;
 * this one is what the progress gate calls.
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

  // Same response for "does not exist" and "belongs to someone else", so this
  // endpoint can't be used to probe which session IDs are real.
  if (!session || session.studyPlan.userId !== authUser.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // A session that is one part of a split subtopic is complete when its own
  // clips are watched — not every clip in the subtopic, which used to demand
  // 88 videos before any Fractions session could be finished.
  const partIds = await getSessionResourceIds(session.id);
  const allResources = await getSubtopicResources(session.subtopicId);
  const resources = partIds ? allResources.filter((r) => partIds.includes(r.id)) : allResources;

  if (resources.length === 0) {
    return NextResponse.json(
      {
        eligible: false,
        reason: "no_resources",
        status: session.status,
        resources: [],
      },
      { status: 409 }
    );
  }

  const rows = await db.userResourceProgress.findMany({
    where: { userId: authUser.id, resourceId: { in: resources.map((r) => r.id) } },
    select: { resourceId: true, watchedSec: true, completedAt: true },
  });
  const progressById = new Map(rows.map((r) => [r.resourceId, r]));

  const breakdown = resources.map((r) => {
    const progress = progressById.get(r.id);
    const requiredSec = requiredSecFor(r);
    // A video is judged afresh from stored watch time. An article has none to
    // judge: it is done when /read accepted it, which is itself a server check
    // of time since opening.
    const complete =
      r.kind === "ARTICLE"
        ? Boolean(progress?.completedAt)
        : isComplete(progress?.watchedSec ?? 0, r.durationSec);
    return {
      resourceId: r.id,
      title: r.title,
      watchedSec: r.kind === "ARTICLE" ? (complete ? requiredSec : 0) : (progress?.watchedSec ?? 0),
      requiredSec,
      durationSec: r.durationSec,
      complete,
    };
  });

  const eligible = breakdown.every((b) => b.complete);

  if (!eligible) {
    return NextResponse.json({
      eligible: false,
      reason: "insufficient_watch_time",
      status: session.status,
      resources: breakdown,
    });
  }

  // Already completed — return success without touching completedAt, so the
  // original timestamp survives a repeated call.
  if (session.status === "COMPLETED") {
    return NextResponse.json({ eligible: true, status: session.status, resources: breakdown });
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

  return NextResponse.json({ eligible: true, status: updated.status, resources: breakdown });
}

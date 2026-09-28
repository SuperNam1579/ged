import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSessionResourceIds, getSubtopicResourcesWithProgress } from "@/lib/resources";
import { requiredSecFor } from "@/lib/resources/types";

/**
 * GET /api/subtopics/:id/resources
 *
 * Every resource for a subtopic, joined with the caller's watch progress.
 *
 * `?session=<id>` narrows the list to that session's part of the subtopic. A
 * long subtopic is split across several sessions, and a learner in part 2
 * should see and be measured on part 2's clips, not all ninety.
 *
 * `requiredSec` is computed here rather than shipped as a threshold constant:
 * the client needs it to draw the progress gate, but it must not be in a
 * position to decide what the threshold is. The server sends the target; the
 * server also checks it later. For an article it is the wait after opening
 * before "read" is accepted.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: subtopicId } = await params;

  let onlyIds: string[] | null = null;
  const sessionId = req.nextUrl.searchParams.get("session");
  if (sessionId) {
    const session = await db.studySession.findUnique({
      where: { id: sessionId },
      select: { subtopicId: true, studyPlan: { select: { userId: true } } },
    });
    if (!session || session.studyPlan.userId !== authUser.id || session.subtopicId !== subtopicId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    onlyIds = await getSessionResourceIds(sessionId);
  }

  const resources = await getSubtopicResourcesWithProgress(authUser.id, subtopicId, onlyIds);

  return NextResponse.json({
    resources: resources.map((r) => {
      const requiredSec = requiredSecFor(r);
      const completedAt = r.progress?.completedAt ?? null;
      return {
      id: r.id,
      kind: r.kind,
      youtubeId: r.youtubeId,
      url: r.url,
      wordCount: r.wordCount,
      title: r.title,
      channelTitle: r.channelTitle,
      durationSec: r.durationSec,
      lesson: r.placement?.lessonName ?? "",
      lessonId: r.placement?.lessonId ?? null,
      unit: r.placement?.unitName ?? "",
      unitId: r.placement?.unitId ?? null,
      order: r.order,
      requiredSec,
      // The gate adds these up across the session. An article has no watch
      // time, so it counts in full once read and not at all before.
      watchedSec: r.kind === "ARTICLE" ? (completedAt ? requiredSec : 0) : (r.progress?.watchedSec ?? 0),
      lastPosSec: r.progress?.lastPosSec ?? 0,
      completedAt,
      openedAt: r.progress?.openedAt ?? null,
      };
    }),
  });
}

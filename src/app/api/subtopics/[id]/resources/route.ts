import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getSubtopicResourcesWithProgress } from "@/lib/resources";
import { requiredWatchSec } from "@/lib/resources/types";

/**
 * GET /api/subtopics/:id/resources
 *
 * Every resource for a subtopic, joined with the caller's watch progress.
 *
 * `requiredSec` is computed here rather than shipped as a threshold constant:
 * the client needs it to draw the progress gate, but it must not be in a
 * position to decide what the threshold is. The server sends the target; the
 * server also checks it later.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: subtopicId } = await params;

  const resources = await getSubtopicResourcesWithProgress(authUser.id, subtopicId);

  return NextResponse.json({
    resources: resources.map((r) => ({
      id: r.id,
      youtubeId: r.youtubeId,
      title: r.title,
      channelTitle: r.channelTitle,
      durationSec: r.durationSec,
      order: r.order,
      requiredSec: requiredWatchSec(r.durationSec),
      watchedSec: r.progress?.watchedSec ?? 0,
      lastPosSec: r.progress?.lastPosSec ?? 0,
      completedAt: r.progress?.completedAt ?? null,
    })),
  });
}

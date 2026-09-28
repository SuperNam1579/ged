import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUserStrict } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { getResource } from "@/lib/resources";
import { requiredReadSec } from "@/lib/resources/types";

/**
 * POST /api/resources/:id/read
 *
 * Marks an article read — if enough time has passed since the learner opened
 * it. We can't see the reading happen on Khan, so the evidence is time: the
 * server compares its own record of when the article was opened with its own
 * clock. The button's countdown on the page is a courtesy; this is the check.
 *
 * Always answers `{ completedAt, remainingSec }`. Too early is an expected
 * outcome rather than an error: completedAt stays null and remainingSec says
 * how long is left, which the page uses to correct a countdown that drifted.
 * remainingSec is null when the article was never opened.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  const authUser = await getAuthUserStrict(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: resourceId } = await params;

  const limited = await checkRateLimit("resource-progress", req, `${authUser.id}:${resourceId}`);
  if (limited) return limited;

  const resource = await getResource(resourceId);
  if (!resource) return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  if (resource.kind !== "ARTICLE") {
    return NextResponse.json({ error: "Not an article" }, { status: 409 });
  }

  const prev = await db.userResourceProgress.findUnique({
    where: { userId_resourceId: { userId: authUser.id, resourceId } },
  });

  // Already read: return the original timestamp rather than moving it.
  if (prev?.completedAt) {
    return NextResponse.json({ completedAt: prev.completedAt.toISOString(), remainingSec: 0 });
  }

  if (!prev?.openedAt) {
    return NextResponse.json({ completedAt: null, remainingSec: null });
  }

  const requiredSec = requiredReadSec(resource.durationSec);
  const elapsedSec = (Date.now() - prev.openedAt.getTime()) / 1000;
  if (elapsedSec < requiredSec) {
    return NextResponse.json({ completedAt: null, remainingSec: Math.ceil(requiredSec - elapsedSec) });
  }

  const saved = await db.userResourceProgress.update({
    where: { userId_resourceId: { userId: authUser.id, resourceId } },
    data: { completedAt: new Date() },
  });

  return NextResponse.json({ completedAt: saved.completedAt!.toISOString(), remainingSec: 0 });
}

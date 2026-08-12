import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUserStrict } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { getResource } from "@/lib/resources";
import { isComplete, requiredWatchSec } from "@/lib/resources/types";

/**
 * POST /api/resources/:id/progress
 *
 * The player's heartbeat, fired every ~10 s and once more on pagehide.
 *
 * ── Why the numbers are not taken at face value ────────────────────────────
 * `watchedSec` originates in the browser, so it is an assertion, not a fact.
 * Deciding completion on the server is worth nothing if the server just adds up
 * whatever the client claims — a single crafted request with
 * `watchedSec: 999999` would finish the course.
 *
 * Two rules make the number honest:
 *
 *   1. It may only go up. Late or reordered heartbeats can't roll it back.
 *   2. It may only go up as fast as time actually passed. Between two beats,
 *      progress cannot exceed the wall-clock gap between them (plus headroom
 *      for 2x playback and network jitter).
 *
 * Together those mean the fastest possible route to "complete" is to genuinely
 * leave the video playing, which is the behaviour we were trying to measure.
 *
 * `lastPosSec` gets no such treatment — it is only a resume point, seeking
 * backwards is legitimate, and nothing is gated on it.
 */

const BodySchema = z.object({
  watchedSec: z.number().int().min(0).max(86400),
  lastPosSec: z.number().int().min(0).max(86400),
});

/**
 * How much watch time one second of wall clock may buy.
 *
 * YouTube allows playback up to 2x, so a truthful client can legitimately
 * report faster-than-real-time progress. The flat grace absorbs timer drift and
 * a slow round trip on an otherwise honest heartbeat.
 */
const MAX_RATE = 2;
const GRACE_SEC = 3;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  const authUser = await getAuthUserStrict(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: resourceId } = await params;

  // Bucket by account + resource, not by IP: a classroom behind one NAT would
  // otherwise throttle itself the moment two students opened the same video.
  const limited = await checkRateLimit(
    "resource-progress",
    req,
    `${authUser.id}:${resourceId}`
  );
  if (limited) return limited;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid progress payload" }, { status: 400 });
  }

  // Duration comes from our own records, never from the request body — it is
  // the denominator of the completion test.
  const resource = await getResource(resourceId);
  if (!resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  const lastPosSec = Math.min(parsed.data.lastPosSec, resource.durationSec);

  const prev = await db.userResourceProgress.findUnique({
    where: { userId_resourceId: { userId: authUser.id, resourceId } },
  });

  let watchedSec: number;

  if (!prev) {
    // No history to rate-limit against, so the only bound available is the
    // video's own length.
    watchedSec = Math.min(parsed.data.watchedSec, resource.durationSec);
  } else {
    const elapsedSec = (Date.now() - prev.updatedAt.getTime()) / 1000;
    const maxDelta = elapsedSec * MAX_RATE + GRACE_SEC;

    // Math.max(claim - stored, 0) discards any backwards claim; Math.min caps
    // the forward one. A replayed or stale beat therefore changes nothing.
    const delta = Math.min(Math.max(parsed.data.watchedSec - prev.watchedSec, 0), maxDelta);

    watchedSec = Math.min(prev.watchedSec + delta, resource.durationSec);
  }

  const completed = isComplete(watchedSec, resource.durationSec);

  // completedAt is written once and never cleared — a subtopic the learner has
  // finished must not un-finish itself because of a later stray heartbeat.
  const completedAt = prev?.completedAt ?? (completed ? new Date() : null);

  const saved = await db.userResourceProgress.upsert({
    where: { userId_resourceId: { userId: authUser.id, resourceId } },
    create: { userId: authUser.id, resourceId, watchedSec, lastPosSec, completedAt },
    update: { watchedSec, lastPosSec, completedAt },
  });

  return NextResponse.json({
    watchedSec: saved.watchedSec,
    lastPosSec: saved.lastPosSec,
    requiredSec: requiredWatchSec(resource.durationSec),
    durationSec: resource.durationSec,
    completedAt: saved.completedAt?.toISOString() ?? null,
  });
}

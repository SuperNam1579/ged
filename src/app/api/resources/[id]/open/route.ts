import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUserStrict } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { getResource } from "@/lib/resources";
import { requiredReadSec } from "@/lib/resources/types";

/**
 * POST /api/resources/:id/open
 *
 * Records that the learner opened an article on Khan. Called just before the
 * page opens in a new tab.
 *
 * The reading timer starts from the first open and is never restarted: opening
 * the article again, or opening it in several tabs, doesn't reset the wait for
 * someone who has already been reading. The time is taken from our clock, so
 * the client has nothing to report here but the fact of the click.
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

  const saved = prev?.openedAt
    ? prev
    : await db.userResourceProgress.upsert({
        where: { userId_resourceId: { userId: authUser.id, resourceId } },
        create: { userId: authUser.id, resourceId, openedAt: new Date() },
        update: { openedAt: new Date() },
      });

  return NextResponse.json({
    openedAt: saved.openedAt?.toISOString() ?? null,
    requiredSec: requiredReadSec(resource.durationSec),
    completedAt: saved.completedAt?.toISOString() ?? null,
  });
}

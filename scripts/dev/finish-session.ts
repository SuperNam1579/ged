/**
 * Finishes study sessions for testing, without sitting through the videos.
 * TEST DATABASE ONLY — refuses to run against production, whatever is set.
 *
 *   npx tsx scripts/dev/finish-session.ts <session id or /study/… link> [more…]
 *   npx tsx scripts/dev/finish-session.ts --watch-only <session id or link>
 *
 * Default: marks every clip of the session watched (and every article read)
 * and the session COMPLETED — what verify-completion does once the learner has
 * watched enough. The next part of the subtopic opens.
 *
 * --watch-only: marks the clips watched but leaves the session open, so the
 * completion button on the study page can be pressed by hand (to test the gate
 * and "part 2 waits for part 1").
 *
 * A session link is the URL of its study page, e.g.
 *   http://localhost:3000/study/cmv4t8r9j0005121r1wlko9yn?from=%2Fschedule
 */
import { db } from "@/lib/db";
import { requiredSecFor } from "@/lib/resources/types";
import { isProductionDatabase } from "../db/guard";

function sessionIdOf(arg: string): string {
  const m = arg.match(/\/study\/([^/?#]+)/);
  return m ? m[1] : arg.trim();
}

async function finish(sessionId: string, watchOnly: boolean) {
  const session = await db.studySession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      partIndex: true,
      subtopic: { select: { name: true } },
      studyPlan: { select: { userId: true, user: { select: { email: true } } } },
      resources: { select: { resource: { select: { id: true, kind: true, durationSec: true } } } },
    },
  });
  if (!session) {
    console.log(`✗ ${sessionId}: no such session`);
    return;
  }
  const label = `${session.subtopic.name}${session.partIndex ? ` · Part ${session.partIndex}` : ""} (${session.studyPlan.user.email})`;
  const userId = session.studyPlan.userId;
  const now = new Date();

  for (const { resource } of session.resources) {
    const watched = Math.max(requiredSecFor(resource), resource.durationSec);
    await db.userResourceProgress.upsert({
      where: { userId_resourceId: { userId, resourceId: resource.id } },
      create: { userId, resourceId: resource.id, watchedSec: watched, lastPosSec: resource.durationSec, completedAt: now },
      update: { watchedSec: watched, lastPosSec: resource.durationSec, completedAt: now },
    });
  }

  if (watchOnly) {
    console.log(`✓ ${label}: ${session.resources.length} clip(s) marked watched — press the button on the study page`);
    return;
  }
  if (session.status !== "COMPLETED") {
    await db.studySession.update({ where: { id: session.id }, data: { status: "COMPLETED", completedAt: now } });
  }
  console.log(`✓ ${label}: completed (${session.resources.length} clip(s))`);
}

async function main() {
  if (isProductionDatabase()) {
    throw new Error("This is the production database. finish-session.ts only runs against the test database.");
  }
  const args = process.argv.slice(2);
  const watchOnly = args.includes("--watch-only");
  const ids = args.filter((a) => !a.startsWith("--")).map(sessionIdOf);
  if (ids.length === 0) {
    console.log("Usage: npx tsx scripts/dev/finish-session.ts [--watch-only] <session id or /study/… link> [more…]");
    process.exit(1);
  }
  for (const id of ids) await finish(id, watchOnly);
}

main()
  .catch((e) => {
    console.error("ERR", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

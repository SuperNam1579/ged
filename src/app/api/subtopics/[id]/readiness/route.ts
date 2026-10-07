import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { WEAKNESS_THRESHOLD } from "@/lib/ga/constants";

/**
 * GET /api/subtopics/:id/readiness
 *
 * Whether the learner has passed what this subtopic builds on — for a warning,
 * never a lock: "This topic builds on Fractions, which you haven't passed yet.
 * Study it anyway?" A learner who fails a quiz may retake it, go back over the
 * material, or move on; this tells the topics that depend on it to say so.
 *
 * A prerequisite is passed when the learner's best quiz on it scored at least
 * 60% (the same line the planner calls weak). `bestScore: null` = no quiz yet.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const subtopic = await db.subtopic.findUnique({
    where: { id },
    select: {
      prerequisites: { select: { prerequisite: { select: { id: true, name: true } } } },
    },
  });
  if (!subtopic) return NextResponse.json({ error: "Subtopic not found" }, { status: 404 });

  const prerequisites = subtopic.prerequisites.map((p) => p.prerequisite);
  const attempts = prerequisites.length
    ? await db.userAssessmentAttempt.findMany({
        where: {
          userId: authUser.id,
          completedAt: { not: null },
          assessment: { type: "QUIZ", subtopicId: { in: prerequisites.map((p) => p.id) } },
        },
        select: { score: true, assessment: { select: { subtopicId: true } } },
      })
    : [];

  const best = new Map<string, number>();
  for (const a of attempts) {
    const sid = a.assessment.subtopicId!;
    best.set(sid, Math.max(best.get(sid) ?? 0, a.score));
  }

  const unmet = prerequisites
    .map((p) => ({ subtopicId: p.id, name: p.name, bestScore: best.get(p.id) ?? null }))
    .filter((p) => p.bestScore === null || p.bestScore < WEAKNESS_THRESHOLD);

  return NextResponse.json({ ready: unmet.length === 0, passScore: WEAKNESS_THRESHOLD, unmet });
}

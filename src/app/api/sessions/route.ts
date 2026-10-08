import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUser, getAuthUserStrict } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { addSession, PlanEditError } from "@/lib/schedule/manual";

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD

  const activePlan = await db.studyPlan.findFirst({
    where: { userId: authUser.id, isActive: true },
    orderBy: { version: "desc" },
    select: { id: true, version: true, fitnessScore: true, triggerReason: true, generatedAt: true },
  });

  if (!activePlan) {
    return NextResponse.json({ sessions: [], plan: null });
  }

  const dateFilter = date
    ? { gte: new Date(date), lt: new Date(new Date(date).getTime() + 86400000) }
    : undefined;

  const sessions = await db.studySession.findMany({
    where: {
      studyPlanId: activePlan.id,
      ...(dateFilter ? { scheduledDate: dateFilter } : {}),
    },
    include: {
      resources: {
        select: { resource: { select: { order: true, lessonRef: { select: { unit: { select: { name: true } } } } } } },
      },
      subtopic: {
        include: {
          topic: {
            include: {
              category: {
                include: { subject: { select: { code: true, name: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: [{ scheduledDate: "asc" }, { order: "asc" }],
  });

  const formatted = sessions.map((s: typeof sessions[0]) => ({
    id: s.id,
    subtopicId: s.subtopicId,
    subtopicName: s.subtopic.name,
    subjectCode: s.subtopic.topic.category.subject.code,
    subjectName: s.subtopic.topic.category.subject.name,
    topicName: s.subtopic.topic.name,
    scheduledDate: s.scheduledDate.toISOString().split("T")[0],
    durationMins: s.durationMins,
    order: s.order,
    status: s.status,
    /** STUDY = new content; REVIEW = going back over a subtopic before the exam. */
    kind: s.kind,
    learningUrl: s.subtopic.learningUrl,
    difficultyLevel: s.subtopic.difficultyLevel,
    partIndex: s.partIndex,
    partCount: s.partCount,
    unitNames: [
      ...new Set(
        [...s.resources]
          .sort((a, b) => a.resource.order - b.resource.order)
          .map((r) => r.resource.lessonRef?.unit.name)
          .filter((n): n is string => !!n)
      ),
    ],
  }));

  return NextResponse.json({ sessions: formatted, plan: activePlan });
}

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");

const AddSchema = z.object({
  subtopicId: z.string().min(1),
  scheduledDate: DateSchema,
  durationMins: z.number().int().min(5).max(600).optional(),
  kind: z.enum(["STUDY", "REVIEW"]).optional(),
});

/**
 * POST /api/sessions — adds a session to the plan by hand.
 *
 * STUDY covers the next part of the subtopic not yet planned (as much as fits
 * `durationMins`, or all of it); REVIEW goes back over it. See lib/schedule/manual.
 */
export async function POST(req: NextRequest) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;
  const authUser = await getAuthUserStrict(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = AddSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await addSession(authUser.id, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof PlanEditError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

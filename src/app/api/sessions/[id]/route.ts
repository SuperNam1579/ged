import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUser, getAuthUserStrict } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { deleteSession, PlanEditError, updateSession } from "@/lib/schedule/manual";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const session = await db.studySession.findUnique({
    where: { id },
    include: {
      studyPlan: { select: { userId: true } },
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
          // Shown in the session meta bar. Named "prerequisites" on the
          // dependent side: these are the subtopics this one builds on.
          prerequisites: {
            select: { prerequisite: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  if (!session || session.studyPlan.userId !== authUser.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // For a session that is one part of a split subtopic: the units it covers,
  // and the next part still to do, so the page can say "next: Thursday"
  // instead of offering the subtopic quiz halfway through the subtopic.
  const isPart = session.resources.length > 0;
  const firstOrder = isPart ? Math.min(...session.resources.map((r) => r.resource.order)) : 0;
  const unitNames = [
    ...new Set(
      [...session.resources]
        .sort((a, b) => a.resource.order - b.resource.order)
        .map((r) => r.resource.lessonRef?.unit.name)
        .filter((n): n is string => !!n)
    ),
  ];

  let nextPart: { id: string; scheduledDate: string } | null = null;
  if (isPart) {
    const siblings = await db.studySession.findMany({
      where: {
        studyPlanId: session.studyPlanId,
        subtopicId: session.subtopicId,
        id: { not: session.id },
        status: { not: "COMPLETED" },
        resources: { some: {} },
      },
      select: { id: true, scheduledDate: true, resources: { select: { resource: { select: { order: true } } } } },
    });
    const later = siblings
      .map((s) => ({ ...s, first: Math.min(...s.resources.map((r) => r.resource.order)) }))
      .filter((s) => s.first > firstOrder)
      .sort((a, b) => a.first - b.first)[0];
    if (later) nextPart = { id: later.id, scheduledDate: later.scheduledDate.toISOString().split("T")[0] };
  }

  // The subtopic quiz belongs after its last part. partCount stays null until
  // every clip is scheduled, so an unknown total is never treated as "last".
  const isLastPart = !isPart || (session.partIndex !== null && session.partIndex === session.partCount) ||
    (session.partIndex === null && nextPart === null);

  return NextResponse.json({
    session: {
      id: session.id,
      subtopicId: session.subtopicId,
      subtopicName: session.subtopic.name,
      subtopicDescription: session.subtopic.description,
      subjectCode: session.subtopic.topic.category.subject.code,
      subjectName: session.subtopic.topic.category.subject.name,
      topicName: session.subtopic.topic.name,
      scheduledDate: session.scheduledDate.toISOString().split("T")[0],
      durationMins: session.durationMins,
      order: session.order,
      status: session.status,
      learningUrl: session.subtopic.learningUrl,
      difficultyLevel: session.subtopic.difficultyLevel,
      estimatedMinutes: session.subtopic.estimatedMinutes,
      prerequisites: session.subtopic.prerequisites.map((p) => p.prerequisite.name),
      partIndex: session.partIndex,
      partCount: session.partCount,
      unitNames,
      isLastPart,
      nextPart,
    },
  });
}

const UpdateSchema = z
  .object({
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
    order: z.number().int().min(-100000).max(100000).optional(),
    durationMins: z.number().int().min(5).max(600).optional(),
    subtopicId: z.string().min(1).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to change");

/**
 * PATCH /api/sessions/:id — changes a session by hand: move it to another day
 * or position, change its length, or put another subtopic in its place.
 * Completed sessions can't be changed. See lib/schedule/manual.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;
  const authUser = await getAuthUserStrict(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  try {
    await updateSession(authUser.id, id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PlanEditError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

/** DELETE /api/sessions/:id — removes a session; its content goes back to the backlog. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;
  const authUser = await getAuthUserStrict(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await deleteSession(authUser.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PlanEditError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

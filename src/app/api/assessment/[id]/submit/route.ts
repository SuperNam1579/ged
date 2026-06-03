import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUserStrict } from "@/lib/auth";
import { updateProficiency } from "@/lib/utils/proficiency";
import { checkAdaptiveTrigger } from "@/lib/ga/engine";
import { checkCsrf } from "@/lib/csrf";
import { audit, extractRequestContext } from "@/lib/audit";
import { z } from "zod";

const SubmitSchema = z.object({
  responses: z.array(
    z.object({
      questionId: z.string(),
      selectedOption: z.string(),
      timeSpent: z.number().optional(),
    })
  ),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  const authUser = await getAuthUserStrict(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: assessmentId } = await params;
  const body = await req.json();
  const parsed = SubmitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }

  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      questions: {
        select: {
          id: true,
          correctOptionId: true,
          explanation: true,
          subtopicId: true,
        },
      },
    },
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  type QuestionRecord = {
    id: string;
    correctOptionId: string;
    explanation: string | null;
    subtopicId: string | null;
  };

  const questionMap = new Map<string, QuestionRecord>(
    assessment.questions.map((q) => [q.id, q])
  );

  const { responses } = parsed.data;

  // Deduplicate by questionId (keep first occurrence) and drop unknown question IDs
  const seenIds = new Set<string>();
  const validResponses = responses.filter((r) => {
    if (seenIds.has(r.questionId) || !questionMap.has(r.questionId)) return false;
    seenIds.add(r.questionId);
    return true;
  });

  if (validResponses.length === 0) {
    return NextResponse.json({ error: "No valid responses submitted" }, { status: 400 });
  }

  type GradedResponse = {
    questionId: string;
    selectedOption: string;
    isCorrect: boolean;
    correctOption: string;
    explanation: string | undefined;
    timeSpent: number | undefined;
    subtopicId: string | null;
  };

  // Grade responses
  const gradedResponses: GradedResponse[] = validResponses.flatMap((r) => {
    const question = questionMap.get(r.questionId);
    if (!question) return [];
    return [{
      questionId: r.questionId,
      selectedOption: r.selectedOption,
      isCorrect: r.selectedOption === question.correctOptionId,
      correctOption: question.correctOptionId,
      explanation: question.explanation ?? undefined,
      timeSpent: r.timeSpent,
      subtopicId: question.subtopicId,
    }];
  });

  const rawScore = gradedResponses.filter((r) => r.isCorrect).length;
  const maxScore = assessment.questions.length;
  const score = maxScore > 0 ? (rawScore / maxScore) * 100 : 0;

  // Persist attempt
  const attempt = await db.userAssessmentAttempt.create({
    data: {
      userId: authUser.id,
      assessmentId,
      score,
      rawScore,
      maxScore,
      completedAt: new Date(),
      responses: {
        create: gradedResponses.map((r) => ({
          userId: authUser.id,
          questionId: r.questionId,
          selectedOption: r.selectedOption,
          isCorrect: r.isCorrect,
          timeSpent: r.timeSpent,
        })),
      },
    },
  });

  // Update proficiency per subtopic
  const subtopicScores = new Map<string, { correct: number; total: number }>();
  for (const r of gradedResponses) {
    if (!r.subtopicId) continue;
    const current = subtopicScores.get(r.subtopicId) ?? { correct: 0, total: 0 };
    subtopicScores.set(r.subtopicId, {
      correct: current.correct + (r.isCorrect ? 1 : 0),
      total: current.total + 1,
    });
  }

  for (const [subtopicId, { correct, total }] of subtopicScores) {
    const newScore = (correct / total) * 100;
    const existing = await db.userSubtopicProficiency.findUnique({
      where: { userId_subtopicId: { userId: authUser.id, subtopicId } },
    });

    const updatedScore = existing
      ? updateProficiency(existing.score, newScore)
      : newScore;

    await db.userSubtopicProficiency.upsert({
      where: { userId_subtopicId: { userId: authUser.id, subtopicId } },
      update: {
        score: updatedScore,
        attemptCount: { increment: 1 },
        lastUpdated: new Date(),
      },
      create: {
        userId: authUser.id,
        subtopicId,
        score: updatedScore,
        attemptCount: 1,
      },
    });
  }

  // Check adaptive triggers for QUIZ and MOCK
  let triggered = null;
  if (assessment.type === "QUIZ" && assessment.subtopicId) {
    const trigger = await checkAdaptiveTrigger(
      authUser.id,
      assessment.subtopicId,
      score,
      "QUIZ"
    );
    if (trigger.triggered) {
      triggered = { gaRerun: true, reason: trigger.reason };
    }
  } else if (assessment.type === "MOCK") {
    const trigger = await checkAdaptiveTrigger(
      authUser.id,
      "",
      score,
      "MOCK"
    );
    if (trigger.triggered) {
      triggered = { gaRerun: true, reason: trigger.reason };
    }
  }

  // Identify weak subtopics from this attempt
  const weakSubtopics = Array.from(subtopicScores.entries())
    .filter(([, { correct, total }]) => (correct / total) < 0.6)
    .map(([id]) => id);

  const ctx = extractRequestContext(req);
  audit({
    action: "ASSESSMENT_SUBMITTED",
    userId: authUser.id,
    entityType: "assessment",
    entityId: assessmentId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    metadata: {
      attemptId: attempt.id,
      assessmentType: assessment.type,
      score,
      rawScore,
      maxScore,
      weakSubtopicsCount: weakSubtopics.length,
    },
    success: true,
  });

  return NextResponse.json({
    attemptId: attempt.id,
    score,
    rawScore,
    maxScore,
    correctCount: rawScore,
    incorrectCount: maxScore - rawScore,
    responses: gradedResponses,
    weakSubtopics,
    triggered,
  });
}

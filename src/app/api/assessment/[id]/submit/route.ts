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
  // Sent only by the pre-assessment page. It opts the request into
  // once-per-subject semantics (see below); the mock test can submit PRE
  // assessments as a fallback and must keep being allowed to repeat them.
  purpose: z.literal("PRE_ASSESSMENT").optional(),
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

  // A pre-assessment section is taken once per subject. The page retries a
  // submission whose response never arrived, and the first request may well
  // have been saved — without this, the retry would record a second attempt and
  // feed the same answers into proficiency twice. Report the stored result
  // instead, in the same shape the page reads from a fresh submission.
  if (parsed.data.purpose === "PRE_ASSESSMENT") {
    if (assessment.type !== "PRE" || !assessment.subjectId) {
      return NextResponse.json({ error: "Not a pre-assessment" }, { status: 400 });
    }
    const existing = await db.userAssessmentAttempt.findFirst({
      where: {
        userId: authUser.id,
        completedAt: { not: null },
        assessment: { type: "PRE", subjectId: assessment.subjectId },
      },
      orderBy: { completedAt: "desc" },
      select: { id: true, score: true, rawScore: true, maxScore: true },
    });
    if (existing) {
      return NextResponse.json({
        attemptId: existing.id,
        score: existing.score,
        rawScore: existing.rawScore,
        maxScore: existing.maxScore,
        correctCount: existing.rawScore,
        incorrectCount: existing.maxScore - existing.rawScore,
        responses: [],
        weakSubtopics: [],
        triggered: null,
        alreadySubmitted: true,
      });
    }
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

  // The attempt and the proficiency updates it causes are written in ONE
  // transaction. They used to be two separate writes, so a failure in between
  // left an attempt with no proficiency effect — and now that a pre-assessment
  // retry returns the stored attempt instead of re-grading, that gap would
  // never be filled.
  const createAttempt = db.userAssessmentAttempt.create({
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

  // Batch-fetch every touched subtopic's existing proficiency in ONE query,
  // then apply all upserts in a single transaction. This replaces the previous
  // per-subtopic findUnique→upsert loop, which fired up to ~2×N sequential
  // round-trips to the database — the cause of the long pause on the last
  // question of each subject in the pre-assessment.
  const subtopicIds = Array.from(subtopicScores.keys());
  let proficiencyWrites: ReturnType<typeof db.userSubtopicProficiency.upsert>[] = [];
  if (subtopicIds.length > 0) {
    const existingProfs = await db.userSubtopicProficiency.findMany({
      where: { userId: authUser.id, subtopicId: { in: subtopicIds } },
      select: { subtopicId: true, score: true },
    });
    const existingScoreMap = new Map(existingProfs.map((p) => [p.subtopicId, p.score]));

    const now = new Date();
    const upserts = subtopicIds.map((subtopicId) => {
      const { correct, total } = subtopicScores.get(subtopicId)!;
      const newScore = (correct / total) * 100;
      const existingScore = existingScoreMap.get(subtopicId);
      const updatedScore = existingScore !== undefined
        ? updateProficiency(existingScore, newScore)
        : newScore;

      return db.userSubtopicProficiency.upsert({
        where: { userId_subtopicId: { userId: authUser.id, subtopicId } },
        update: {
          score: updatedScore,
          attemptCount: { increment: 1 },
          lastUpdated: now,
        },
        create: {
          userId: authUser.id,
          subtopicId,
          score: updatedScore,
          attemptCount: 1,
        },
      });
    });

    proficiencyWrites = upserts;
  }

  const [attempt] = await db.$transaction([createAttempt, ...proficiencyWrites]);

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

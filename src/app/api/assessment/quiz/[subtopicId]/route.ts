import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subtopicId: string }> }
) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subtopicId } = await params;

  // Always look up the subtopic to get name + subject chain
  const subtopic = await db.subtopic.findUnique({
    where: { id: subtopicId },
    include: {
      topic: {
        include: {
          category: {
            include: { subject: { select: { code: true, name: true } } },
          },
        },
      },
    },
  });
  if (!subtopic) return NextResponse.json({ error: "Subtopic not found" }, { status: 404 });

  let assessment = await db.assessment.findFirst({
    where: { type: "QUIZ", subtopicId },
    include: {
      questions: {
        select: {
          id: true,
          text: true,
          options: true,
          difficulty: true,
          subtopicId: true,
        },
        take: 5,
      },
    },
  });

  if (!assessment) {
    const OPTION_IDS = ["A", "B", "C", "D"] as const;
    assessment = await db.assessment.create({
      data: {
        type: "QUIZ",
        subtopicId,
        title: `${subtopic.name} Quiz`,
        timeLimit: 10,
        questions: {
          create: Array.from({ length: 5 }, (_, questionIndex) => {
            const correctIndex = Math.floor(Math.random() * 4);
            const correctOptionId = OPTION_IDS[correctIndex];
            const distractors = [
              `A common misconception about ${subtopic.name}`,
              `An approach that ignores key principles of ${subtopic.name}`,
              `An unrelated concept often confused with ${subtopic.name}`,
            ];
            let distractorIdx = 0;
            return {
              subtopicId,
              text: `Question ${questionIndex + 1}: Which of the following best applies to "${subtopic.name}"?`,
              options: OPTION_IDS.map((id, i) => ({
                id,
                text: i === correctIndex
                  ? `The correct application of ${subtopic.name}`
                  : distractors[distractorIdx++],
              })),
              correctOptionId,
              explanation: `Understanding ${subtopic.name} is essential for the GED exam.`,
              source: "AI_GENERATED",
              difficulty: subtopic.difficultyLevel,
            };
          }),
        },
      },
      include: {
        questions: {
          select: {
            id: true,
            text: true,
            options: true,
            difficulty: true,
            subtopicId: true,
          },
        },
      },
    });
  }

  return NextResponse.json({
    assessmentId: assessment.id,
    subjectCode: subtopic.topic.category.subject.code,
    subjectName: subtopic.topic.category.subject.name,
    subtopicName: subtopic.name,
    questions: assessment.questions,
  });
}

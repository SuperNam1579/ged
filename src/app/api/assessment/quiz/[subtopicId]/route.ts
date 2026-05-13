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

  // Find or create a quiz assessment for this subtopic
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
    // Auto-create a 5-question quiz for this subtopic
    const subtopic = await db.subtopic.findUnique({ where: { id: subtopicId } });
    if (!subtopic) return NextResponse.json({ error: "Subtopic not found" }, { status: 404 });

    assessment = await db.assessment.create({
      data: {
        type: "QUIZ",
        subtopicId,
        title: `${subtopic.name} Quiz`,
        timeLimit: 10,
        questions: {
          create: Array.from({ length: 5 }, (_, i) => ({
            subtopicId,
            text: `Question ${i + 1}: Which of the following best applies to "${subtopic.name}"?`,
            options: [
              { id: "A", text: "The correct application of this concept" },
              { id: "B", text: "An incorrect approach that ignores key principles" },
              { id: "C", text: "A common misconception about this topic" },
              { id: "D", text: "An unrelated concept" },
            ],
            correctOptionId: "A",
            explanation: `Understanding ${subtopic.name} is essential for the GED exam.`,
            source: "AI_GENERATED",
            difficulty: subtopic.difficultyLevel,
          })),
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

  return NextResponse.json({ assessment });
}

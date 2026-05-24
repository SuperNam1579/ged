import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subjects = await db.subject.findMany({
    include: {
      categories: {
        include: {
          topics: {
            include: {
              subtopics: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  learningUrl: true,
                  estimatedMinutes: true,
                  difficultyLevel: true,
                  prerequisites: { select: { prerequisiteId: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Attach proficiency scores
  const proficiencies = await db.userSubtopicProficiency.findMany({
    where: { userId: authUser.id },
    select: { subtopicId: true, score: true },
  });

  const profMap = new Map(proficiencies.map((p: { subtopicId: string; score: number }) => [p.subtopicId, p.score]));

  const enriched = subjects.map((subject) => ({
    ...subject,
    categories: subject.categories.map((cat) => ({
      ...cat,
      topics: cat.topics.map((topic) => ({
        ...topic,
        subtopics: topic.subtopics.map(({ prerequisites, ...st }) => ({
          ...st,
          prerequisiteIds: prerequisites.map((p) => p.prerequisiteId),
          proficiencyScore: profMap.get(st.id) ?? 0,
        })),
      })),
    })),
  }));

  return NextResponse.json({ subjects: enriched });
}

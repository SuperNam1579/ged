/**
 * Content that arrives after the plan was made: a lesson imported without its
 * videos, whose videos — and another new lesson — are added later.
 *
 *   npm run test:smoke
 *
 * DEVELOPMENT database only. Makes its own video-less lesson in RLA rather than
 * relying on what the curriculum has, so it holds whatever RLA contains. Adds a
 * throwaway user, two lessons and one clip, and removes them all afterwards.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { checkFeasibility, createInitialPlan } from "@/lib/schedule/create-plan";
import { addDaysStr, bangkokDateStr } from "@/lib/schedule/calendar";
import { getBacklog, getPlanStatus } from "@/lib/schedule/manual";
import { isProductionDatabase } from "./guard";

process.loadEnvFile(".env");
if (isProductionDatabase()) throw new Error("Refusing to run smoke tests against the PRODUCTION database.");

const stamp = Date.now();
let userId = "";
let clipId = "";
let newSubtopicId = "";
let rlaSubtopicId = "";
let rlaTopicId = "";

beforeAll(async () => {
  // A lesson with no videos yet, in an existing RLA topic.
  const topic = await db.topic.findFirstOrThrow({ where: { category: { subject: { code: "RLA" } } }, select: { id: true } });
  rlaTopicId = topic.id;
  rlaSubtopicId = (
    await db.subtopic.create({
      data: { topicId: rlaTopicId, name: `Smoke video-less ${stamp}`, description: "Smoke", learningUrl: "", estimatedMinutes: 30, difficultyLevel: 1 },
      select: { id: true },
    })
  ).id;

  const user = await db.user.create({ data: { email: `smoke-late-${stamp}@example.test`, name: "Smoke Late" } });
  userId = user.id;
  await db.userPreferences.create({
    data: { userId, targetExamDate: new Date(`${addDaysStr(bangkokDateStr(), 40)}T00:00:00Z`), selectedSubjectCodes: ["RLA"] },
  });
  await db.weeklyAvailabilityTemplate.create({
    data: {
      userId,
      slots: { create: [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startTime: "18:00", endTime: "20:00" })) },
    },
  });
});

afterAll(async () => {
  // The user first: their sessions point at the lessons.
  if (userId) await db.user.delete({ where: { id: userId } });
  if (clipId) await db.resource.deleteMany({ where: { id: clipId } });
  if (newSubtopicId) await db.subtopic.deleteMany({ where: { id: newSubtopicId } });
  if (rlaSubtopicId) await db.subtopic.deleteMany({ where: { id: rlaSubtopicId } });
  await db.$disconnect();
});

describe("content that arrives later", () => {
  it("checks a subject with no videos yet at its estimates, and plans it", async () => {
    const f = (await checkFeasibility(userId))!;
    const rla = f.subjects.find((s) => s.subjectCode === "RLA")!;
    expect(rla.requiredMinutes).toBeGreaterThan(0);
    expect(rla.estimatedSubtopics).toBeGreaterThanOrEqual(1); // at least our video-less lesson
    expect(f.warnings.some((w) => w.code === "estimated-time")).toBe(true);

    const result = await createInitialPlan(userId, "INITIAL");
    expect(result.status).toBe("planned");
  });

  it("flags a planned session once its subtopic's videos arrive", async () => {
    // Our video-less lesson got one session, at its estimate.
    await db.studySession.findFirstOrThrow({
      where: { studyPlan: { userId, isActive: true }, subtopicId: rlaSubtopicId, kind: "STUDY", resources: { none: {} } },
    });
    clipId = `${rlaSubtopicId}-smoke-${stamp}`;
    await db.resource.create({
      data: { id: clipId, subtopicId: rlaSubtopicId, kind: "VIDEO", title: "Smoke clip", channelTitle: "Smoke", durationSec: 600, order: 9999 },
    });

    const { contentUpdates } = await getPlanStatus(userId);
    const update = contentUpdates.find((u) => u.subtopicId === rlaSubtopicId);
    expect(update).toBeDefined();
    expect(update!.contentMinutes).toBe(13); // 10 minutes of video × 1.3 study time

    // A fresh check counts the clip instead of the estimate.
    const f = (await checkFeasibility(userId))!;
    const before = f.subjects.find((s) => s.subjectCode === "RLA")!;
    expect(["mixed", "clips"]).toContain(before.source);
  });

  it("puts a lesson added later in the backlog, ready to plan by hand", async () => {
    const created = await db.subtopic.create({
      data: { topicId: rlaTopicId, name: `Smoke lesson ${stamp}`, description: "Smoke", learningUrl: "", estimatedMinutes: 45, difficultyLevel: 2 },
      select: { id: true },
    });
    newSubtopicId = created.id;

    const backlog = await getBacklog(userId);
    expect(backlog.find((b) => b.subtopicId === newSubtopicId)).toMatchObject({ remainingMinutes: 45, partlyPlanned: false });
  });
});

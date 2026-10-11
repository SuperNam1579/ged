/**
 * Content that arrives after the plan was made: a subject imported without
 * its videos (RLA today), whose videos — and a new lesson — are added later.
 *
 *   npm run test:smoke
 *
 * DEVELOPMENT database only. Adds a throwaway user, one clip and one subtopic
 * to RLA, and removes all three afterwards.
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

beforeAll(async () => {
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
  if (clipId) await db.resource.deleteMany({ where: { id: clipId } });
  if (newSubtopicId) await db.subtopic.deleteMany({ where: { id: newSubtopicId } });
  if (userId) await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
});

describe("content that arrives later", () => {
  it("checks a subject with no videos yet at its estimates, and plans it", async () => {
    const f = (await checkFeasibility(userId))!;
    const rla = f.subjects.find((s) => s.subjectCode === "RLA")!;
    expect(rla.requiredMinutes).toBeGreaterThan(0);
    expect(["estimate", "mixed"]).toContain(rla.source);
    expect(f.warnings.some((w) => w.code === "estimated-time")).toBe(true);

    const result = await createInitialPlan(userId, "INITIAL");
    expect(result.status).toBe("planned");
  });

  it("flags a planned session once its subtopic's videos arrive", async () => {
    const session = await db.studySession.findFirstOrThrow({
      where: { studyPlan: { userId, isActive: true }, kind: "STUDY", resources: { none: {} } },
      select: { subtopicId: true },
    });
    rlaSubtopicId = session.subtopicId;
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
    expect(f.subjects.find((s) => s.subjectCode === "RLA")!.source).toBe("mixed");
  });

  it("puts a lesson added later in the backlog, ready to plan by hand", async () => {
    const topicId = (await db.subtopic.findUniqueOrThrow({ where: { id: rlaSubtopicId }, select: { topicId: true } })).topicId;
    const created = await db.subtopic.create({
      data: { topicId, name: `Smoke lesson ${stamp}`, description: "Smoke", learningUrl: "", estimatedMinutes: 45, difficultyLevel: 2 },
      select: { id: true },
    });
    newSubtopicId = created.id;

    const backlog = await getBacklog(userId);
    expect(backlog.find((b) => b.subtopicId === newSubtopicId)).toMatchObject({ remainingMinutes: 45, partlyPlanned: false });
  });
});

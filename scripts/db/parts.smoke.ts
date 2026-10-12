/**
 * A long subtopic is planned as parts, and part 2 waits for part 1 — in the
 * plan (no edit may reorder them) and at study time (it can't be completed
 * before part 1).
 *
 *   npm run test:smoke
 *
 * DEVELOPMENT database only; one throwaway user, deleted afterwards. Uses MATH.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createInitialPlan } from "@/lib/schedule/create-plan";
import { addDaysStr, bangkokDateStr } from "@/lib/schedule/calendar";
import { swapSessions, updateSession } from "@/lib/schedule/manual";
import { earlierPartPending } from "@/lib/schedule/part-gate";
import { isProductionDatabase } from "./guard";

process.loadEnvFile(".env");
if (isProductionDatabase()) throw new Error("Refusing to run smoke tests against the PRODUCTION database.");

let userId = "";
const exam = addDaysStr(bangkokDateStr(), 60);

beforeAll(async () => {
  const user = await db.user.create({ data: { email: `smoke-parts-${Date.now()}@example.test`, name: "Smoke Parts" } });
  userId = user.id;
  await db.userPreferences.create({
    data: { userId, targetExamDate: new Date(`${exam}T00:00:00Z`), selectedSubjectCodes: ["MATH"] },
  });
  await db.weeklyAvailabilityTemplate.create({
    data: {
      userId,
      slots: { create: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: "18:00", endTime: "20:00" })) },
    },
  });
});

afterAll(async () => {
  if (userId) await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
});

describe("parts", () => {
  let p1 = { id: "", date: "" };
  let p2 = { id: "", date: "" };

  it("plans a long subtopic as parts in order", async () => {
    const result = await createInitialPlan(userId, "INITIAL");
    expect(result.status).toBe("planned");

    const sessions = await db.studySession.findMany({
      where: { studyPlan: { userId, isActive: true }, kind: "STUDY", resources: { some: {} } },
      select: { id: true, subtopicId: true, scheduledDate: true, order: true, resources: { select: { resource: { select: { order: true } } } } },
    });
    const bySubtopic = new Map<string, typeof sessions>();
    for (const s of sessions) bySubtopic.set(s.subtopicId, [...(bySubtopic.get(s.subtopicId) ?? []), s]);
    const split = [...bySubtopic.values()].find((g) => g.length >= 2);
    expect(split).toBeDefined();

    const parts = split!
      .map((s) => ({ ...s, first: Math.min(...s.resources.map((r) => r.resource.order)), date: s.scheduledDate.toISOString().slice(0, 10) }))
      .sort((a, b) => a.first - b.first);
    // In the GA's plan, each part comes on or after the one before.
    for (let i = 1; i < parts.length; i++) expect(parts[i].date >= parts[i - 1].date).toBe(true);
    p1 = parts[0];
    p2 = parts[1];
  });

  it("won't let an edit put part 2 before part 1", async () => {
    await expect(swapSessions(userId, p1.id, p2.id)).rejects.toMatchObject({ status: 409 });
    const later = addDaysStr(p2.date, 1) < exam ? addDaysStr(p2.date, 1) : p2.date;
    await expect(updateSession(userId, p1.id, { scheduledDate: later, order: 9999 })).rejects.toMatchObject({ status: 409 });
    // Nothing changed.
    const after = await db.studySession.findUniqueOrThrow({ where: { id: p1.id }, select: { scheduledDate: true } });
    expect(after.scheduledDate.toISOString().slice(0, 10)).toBe(p1.date);
  });

  it("keeps part 2 locked until part 1 is done", async () => {
    expect(await earlierPartPending(userId, p1.id)).toBeNull();
    expect(await earlierPartPending(userId, p2.id)).toMatchObject({ sessionId: p1.id, scheduledDate: p1.date });

    await db.studySession.update({ where: { id: p1.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    expect(await earlierPartPending(userId, p2.id)).toBeNull();
  });
});

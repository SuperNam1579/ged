/**
 * The plan lifecycle against a real database: the GA plans once, the learner
 * edits by hand, reset brings the GA's plan back.
 *
 *   npm run test:smoke
 *
 * Needs a DEVELOPMENT database with the curriculum seeded (see .env.example).
 * Refuses to run against production. Makes one throwaway user and deletes it
 * afterwards, with everything it owns.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { checkFeasibility, createInitialPlan } from "@/lib/schedule/create-plan";
import { addDaysStr, bangkokDateStr } from "@/lib/schedule/calendar";
import { clipMinutes } from "@/lib/schedule/parts";
import {
  addSession,
  deleteSession,
  getBacklog,
  getPlanStatus,
  PlanEditError,
  resetPlan,
  swapSessions,
  updateSession,
} from "@/lib/schedule/manual";
import { isProductionDatabase } from "./guard";

process.loadEnvFile(".env");
if (isProductionDatabase()) throw new Error("Refusing to run smoke tests against the PRODUCTION database.");

const email = `smoke-${Date.now()}@example.test`;
let userId = "";
const today = bangkokDateStr();
let exam = addDaysStr(today, 50);
let droppedSubject: string | null = null;

const sessionsOf = async (planId: string) =>
  db.studySession.findMany({
    where: { studyPlanId: planId },
    orderBy: [{ scheduledDate: "asc" }, { order: "asc" }],
    select: { id: true, subtopicId: true, scheduledDate: true, durationMins: true, kind: true, status: true, resources: { select: { resourceId: true } } },
  });
const dateOf = (d: Date) => d.toISOString().slice(0, 10);
/**
 * Study sessions that are a whole subtopic on their own — free to move
 * anywhere. Parts of a split subtopic must stay in order (parts.smoke.ts).
 */
const singlesOf = async (planId: string) => {
  const study = (await sessionsOf(planId)).filter((s) => s.kind === "STUDY");
  const count = new Map<string, number>();
  for (const s of study) count.set(s.subtopicId, (count.get(s.subtopicId) ?? 0) + 1);
  return study.filter((s) => count.get(s.subtopicId) === 1);
};

beforeAll(async () => {
  const user = await db.user.create({ data: { email, name: "Smoke Test" } });
  userId = user.id;
  await db.userPreferences.create({
    data: { userId, targetExamDate: new Date(`${exam}T00:00:00Z`), selectedSubjectCodes: ["MATH", "SCI"] },
  });
  await db.weeklyAvailabilityTemplate.create({
    data: {
      userId,
      // Mon–Fri 18:00–20:00, Saturday 09:00–12:00
      slots: {
        create: [
          ...[1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startTime: "18:00", endTime: "20:00" })),
          { dayOfWeek: 6, startTime: "09:00", endTime: "12:00" },
        ],
      },
    },
  });
});

afterAll(async () => {
  if (userId) await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
});

describe("plan lifecycle", () => {
  let planId = "";

  it("won't run the GA when the time doesn't fit the subjects, and says what to change", async () => {
    // 50 days of evenings don't hold all of MATH and SCI.
    const result = await createInitialPlan(userId, "INITIAL");
    expect(result.status).toBe("infeasible");
    if (result.status !== "infeasible") return;
    const f = result.feasibility;
    expect(f.canPlan).toBe(false);
    expect(f.shortfallMinutes).toBeGreaterThan(0);
    expect(f.suggestions.extraMinutesPerWeek).toBeGreaterThan(0);
    expect(await db.studyPlan.count({ where: { userId } })).toBe(0);

    // A what-if with far more time fits, and saves nothing.
    const roomy = await checkFeasibility(userId, {
      template: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: "08:00", endTime: "20:00" })),
    });
    expect(roomy?.canPlan).toBe(true);
    expect(await db.studyPlan.count({ where: { userId } })).toBe(0);

    // Follow the advice: drop a subject it names, or move the exam to the date it gives.
    if (f.suggestions.dropOneOf?.length) {
      droppedSubject = f.suggestions.dropOneOf[0];
      await db.userPreferences.update({
        where: { userId },
        data: { selectedSubjectCodes: ["MATH", "SCI"].filter((c) => c !== droppedSubject) },
      });
    } else {
      await db.userPreferences.update({
        where: { userId },
        data: { targetExamDate: new Date(`${f.suggestions.suggestedExamDate}T00:00:00Z`) },
      });
      exam = f.suggestions.suggestedExamDate!;
    }
    expect((await checkFeasibility(userId))?.canPlan).toBe(true);
  });

  it("the GA makes a plan to the exam, with review days, once", async () => {
    const result = await createInitialPlan(userId, "INITIAL");
    expect(result.status).toBe("planned");
    if (result.status !== "planned") return;
    planId = result.studyPlanId;
    expect(result.feasibility.canPlan).toBe(true);

    const sessions = await sessionsOf(planId);
    expect(sessions.length).toBe(result.sessionCount + result.reviewSessionCount);
    expect(sessions.every((s) => dateOf(s.scheduledDate) >= today && dateOf(s.scheduledDate) < exam)).toBe(true);
    expect(sessions.some((s) => s.kind === "REVIEW")).toBe(true);

    const plan = await db.studyPlan.findUniqueOrThrow({ where: { id: planId } });
    expect(Array.isArray((plan.metadata as Record<string, unknown>).original)).toBe(true);

    // Never twice.
    expect((await createInitialPlan(userId, "INITIAL")).status).toBe("exists");

    // Bring the dropped subject back: its subtopics wait in the backlog, unplanned.
    if (droppedSubject) {
      await db.userPreferences.update({ where: { userId }, data: { selectedSubjectCodes: ["MATH", "SCI"] } });
    }
  });

  it("starts unedited and resettable", async () => {
    const status = await getPlanStatus(userId);
    expect(status.plan).toMatchObject({ id: planId, customized: false, canReset: true });
  });

  it("adds a session from the backlog and marks the plan edited", async () => {
    const backlog = await getBacklog(userId);
    expect(backlog.length).toBeGreaterThan(0); // the subject dropped to make it fit, or what was left over
    const pick = backlog.find((b) => !b.partlyPlanned) ?? backlog[0];

    const day = addDaysStr(today, 3);
    const { sessionId } = await addSession(userId, { subtopicId: pick.subtopicId, scheduledDate: day, durationMins: 30 });
    const added = (await sessionsOf(planId)).find((s) => s.id === sessionId)!;
    expect(dateOf(added.scheduledDate)).toBe(day);
    // As long as the clips it covers take — as many as fit in 30 minutes
    // (at least one) — never the number asked for when the content differs.
    const clips = await db.resource.findMany({
      where: { id: { in: added.resources.map((r) => r.resourceId) } },
      select: { durationSec: true, kind: true },
    });
    if (clips.length > 0) {
      const covered = clips.reduce((a, c) => a + clipMinutes(c.durationSec, c.kind), 0);
      expect(added.durationMins).toBe(Math.max(1, Math.round(covered)));
      if (clips.length > 1) expect(covered).toBeLessThanOrEqual(30 + 1e-6);
    }

    expect((await getPlanStatus(userId)).plan.customized).toBe(true);
    const after = await getBacklog(userId);
    const left = after.find((b) => b.subtopicId === pick.subtopicId);
    expect(!left || left.remainingMinutes < pick.remainingMinutes).toBe(true);
  });

  it("moves, re-lengthens and swaps sessions", async () => {
    const [a, b] = await singlesOf(planId);
    const target = addDaysStr(today, 10);
    await updateSession(userId, a.id, { scheduledDate: target, durationMins: 45 });
    let moved = (await sessionsOf(planId)).find((s) => s.id === a.id)!;
    expect(dateOf(moved.scheduledDate)).toBe(target);
    expect(moved.durationMins).toBe(45);

    const bDate = dateOf(b.scheduledDate);
    await swapSessions(userId, a.id, b.id);
    moved = (await sessionsOf(planId)).find((s) => s.id === a.id)!;
    expect(dateOf(moved.scheduledDate)).toBe(bDate);
  });

  it("puts another subtopic in a session's place, giving its clips back", async () => {
    const session = (await singlesOf(planId)).find((s) => s.resources.length > 0)!;
    const backlog = await getBacklog(userId);
    // One with nothing planned yet, so its first part has no later parts to keep order with.
    const other = backlog.find((b) => b.subtopicId !== session.subtopicId && !b.partlyPlanned)!;

    await updateSession(userId, session.id, { subtopicId: other.subtopicId });
    const replaced = (await sessionsOf(planId)).find((s) => s.id === session.id)!;
    expect(replaced.subtopicId).toBe(other.subtopicId);
    const oldClips = new Set(session.resources.map((r) => r.resourceId));
    expect(replaced.resources.some((r) => oldClips.has(r.resourceId))).toBe(false);
    // The old subtopic's clips are free again.
    expect((await getBacklog(userId)).some((b) => b.subtopicId === session.subtopicId)).toBe(true);
  });

  it("refuses to plan on a past day or after the exam", async () => {
    const s = (await sessionsOf(planId))[0];
    await expect(updateSession(userId, s.id, { scheduledDate: addDaysStr(today, -1) })).rejects.toBeInstanceOf(PlanEditError);
    await expect(updateSession(userId, s.id, { scheduledDate: exam })).rejects.toBeInstanceOf(PlanEditError);
  });

  it("flags a day planned past its free time", async () => {
    // Sunday has no free time in this learner's week.
    let sunday = addDaysStr(today, 1);
    while (new Date(`${sunday}T00:00:00Z`).getUTCDay() !== 0) sunday = addDaysStr(sunday, 1);
    const [s] = await singlesOf(planId);
    await updateSession(userId, s.id, { scheduledDate: sunday });
    const { conflicts } = await getPlanStatus(userId);
    expect(conflicts.some((c) => c.date === sunday && c.reason === "no-time")).toBe(true);
  });

  it("deletes a session, and completed ones can't be touched", async () => {
    const [x, y] = (await sessionsOf(planId)).filter((s) => s.kind === "STUDY");
    await deleteSession(userId, x.id);
    expect((await sessionsOf(planId)).some((s) => s.id === x.id)).toBe(false);

    await db.studySession.update({ where: { id: y.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    await expect(deleteSession(userId, y.id)).rejects.toMatchObject({ status: 409 });
  });

  it("reset brings the GA's plan back and keeps what was completed", async () => {
    const plan = await db.studyPlan.findUniqueOrThrow({ where: { id: planId } });
    const original = (plan.metadata as { original: { subtopicId: string; scheduledDate: string }[] }).original;
    const completed = (await sessionsOf(planId)).find((s) => s.status === "COMPLETED")!;

    const { restored } = await resetPlan(userId);
    const after = await sessionsOf(planId);

    expect(after.some((s) => s.id === completed.id)).toBe(true); // still there, still done
    expect(after.filter((s) => s.status !== "COMPLETED")).toHaveLength(restored);
    expect(restored).toBeGreaterThanOrEqual(original.length - 1); // at most the completed one is left out
    // Same days as the GA planned.
    const originalDays = new Set(original.map((s) => s.scheduledDate));
    expect(after.filter((s) => s.status !== "COMPLETED").every((s) => originalDays.has(dateOf(s.scheduledDate)))).toBe(true);
    expect((await getPlanStatus(userId)).plan.customized).toBe(false);
  });
});

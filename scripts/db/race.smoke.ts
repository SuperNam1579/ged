/**
 * Two "make my plan" requests at once (a double click, two tabs) make one plan.
 *
 *   npm run test:smoke
 *
 * DEVELOPMENT database only; one throwaway user, deleted afterwards.
 */

import { afterAll, beforeAll, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createInitialPlan } from "@/lib/schedule/create-plan";
import { addDaysStr, bangkokDateStr } from "@/lib/schedule/calendar";
import { isProductionDatabase } from "./guard";

process.loadEnvFile(".env");
if (isProductionDatabase()) throw new Error("Refusing to run smoke tests against the PRODUCTION database.");

let userId = "";

beforeAll(async () => {
  const user = await db.user.create({ data: { email: `smoke-race-${Date.now()}@example.test`, name: "Smoke Race" } });
  userId = user.id;
  await db.userPreferences.create({
    data: { userId, targetExamDate: new Date(`${addDaysStr(bangkokDateStr(), 40)}T00:00:00Z`), selectedSubjectCodes: ["RLA"] },
  });
  await db.weeklyAvailabilityTemplate.create({
    data: { userId, slots: { create: [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startTime: "18:00", endTime: "20:00" })) } },
  });
});

afterAll(async () => {
  if (userId) await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
});

it("makes one plan when two requests race", async () => {
  const results = await Promise.all([createInitialPlan(userId, "INITIAL"), createInitialPlan(userId, "INITIAL")]);
  expect(results.map((r) => r.status).sort()).toEqual(["exists", "planned"]);
  expect(await db.studyPlan.count({ where: { userId } })).toBe(1);
});

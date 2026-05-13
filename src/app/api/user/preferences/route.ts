import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { z } from "zod";

const PreferencesSchema = z.object({
  targetExamDate: z.string(),
  hoursPerDay: z.number().min(0.5).max(12),
  targetScore: z.number().min(145).max(175),
  studyGoal: z.enum(["PASS", "COLLEGE_READY", "COLLEGE_READY_CREDIT"]),
  availability: z.object({
    mon: z.boolean(),
    tue: z.boolean(),
    wed: z.boolean(),
    thu: z.boolean(),
    fri: z.boolean(),
    sat: z.boolean(),
    sun: z.boolean(),
  }),
});

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = PreferencesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { targetExamDate, hoursPerDay, targetScore, studyGoal, availability } = parsed.data;

  const prefs = await db.userPreferences.upsert({
    where: { userId: authUser.id },
    update: { targetExamDate: new Date(targetExamDate), hoursPerDay, targetScore, studyGoal, availability },
    create: {
      userId: authUser.id,
      targetExamDate: new Date(targetExamDate),
      hoursPerDay,
      targetScore,
      studyGoal,
      availability,
    },
  });

  return NextResponse.json({ preferences: prefs });
}

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prefs = await db.userPreferences.findUnique({ where: { userId: authUser.id } });
  return NextResponse.json({ preferences: prefs });
}

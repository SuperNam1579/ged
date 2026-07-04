import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, getAuthUserStrict } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { audit, extractRequestContext } from "@/lib/audit";
import { z } from "zod";

const PreferencesSchema = z.object({
  targetExamDate: z.string().refine((d) => {
    const date = new Date(d);
    if (isNaN(date.getTime())) return false;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return date >= tomorrow;
  }, "Exam date must be at least tomorrow"),

  targetScore: z.number()
    .min(145, "Minimum passing score is 145")
    .max(200, "Maximum GED score is 200"),

  studyGoal: z.literal("PASS"),

  // Optional so existing callers that only update targetExamDate (e.g. Settings)
  // keep working without re-selecting subjects every time.
  selectedSubjectCodes: z.array(z.enum(["MATH", "RLA", "SCI", "SS"])).min(1).optional(),
});

export async function POST(req: NextRequest) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  const authUser = await getAuthUserStrict(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = PreferencesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { targetExamDate, targetScore, studyGoal, selectedSubjectCodes } = parsed.data;

  const prefs = await db.userPreferences.upsert({
    where: { userId: authUser.id },
    update: {
      targetExamDate: new Date(targetExamDate),
      targetScore,
      studyGoal,
      // Only touch this field when the caller actually sent a selection, so a
      // partial update (e.g. Settings only changing the exam date) doesn't
      // wipe out the subjects chosen during onboarding.
      ...(selectedSubjectCodes ? { selectedSubjectCodes } : {}),
    },
    create: {
      userId: authUser.id,
      targetExamDate: new Date(targetExamDate),
      targetScore,
      studyGoal,
      selectedSubjectCodes: selectedSubjectCodes ?? [],
    },
  });

  const ctx = extractRequestContext(req);
  audit({
    action: "USER_PREFERENCES_UPDATED",
    userId: authUser.id,
    entityType: "preferences",
    entityId: prefs.id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    metadata: { targetScore, studyGoal },
    success: true,
  });

  return NextResponse.json({ preferences: prefs });
}

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prefs = await db.userPreferences.findUnique({ where: { userId: authUser.id } });
  return NextResponse.json({ preferences: prefs });
}

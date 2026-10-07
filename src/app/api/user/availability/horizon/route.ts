import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { loadStudyCalendar } from "@/lib/schedule/regenerate";

// Every week from this one to the exam, with the availability the planner will
// use for it. Read-only.
//
// Per week:
//   source "week"     → the learner set this week on its own (slots: [] = a week off)
//   source "template" → the week follows the learner's usual availability
//
// The first week starts today and the last ends the day before the exam, so
// either may hold fewer than 7 days. To change weeks, POST them to
// /api/user/availability as { weeks: [{ weekStartDate, slots }] } — the whole
// plan is regenerated once for all of them.
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const preferences = await db.userPreferences.findUnique({
    where: { userId: authUser.id },
    select: { targetExamDate: true },
  });
  if (!preferences) {
    return NextResponse.json({ error: "Complete onboarding first." }, { status: 400 });
  }

  const calendar = await loadStudyCalendar(authUser.id, preferences.targetExamDate);

  return NextResponse.json({
    from: calendar.from,
    examDate: calendar.examDate,
    totalMinutes: calendar.totalMinutes,
    studyDays: calendar.days.filter((d) => d.capacity > 0).length,
    weeks: calendar.weeks,
  });
}

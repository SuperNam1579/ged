import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

// Resolve the availability for a given week WITHOUT writing anything.
//
//   ?weekStartDate=YYYY-MM-DD  (must be a Monday)
//
// Returns, per weekday:
//   - the confirmed snapshot (WeeklyAvailability) if the plan for this week was
//     already generated → source "confirmed", OR
//   - an in-memory DRAFT projected from the recurring template → source "template".
//
// Nothing is persisted here — the snapshot is only written when the user hits
// "Generate Study Plan" (POST /api/user/availability).
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const weekStartStr = new URL(req.url).searchParams.get("weekStartDate");
  if (!weekStartStr || !/^\d{4}-\d{2}-\d{2}$/.test(weekStartStr)) {
    return NextResponse.json({ error: "weekStartDate (YYYY-MM-DD) is required" }, { status: 400 });
  }
  const weekStart = new Date(`${weekStartStr}T00:00:00`);
  if (isNaN(weekStart.getTime()) || weekStart.getDay() !== 1) {
    return NextResponse.json({ error: "weekStartDate must be a valid Monday" }, { status: 400 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // The seven dates of this week, each tagged with whether it has already passed.
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      dayOfWeek: d.getDay(),
      isPast: d < today,
    };
  });

  // 1) Already-generated week → return the frozen snapshot.
  const snapshot = await db.weeklyAvailability.findUnique({
    where: { userId_weekStartDate: { userId: authUser.id, weekStartDate: weekStart } },
    include: { slots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] } },
  });
  if (snapshot) {
    return NextResponse.json({
      weekStartDate: weekStartStr,
      source: "confirmed",
      days,
      slots: snapshot.slots.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })),
    });
  }

  // 2) Not generated yet → draft from the recurring template (in memory only).
  const template = await db.weeklyAvailabilityTemplate.findUnique({
    where: { userId: authUser.id },
    include: { slots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] } },
  });

  return NextResponse.json({
    weekStartDate: weekStartStr,
    source: "template",
    hasTemplate: !!template,
    days,
    slots: (template?.slots ?? []).map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })),
  });
}

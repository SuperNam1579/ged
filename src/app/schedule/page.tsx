"use client";

import { useEffect, useState, useCallback } from "react";
import { addDays, format, startOfWeek, isSameDay, parseISO, differenceInCalendarWeeks } from "date-fns";
import {
  ChevronLeft, ChevronRight, Clock, CheckCircle2, Circle,
  BookOpen, Plus, X, CalendarDays, Loader2,
} from "lucide-react";
import Link from "next/link";
import MainLayout from "@/components/layout/MainLayout";
import Spinner from "@/components/ui/Spinner";
import { useAuth } from "@/lib/hooks/useAuth";
import { cn } from "@/lib/utils/cn";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SessionEntry {
  id: string;
  subtopicId: string;
  subtopicName: string;
  subjectCode: string;
  subjectName: string;
  scheduledDate: string;
  durationMins: number;
  status: string;
  difficultyLevel: number;
}

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

type TimeSlot = { id: string; start: string; end: string };
type DaySchedule = { enabled: boolean; slots: TimeSlot[] };
type Schedule = Record<number, DaySchedule>;

// ─── Constants ──────────────────────────────────────────────────────────────

const SUBJECT_COLOR: Record<string, { badge: string; dot: string }> = {
  MATH: { badge: "bg-blue-100 text-blue-700",    dot: "bg-blue-500" },
  RLA:  { badge: "bg-green-100 text-green-700",   dot: "bg-green-500" },
  SS:   { badge: "bg-amber-100 text-amber-700",   dot: "bg-amber-500" },
  SCI:  { badge: "bg-purple-100 text-purple-700", dot: "bg-purple-500" },
};
const SUBJECT_LABEL: Record<string, string> = {
  MATH: "Math", RLA: "Language Arts", SS: "Social Studies", SCI: "Science",
};
const WEEK_DAYS = [
  { label: "Mon", dow: 1 }, { label: "Tue", dow: 2 }, { label: "Wed", dow: 3 },
  { label: "Thu", dow: 4 }, { label: "Fri", dow: 5 }, { label: "Sat", dow: 6 },
  { label: "Sun", dow: 0 },
];
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  const value = `${String(h).padStart(2, "0")}:${m}`;
  return { value, label: value };
});
const EMPTY_SCHEDULE: Schedule = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6].map((d) => [d, { enabled: false, slots: [] }])
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function relativeWeekLabel(diff: number): string {
  if (diff === 0)  return "This week";
  if (diff === 1)  return "Next week";
  if (diff === -1) return "Last week";
  if (diff > 1)    return `In ${diff} weeks`;
  return `${Math.abs(diff)} weeks ago`;
}

function scheduleToSlots(schedule: Schedule): Array<{ dayOfWeek: number; startTime: string; endTime: string }> {
  return Object.entries(schedule).flatMap(([dow, day]) =>
    day.enabled
      ? day.slots
          .filter((s) => s.start < s.end)
          .map((s) => ({ dayOfWeek: Number(dow), startTime: s.start, endTime: s.end }))
      : []
  );
}

// ─── WeekScheduleSetup ───────────────────────────────────────────────────────

function WeekScheduleSetup({
  weekStart,
  csrfToken,
  onSuccess,
}: {
  weekStart: Date;
  csrfToken: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [schedule, setSchedule] = useState<Schedule>(EMPTY_SCHEDULE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const toggleDay = (dow: number) =>
    setSchedule((prev) => ({
      ...prev,
      [dow]: { ...prev[dow], enabled: !prev[dow].enabled, slots: prev[dow].enabled ? [] : [{ id: crypto.randomUUID(), start: "00:00", end: "00:00" }] },
    }));

  const addSlot = (dow: number) =>
    setSchedule((prev) => ({
      ...prev,
      [dow]: { ...prev[dow], slots: [...prev[dow].slots, { id: crypto.randomUUID(), start: "00:00", end: "00:00" }] },
    }));

  const removeSlot = (dow: number, id: string) =>
    setSchedule((prev) => ({
      ...prev,
      [dow]: { ...prev[dow], slots: prev[dow].slots.filter((s) => s.id !== id) },
    }));

  const updateSlot = (dow: number, id: string, field: "start" | "end", value: string) =>
    setSchedule((prev) => ({
      ...prev,
      [dow]: {
        ...prev[dow],
        slots: prev[dow].slots.map((s) => s.id === id ? { ...s, [field]: value } : s),
      },
    }));

  const validSlots = scheduleToSlots(schedule);
  const canSubmit = validSlots.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const weekStartDate = format(weekStart, "yyyy-MM-dd");
      const res = await fetch("/api/user/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ weekStartDate, slots: validSlots }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? "Failed to save schedule.");
      } else if (d.message) {
        // All subtopics already scheduled — nothing new to add
        setInfoMsg(d.message);
      } else {
        onSuccess();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
        <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-600 mb-1">No schedule set for this week</p>
        <p className="text-xs text-gray-400 mb-4">Add your available study times to generate a plan</p>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Set up schedule for {relativeWeekLabel(1)}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/30">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-blue-100">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Set up schedule · {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d")}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Choose the days and times you can study</p>
        </div>
        <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Day rows */}
      <div className="p-4 space-y-3">
        {WEEK_DAYS.map(({ label, dow }) => {
          const day = schedule[dow];
          return (
            <div key={dow} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Day toggle */}
              <div className="flex items-center gap-3 px-4 py-2.5">
                <button
                  onClick={() => toggleDay(dow)}
                  className={cn(
                    "w-10 h-5 rounded-full transition-colors relative shrink-0",
                    day.enabled ? "bg-blue-600" : "bg-gray-200"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                    day.enabled ? "translate-x-5" : "translate-x-0.5"
                  )} />
                </button>
                <span className={cn("text-sm font-medium w-8", day.enabled ? "text-gray-900" : "text-gray-400")}>
                  {label}
                </span>
                {day.enabled && day.slots.length === 0 && (
                  <span className="text-xs text-gray-400 italic">No time slots — add one</span>
                )}
              </div>

              {/* Slots */}
              {day.enabled && (
                <div className="border-t border-gray-100 px-4 py-2 space-y-2 bg-gray-50/50">
                  {day.slots.map((slot) => {
                    const invalid = slot.start >= slot.end && slot.end !== "00:00";
                    return (
                      <div key={slot.id} className="flex items-center gap-2">
                        <select
                          value={slot.start}
                          onChange={(e) => updateSlot(dow, slot.id, "start", e.target.value)}
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                        >
                          {TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <span className="text-gray-400 text-xs shrink-0">to</span>
                        <select
                          value={slot.end}
                          onChange={(e) => updateSlot(dow, slot.id, "end", e.target.value)}
                          className={cn(
                            "flex-1 text-sm border rounded-lg px-2 py-1.5 bg-white",
                            invalid ? "border-red-300" : "border-gray-200"
                          )}
                        >
                          {TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <button
                          onClick={() => removeSlot(dow, slot.id)}
                          className="p-1 hover:bg-red-50 rounded-md transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-400" />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => addSlot(dow)}
                    className="flex items-center gap-1.5 text-xs text-blue-600 font-medium hover:text-blue-700 py-0.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add time slot
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {error && <p className="text-red-600 text-sm px-1">{error}</p>}
        {infoMsg && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
            {infoMsg} — Go to <strong>Settings → Regenerate My Study Plan</strong> to start a fresh plan.
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className={cn(
            "w-full py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2",
            canSubmit && !submitting
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          )}
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating plan…</>
          ) : (
            "Generate Plan for This Week"
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [csrfToken, setCsrfToken] = useState("");

  const currentWeekMon = startOfWeek(new Date(), { weekStartsOn: 1 });
  const [weekStart, setWeekStart] = useState(currentWeekMon);

  useEffect(() => {
    fetch("/api/csrf")
      .then((r) => r.json())
      .then((d: { csrfToken?: string }) => setCsrfToken(d.csrfToken ?? ""))
      .catch(() => {});
  }, []);

  const fetchSessions = useCallback(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data) => { setSessions(data.sessions ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    fetchSessions();
  }, [authLoading, fetchSessions]);

  const fetchSlots = useCallback(() => {
    if (authLoading) return;
    const dateStr = format(weekStart, "yyyy-MM-dd");
    fetch(`/api/user/availability?weekStartDate=${dateStr}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.weeklyAvailability?.slots ?? []))
      .catch(() => setSlots([]));
  }, [authLoading, weekStart]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  const weekDiff = differenceInCalendarWeeks(weekStart, currentWeekMon, { weekStartsOn: 1 });
  const isCurrentWeek = weekDiff === 0;
  const isFutureWeek = weekDiff > 0;

  const planWeekStart = sessions.length > 0
    ? startOfWeek(
        parseISO(sessions.reduce((min, s) => s.scheduledDate < min ? s.scheduledDate : min, sessions[0].scheduledDate)),
        { weekStartsOn: 1 }
      )
    : weekStart;
  const weekNumber = differenceInCalendarWeeks(weekStart, planWeekStart, { weekStartsOn: 1 }) + 1;

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getSessionsForDay = (date: Date) =>
    sessions.filter((s) => isSameDay(parseISO(s.scheduledDate), date));

  const getSlotsForDay = (date: Date) => {
    const dow = date.getDay();
    return slots.filter((s) => s.dayOfWeek === dow).sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const weekSessions = weekDays.flatMap((d) => getSessionsForDay(d));
  const weekTotalMins = weekSessions.reduce((a, s) => a + s.durationMins, 0);
  const weekCompleted = weekSessions.filter((s) => s.status === "COMPLETED").length;

  // Show setup form if: future week AND no availability set AND no sessions
  const showSetup = isFutureWeek && slots.length === 0 && weekSessions.length === 0;

  const handleScheduleSuccess = () => {
    fetchSessions();
    fetchSlots();
  };

  if (authLoading || loading) {
    return (
      <MainLayout userName={user?.name}>
        <div className="flex-1 flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout userName={user?.name}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-8">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">Study Schedule</h1>
              {weekNumber >= 1 && (
                <span className="px-2.5 py-0.5 rounded-full text-sm font-semibold bg-blue-100 text-blue-700">
                  Week {weekNumber}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
            </p>
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            <button
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => !isCurrentWeek && setWeekStart(currentWeekMon)}
              disabled={isCurrentWeek}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors min-w-25 text-center",
                isCurrentWeek
                  ? "text-gray-400 bg-gray-100 cursor-default"
                  : "text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer"
              )}
            >
              {relativeWeekLabel(weekDiff)}
            </button>
            <button
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* ── Week summary bar ─────────────────────────────────────────── */}
        {weekSessions.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-800">
                {relativeWeekLabel(weekDiff)} — {fmtMins(weekTotalMins)} total
              </span>
              <span className="text-sm text-gray-500">
                {weekCompleted} / {weekSessions.length} sessions done
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-2 bg-green-500 rounded-full transition-all"
                style={{ width: `${weekSessions.length ? (weekCompleted / weekSessions.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* ── No plan at all ───────────────────────────────────────────── */}
        {sessions.length === 0 && !showSetup ? (
          <div className="py-20 text-center">
            <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-3">No study plan found.</p>
            <Link href="/dashboard" className="text-blue-600 font-medium text-sm hover:underline">
              Generate your study plan →
            </Link>
          </div>
        ) : showSetup ? (
          /* ── Future week with no schedule ───────────────────────────── */
          <WeekScheduleSetup
            weekStart={weekStart}
            csrfToken={csrfToken}
            onSuccess={handleScheduleSuccess}
          />
        ) : (
          /* ── Day rows ────────────────────────────────────────────────── */
          <div className="space-y-2">
            {weekDays.map((day, i) => {
              const daySessions = getSessionsForDay(day);
              const daySlots = getSlotsForDay(day);
              const isToday = isSameDay(day, new Date());
              const dayMins = daySessions.reduce((a, s) => a + s.durationMins, 0);
              const dayDone = daySessions.filter((s) => s.status === "COMPLETED").length;
              const hasContent = daySessions.length > 0 || daySlots.length > 0;

              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-xl border bg-white transition-colors",
                    isToday ? "border-blue-300 shadow-sm shadow-blue-100" : "border-gray-200"
                  )}
                >
                  {/* Day header */}
                  <div className={cn(
                    "flex items-start gap-4 px-4 py-3 rounded-t-xl",
                    isToday ? "bg-blue-600" : hasContent ? "bg-gray-50" : "bg-white"
                  )}>
                    <div className="w-12 shrink-0">
                      <p className={cn("text-xs font-semibold uppercase tracking-wider", isToday ? "text-blue-100" : "text-gray-400")}>
                        {format(day, "EEE")}
                      </p>
                      <p className={cn("text-xl font-bold leading-tight", isToday ? "text-white" : "text-gray-800")}>
                        {format(day, "d")}
                      </p>
                    </div>

                    {daySlots.length > 0 ? (
                      <div className="flex flex-col gap-0.5 pt-0.5 min-w-27.5">
                        {daySlots.map((slot, si) => (
                          <div key={si} className={cn("flex items-center gap-1 text-xs font-medium", isToday ? "text-blue-100" : "text-gray-500")}>
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{slot.startTime} – {slot.endTime}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="pt-1.5">
                        <span className={cn("text-sm", isToday ? "text-blue-200" : "text-gray-300")}>Free</span>
                      </div>
                    )}

                    {daySessions.length > 0 && (
                      <div className="flex items-center gap-3 ml-auto pt-1">
                        <span className={cn("text-sm font-medium", isToday ? "text-blue-100" : "text-gray-600")}>
                          {fmtMins(dayMins)}
                        </span>
                        <span className={cn("text-xs", isToday ? "text-blue-200" : "text-gray-400")}>
                          {dayDone}/{daySessions.length} done
                        </span>
                        {isToday && dayDone === daySessions.length && daySessions.length > 0 && (
                          <span className="text-xs bg-green-400/80 text-white px-2 py-0.5 rounded-full font-medium">
                            ✓ Done
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Sessions */}
                  {daySessions.length > 0 && (
                    <div className="divide-y divide-gray-100">
                      {daySessions.map((s) => {
                        const colors = SUBJECT_COLOR[s.subjectCode] ?? { badge: "bg-gray-100 text-gray-600", dot: "bg-gray-400" };
                        const done = s.status === "COMPLETED";
                        return (
                          <Link key={s.id} href={`/study/${s.id}`}>
                            <div className={cn(
                              "flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors",
                              done && "opacity-50"
                            )}>
                              {done
                                ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                : <Circle className="w-4 h-4 text-gray-300 shrink-0" />
                              }
                              <div className={cn("w-2 h-2 rounded-full shrink-0", colors.dot)} />
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-sm font-medium text-gray-900 truncate", done && "line-through")}>
                                  {s.subtopicName}
                                </p>
                                <span className={cn("inline-block text-[11px] font-medium px-1.5 py-0.5 rounded-full mt-0.5", colors.badge)}>
                                  {SUBJECT_LABEL[s.subjectCode] ?? s.subjectCode}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-gray-400 shrink-0">
                                <Clock className="w-3 h-3" />
                                <span className="text-xs">{fmtMins(s.durationMins)}</span>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

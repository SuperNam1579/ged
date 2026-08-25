"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { addDays, format, startOfWeek, isSameDay, parseISO, differenceInCalendarWeeks } from "date-fns";
import {
  ChevronLeft, ChevronRight, Clock, CheckCircle2, Circle,
  BookOpen, Plus, X, CalendarDays, Loader2, Target, Sparkles, AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import MainLayout from "@/components/layout/MainLayout";
import Spinner from "@/components/ui/Spinner";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { useAuth } from "@/lib/hooks/useAuth";
import { cn } from "@/lib/utils/cn";
import { withReturnTo } from "@/lib/utils/return-to";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface SessionEntry {
  id: string;
  subtopicId: string;
  subtopicName: string;
  subjectCode: string;
  subjectName: string;
  topicName: string;
  scheduledDate: string;
  durationMins: number;
  status: string;
  difficultyLevel: number;
  learningUrl: string | null;
  order: number;
}

interface PlacedSession {
  session: SessionEntry;
  startMin: number; // minutes from midnight
  endMin: number;
}

const GRID_DEFAULT_START_HOUR = 8;
const GRID_DEFAULT_END_HOUR = 21;
const GRID_ROW_PX = 56;
const CARD_H = 50;
const CARD_GAP = 6;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatClock(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Packs a day's sessions back-to-back into its availability slots (sessions
// don't carry their own clock time — only a date — so this reconstructs the
// timeline the GA implicitly assumed when it checked time feasibility).
function layoutDaySessions(daySessions: SessionEntry[], daySlots: AvailabilitySlot[]): PlacedSession[] {
  const slots = [...daySlots]
    .map((s) => ({ start: timeToMinutes(s.startTime), end: timeToMinutes(s.endTime) }))
    .sort((a, b) => a.start - b.start);

  const ordered = [...daySessions].sort((a, b) => a.order - b.order);
  const placed: PlacedSession[] = [];
  let slotIdx = 0;
  let cursor = slots[0]?.start ?? GRID_DEFAULT_START_HOUR * 60;

  for (const session of ordered) {
    while (slotIdx < slots.length - 1 && cursor >= slots[slotIdx].end) {
      slotIdx++;
      cursor = Math.max(cursor, slots[slotIdx].start);
    }
    if (slotIdx < slots.length && cursor < slots[slotIdx].start) {
      cursor = slots[slotIdx].start;
    }
    placed.push({ session, startMin: cursor, endMin: cursor + session.durationMins });
    cursor += session.durationMins;
  }
  return placed;
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

const SUBJECT_COLOR: Record<string, { badge: string; dot: string; border: string }> = {
  MATH: { badge: "bg-primary-light text-primary",    dot: "bg-primary",     border: "border-l-primary" },
  RLA:  { badge: "bg-green-100 text-green-700",   dot: "bg-green-500",  border: "border-l-green-500" },
  SS:   { badge: "bg-amber-100 text-amber-700",   dot: "bg-amber-500",  border: "border-l-amber-500" },
  SCI:  { badge: "bg-purple-100 text-purple-700", dot: "bg-purple-500", border: "border-l-purple-500" },
};
const DEFAULT_SUBJECT_COLOR = { badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground", border: "border-l-border" };
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

function slotsToSchedule(slots: AvailabilitySlot[]): Schedule {
  const sched: Schedule = Object.fromEntries(
    [0, 1, 2, 3, 4, 5, 6].map((d) => [d, { enabled: false, slots: [] as TimeSlot[] }])
  ) as Schedule;
  for (const s of slots) {
    sched[s.dayOfWeek].enabled = true;
    sched[s.dayOfWeek].slots.push({ id: crypto.randomUUID(), start: s.startTime, end: s.endTime });
  }
  return sched;
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
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [hasTemplate, setHasTemplate] = useState(true);
  const [source, setSource] = useState<"template" | "confirmed">("template");
  const [pastByDow, setPastByDow] = useState<Record<number, boolean>>({});
  const [schedule, setSchedule] = useState<Schedule>(EMPTY_SCHEDULE);
  const [applyToFuture, setApplyToFuture] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  // Pre-fill this week's availability: the confirmed snapshot if it exists,
  // otherwise a draft projected from the recurring template. Nothing is saved
  // until the user hits Generate.
  useEffect(() => {
    const weekStartDate = format(weekStart, "yyyy-MM-dd");
    fetch(`/api/user/availability/week?weekStartDate=${weekStartDate}`)
      .then((r) => r.json())
      .then((d: {
        source?: "template" | "confirmed";
        hasTemplate?: boolean;
        slots?: AvailabilitySlot[];
        days?: { dayOfWeek: number; isPast: boolean }[];
      }) => {
        setSource(d.source ?? "template");
        setHasTemplate(d.hasTemplate ?? d.source === "confirmed");
        setPastByDow(Object.fromEntries((d.days ?? []).map((x) => [x.dayOfWeek, x.isPast])));
        setSchedule(slotsToSchedule(d.slots ?? []));
        setLoadingDraft(false);
      })
      .catch(() => setLoadingDraft(false));
  }, [weekStart]);

  const toggleDay = (dow: number) =>
    setSchedule((prev) => ({
      ...prev,
      [dow]: { ...prev[dow], enabled: !prev[dow].enabled, slots: prev[dow].enabled ? [] : [{ id: crypto.randomUUID(), start: "18:00", end: "20:00" }] },
    }));

  const addSlot = (dow: number) =>
    setSchedule((prev) => ({
      ...prev,
      [dow]: { ...prev[dow], slots: [...prev[dow].slots, { id: crypto.randomUUID(), start: "18:00", end: "20:00" }] },
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
  // Only the days that haven't passed can actually be studied this week.
  const futureSlots = validSlots.filter((s) => !pastByDow[s.dayOfWeek]);
  const canSubmit = futureSlots.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const weekStartDate = format(weekStart, "yyyy-MM-dd");
      const res = await fetch("/api/user/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ weekStartDate, slots: validSlots, applyToFutureWeeks: applyToFuture }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? "Failed to save schedule.");
      } else if (d.message) {
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

  if (loadingDraft) {
    return (
      <div className="rounded-xl border border-border p-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No recurring availability yet → send the user to set it up once.
  if (!hasTemplate && source === "template") {
    return (
      <div className="rounded-xl border-2 border-dashed border-border p-8 text-center">
        <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">Set up your recurring availability first</p>
        <p className="text-xs text-muted-foreground mb-4">Tell us when you&apos;re usually free — we&apos;ll reuse it every week so you don&apos;t have to re-enter it.</p>
        <Link
          href="/availability"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Set up availability
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary bg-primary-light/30">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Confirm your availability · {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {source === "confirmed"
              ? "You've confirmed this week already. Adjust anything below, then regenerate to update the plan."
              : "We've pre-filled this from your usual availability — adjust anything that's different this week, then confirm to generate your plan."}
          </p>
        </div>
        {/* Unmistakable confirmed-vs-draft indicator, per user feedback that the
            two looked identical: a confirmed week and an unconfirmed draft
            rendered through the same form and were easy to confuse. */}
        <span
          className={cn(
            "shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap",
            source === "confirmed"
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          )}
        >
          {source === "confirmed"
            ? <CheckCircle2 className="w-3.5 h-3.5" />
            : <AlertCircle className="w-3.5 h-3.5" />
          }
          {source === "confirmed" ? "Confirmed" : "Not confirmed yet"}
        </span>
      </div>

      {/* Day rows */}
      <div className="p-4 space-y-2.5">
        {WEEK_DAYS.map(({ label, dow }) => {
          const day = schedule[dow];
          const isPast = !!pastByDow[dow];
          const active = day.enabled && !isPast;
          return (
            <div
              key={dow}
              className={cn(
                "rounded-lg border overflow-hidden transition-colors",
                active ? "border-primary/40 bg-card border-l-4" : "border-border bg-card/60",
                isPast && "opacity-50"
              )}
            >
              {/* Day toggle */}
              <div className="flex items-center gap-3 px-4 py-2.5">
                <button
                  onClick={() => !isPast && toggleDay(dow)}
                  role="switch"
                  aria-checked={day.enabled}
                  aria-label={`Toggle ${label}`}
                  disabled={isPast}
                  className={cn(
                    "w-11 h-6 p-0 rounded-full transition-colors relative shrink-0",
                    day.enabled && !isPast ? "bg-primary" : "bg-muted",
                    isPast && "cursor-not-allowed"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform",
                    day.enabled ? "translate-x-5" : "translate-x-0"
                  )} />
                </button>
                <span className={cn("text-sm font-medium w-10 shrink-0", active ? "text-foreground" : "text-muted-foreground")}>
                  {label}
                </span>
                <span className="ml-auto text-xs text-muted-foreground italic">
                  {isPast
                    ? "Already passed"
                    : day.enabled
                      ? (day.slots.length === 0 ? "No time slots — add one" : null)
                      : "Not available"}
                </span>
              </div>

              {/* Slots */}
              {day.enabled && !isPast && (
                <div className="border-t border-border px-4 py-2 space-y-2 bg-background/50">
                  {day.slots.map((slot) => {
                    const invalid = slot.start >= slot.end;
                    return (
                      <div key={slot.id} className="flex items-center gap-2">
                        <select
                          value={slot.start}
                          onChange={(e) => updateSlot(dow, slot.id, "start", e.target.value)}
                          className="flex-1 text-sm border border-border rounded-lg px-2 py-1.5 bg-card"
                        >
                          {TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <span className="text-muted-foreground text-xs shrink-0">to</span>
                        <select
                          value={slot.end}
                          onChange={(e) => updateSlot(dow, slot.id, "end", e.target.value)}
                          className={cn(
                            "flex-1 text-sm border rounded-lg px-2 py-1.5 bg-card",
                            invalid ? "border-red-300" : "border-border"
                          )}
                        >
                          {TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <button
                          onClick={() => removeSlot(dow, slot.id)}
                          className="p-1 hover:bg-red-50 rounded-md transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5 text-muted-foreground hover:text-red-400" />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => addSlot(dow)}
                    className="flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary py-0.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add time slot
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Apply to future weeks */}
        <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
          <button
            type="button"
            role="checkbox"
            aria-checked={applyToFuture}
            onClick={() => setApplyToFuture((v) => !v)}
            className="w-4.5 h-4.5 rounded border border-border flex items-center justify-center shrink-0 transition-colors"
            style={applyToFuture ? { background: "var(--primary)", borderColor: "var(--primary)" } : {}}
          >
            {applyToFuture && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
          <span className="text-sm text-foreground">Apply these changes to future weeks</span>
        </label>

        {error && <p className="text-red-600 text-sm px-1">{error}</p>}
        {infoMsg && (
          <div className="bg-primary-light border border-primary rounded-lg px-4 py-3 text-sm text-primary">
            {infoMsg} — Go to <strong>Settings → Regenerate My Study Plan</strong> to start a fresh plan.
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className={cn(
            "w-full py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2",
            canSubmit && !submitting
              ? "bg-primary text-white hover:bg-primary-dark"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating plan…</>
          ) : source === "confirmed" ? (
            "Regenerate Study Plan"
          ) : (
            "Confirm & Generate Plan"
          )}
        </button>
        <p className="text-xs text-muted-foreground text-center">
          {source === "confirmed"
            ? "This regenerates the plan using the availability above."
            : "This confirms the availability above for this week and generates its plan."}
        </p>
      </div>
    </div>
  );
}

// ─── StatCard ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  iconClass,
}: {
  icon: typeof Clock;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  iconClass: string;
}) {
  return (
    <motion.div variants={fadeUp} className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={cn("w-3.5 h-3.5", iconClass)} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="text-xl font-bold text-foreground leading-tight">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </motion.div>
  );
}

// ─── WeekCalendarGrid ────────────────────────────────────────────────────────

function WeekCalendarGrid({
  weekDays,
  getSessionsForDay,
  getSlotsForDay,
  selectedDay,
  onSelectDay,
  onSelectSession,
}: {
  weekDays: Date[];
  getSessionsForDay: (d: Date) => SessionEntry[];
  getSlotsForDay: (d: Date) => AvailabilitySlot[];
  selectedDay: Date | null;
  onSelectDay: (d: Date) => void;
  onSelectSession: (placed: PlacedSession) => void;
}) {
  const fmtClock = formatClock;

  const dayLayouts = weekDays.map((day) => layoutDaySessions(getSessionsForDay(day), getSlotsForDay(day)));
  const daySlotRanges = weekDays.map((day) =>
    getSlotsForDay(day).map((s) => ({ start: timeToMinutes(s.startTime), end: timeToMinutes(s.endTime) }))
  );

  // Fit the visible hour range tightly around actual content (sessions +
  // availability) with an hour of padding, rather than always spanning a fixed
  // 08:00–21:00 — otherwise an evening-only schedule leaves the grid mostly
  // empty and the blocks crammed at the bottom.
  const contentMins = [
    ...dayLayouts.flat().flatMap((p) => [p.startMin, p.endMin]),
    ...daySlotRanges.flat().flatMap((s) => [s.start, s.end]),
  ];
  let rangeStartHour = GRID_DEFAULT_START_HOUR;
  let rangeEndHour = GRID_DEFAULT_END_HOUR;
  if (contentMins.length) {
    rangeStartHour = Math.max(0, Math.floor(Math.min(...contentMins) / 60) - 1);
    rangeEndHour = Math.min(24, Math.ceil(Math.max(...contentMins) / 60) + 1);
    if (rangeEndHour - rangeStartHour < 6) rangeEndHour = Math.min(24, rangeStartHour + 6);
  }
  const hours = Array.from({ length: rangeEndHour - rangeStartHour }, (_, i) => rangeStartHour + i);
  const minToTop = (min: number) => ((min - rangeStartHour * 60) / 60) * GRID_ROW_PX;

  // Sessions are laid out as uniform, evenly-stacked cards (not time-proportional
  // bars) so odd durations don't produce ugly blocks that start/end mid-cell and
  // cross the hour lines. Each day's stack begins at its first session's time;
  // the real clock time still shows inside every card.
  const dayBaseTop = dayLayouts.map((placed) => (placed.length ? minToTop(placed[0].startMin) : 0));
  const stackBottoms = dayLayouts.map((placed, i) =>
    placed.length ? dayBaseTop[i] + placed.length * CARD_H + (placed.length - 1) * CARD_GAP : 0
  );
  const gridHeight = Math.max(hours.length * GRID_ROW_PX, ...stackBottoms) + 8;

  return (
    <div className="hidden sm:block rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-175">
          {/* Day headers */}
          <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border">
            <div />
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              return (
                <button
                  key={i}
                  onClick={() => onSelectDay(day)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-2.5 border-l border-border transition-colors hover:bg-background",
                    isSelected && "bg-primary-light"
                  )}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {format(day, "EEE")}
                  </span>
                  <span
                    className={cn(
                      "w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold",
                      isToday ? "bg-primary text-white" : "text-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Hour grid */}
          <div className="grid grid-cols-[56px_repeat(7,1fr)]" style={{ height: gridHeight }}>
            {/* Hour labels — sit just below each gridline, right-aligned, so the
                number never overlaps the line it marks. */}
            <div className="relative">
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="absolute right-2 text-[11px] font-medium text-muted-foreground/80"
                  style={{ top: i * GRID_ROW_PX + 4 }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, new Date());
              const placed = dayLayouts[i];
              const slotRanges = daySlotRanges[i];
              return (
                <div
                  key={i}
                  onClick={() => onSelectDay(day)}
                  className={cn(
                    "relative border-l border-border cursor-pointer group",
                    isToday && "bg-primary-light/10"
                  )}
                >
                  {/* Availability shading — shows the free windows the plan was
                      built around, so an empty grid reads as "free time" not "bug". */}
                  {slotRanges.map((s, si) => (
                    <div
                      key={`slot-${si}`}
                      className="absolute left-0 right-0 bg-primary/4 group-hover:bg-primary/8 transition-colors"
                      style={{ top: minToTop(s.start), height: ((s.end - s.start) / 60) * GRID_ROW_PX }}
                    />
                  ))}

                  {/* Hour gridlines */}
                  {hours.map((h, hi) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-border/50"
                      style={{ top: hi * GRID_ROW_PX }}
                    />
                  ))}

                  {/* Session cards — uniform height, evenly stacked from the
                      day's first slot start. */}
                  {placed.map((p, j) => {
                    const { session, startMin, endMin } = p;
                    const colors = SUBJECT_COLOR[session.subjectCode] ?? DEFAULT_SUBJECT_COLOR;
                    const top = dayBaseTop[i] + j * (CARD_H + CARD_GAP);
                    const done = session.status === "COMPLETED";
                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onSelectSession(p); }}
                        className={cn(
                          "absolute left-1.5 right-1.5 flex flex-col justify-center gap-0.5 rounded-lg px-2 py-1.5 overflow-hidden border-l-[3px] shadow-sm hover:shadow-md hover:-translate-y-px transition-all text-left",
                          colors.badge,
                          colors.border,
                          done && "opacity-50"
                        )}
                        style={{ top, height: CARD_H }}
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", colors.dot)} />
                          <span className={cn("text-[11px] font-semibold truncate min-w-0", done && "line-through")}>
                            {session.subtopicName}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium opacity-70 pl-2.5">
                          {fmtClock(startMin)} – {fmtClock(endMin)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MobileDayCalendar ───────────────────────────────────────────────────────
// Single-day view for narrow screens — a 7-column hour grid needs horizontal
// scrolling to be readable, which is a poor mobile experience. This swaps to
// one day at a time with a swipeable day strip instead.

const SWIPE_THRESHOLD_PX = 40;

function MobileDayCalendar({
  weekDays,
  getSessionsForDay,
  getSlotsForDay,
  onSelectSession,
}: {
  weekDays: Date[];
  getSessionsForDay: (d: Date) => SessionEntry[];
  getSlotsForDay: (d: Date) => AvailabilitySlot[];
  onSelectSession: (placed: PlacedSession) => void;
}) {
  const todayIdx = weekDays.findIndex((d) => isSameDay(d, new Date()));
  const [dayIndex, setDayIndex] = useState(todayIdx >= 0 ? todayIdx : 0);
  const touchStartX = useRef<number | null>(null);

  // Re-anchor to today (or the start of the week) whenever the parent moves
  // to a different week, so the index doesn't point at the wrong day. Adjusted
  // during render (React's recommended pattern) rather than an effect, since
  // it's just resetting derived state in response to a prop change.
  const weekKey = weekDays[0]?.getTime();
  const [lastWeekKey, setLastWeekKey] = useState(weekKey);
  if (weekKey !== lastWeekKey) {
    setLastWeekKey(weekKey);
    setDayIndex(todayIdx >= 0 ? todayIdx : 0);
  }

  const day = weekDays[dayIndex];
  const placed = layoutDaySessions(getSessionsForDay(day), getSlotsForDay(day));
  const slotRanges = getSlotsForDay(day).map((s) => ({
    start: timeToMinutes(s.startTime),
    end: timeToMinutes(s.endTime),
  }));

  const contentMins = [
    ...placed.flatMap((p) => [p.startMin, p.endMin]),
    ...slotRanges.flatMap((s) => [s.start, s.end]),
  ];
  let rangeStartHour = GRID_DEFAULT_START_HOUR;
  let rangeEndHour = GRID_DEFAULT_END_HOUR;
  if (contentMins.length) {
    rangeStartHour = Math.max(0, Math.floor(Math.min(...contentMins) / 60) - 1);
    rangeEndHour = Math.min(24, Math.ceil(Math.max(...contentMins) / 60) + 1);
    if (rangeEndHour - rangeStartHour < 6) rangeEndHour = Math.min(24, rangeStartHour + 6);
  }
  const hours = Array.from({ length: rangeEndHour - rangeStartHour }, (_, i) => rangeStartHour + i);
  const minToTop = (min: number) => ((min - rangeStartHour * 60) / 60) * GRID_ROW_PX;
  const baseTop = placed.length ? minToTop(placed[0].startMin) : 0;
  const stackBottom = placed.length ? baseTop + placed.length * CARD_H + (placed.length - 1) * CARD_GAP : 0;
  const gridHeight = Math.max(hours.length * GRID_ROW_PX, stackBottom) + 8;

  const goTo = (next: number) => setDayIndex(Math.min(6, Math.max(0, next)));

  return (
    <div className="sm:hidden rounded-xl border border-border bg-card overflow-hidden">
      {/* Day strip */}
      <div className="flex items-center border-b border-border px-1">
        <button
          onClick={() => goTo(dayIndex - 1)}
          disabled={dayIndex === 0}
          className="p-2 text-muted-foreground disabled:opacity-30 shrink-0"
          aria-label="Previous day"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 grid grid-cols-7">
          {weekDays.map((d, i) => {
            const isToday = isSameDay(d, new Date());
            const isSelected = i === dayIndex;
            return (
              <button
                key={i}
                onClick={() => setDayIndex(i)}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 rounded-lg transition-colors",
                  isSelected && "bg-primary-light"
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {format(d, "EEEEE")}
                </span>
                <span
                  className={cn(
                    "w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold",
                    isToday ? "bg-primary text-white" : "text-foreground"
                  )}
                >
                  {format(d, "d")}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => goTo(dayIndex + 1)}
          disabled={dayIndex === 6}
          className="p-2 text-muted-foreground disabled:opacity-30 shrink-0"
          aria-label="Next day"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Hour grid for the selected day — swipeable */}
      <div
        className="grid grid-cols-[44px_1fr] overflow-x-hidden"
        style={{ height: gridHeight }}
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const delta = e.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(delta) > SWIPE_THRESHOLD_PX) goTo(dayIndex + (delta < 0 ? 1 : -1));
          touchStartX.current = null;
        }}
      >
        <div className="relative">
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute right-2 text-[11px] font-medium text-muted-foreground/80"
              style={{ top: i * GRID_ROW_PX + 4 }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        <div className="relative border-l border-border">
          {slotRanges.map((s, si) => (
            <div
              key={`slot-${si}`}
              className="absolute left-0 right-0 bg-primary/4"
              style={{ top: minToTop(s.start), height: ((s.end - s.start) / 60) * GRID_ROW_PX }}
            />
          ))}
          {hours.map((h, hi) => (
            <div key={h} className="absolute left-0 right-0 border-t border-border/50" style={{ top: hi * GRID_ROW_PX }} />
          ))}

          {placed.map((p, j) => {
            const { session, startMin, endMin } = p;
            const colors = SUBJECT_COLOR[session.subjectCode] ?? DEFAULT_SUBJECT_COLOR;
            const top = baseTop + j * (CARD_H + CARD_GAP);
            const done = session.status === "COMPLETED";
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelectSession(p)}
                className={cn(
                  "absolute left-2 right-2 flex flex-col justify-center gap-0.5 rounded-lg px-3 py-1.5 overflow-hidden border-l-[3px] shadow-sm active:shadow-md transition-all text-left",
                  colors.badge,
                  colors.border,
                  done && "opacity-50"
                )}
                style={{ top, height: CARD_H }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", colors.dot)} />
                  <span className={cn("text-[12px] font-semibold truncate min-w-0", done && "line-through")}>
                    {session.subtopicName}
                  </span>
                </div>
                <span className="text-[10px] font-medium opacity-70 pl-3">
                  {formatClock(startMin)} – {formatClock(endMin)}
                </span>
              </button>
            );
          })}

          {placed.length === 0 && slotRanges.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Nothing scheduled
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SessionDetailModal ──────────────────────────────────────────────────────

function SessionDetailModal({
  placed,
  onClose,
}: {
  placed: PlacedSession;
  onClose: () => void;
}) {
  const { session, startMin, endMin } = placed;
  const colors = SUBJECT_COLOR[session.subjectCode] ?? DEFAULT_SUBJECT_COLOR;
  const done = session.status === "COMPLETED";
  const fmtClock = (min: number) => {
    const h = Math.floor(min / 60) % 24;
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          className="pointer-events-auto w-full max-w-sm rounded-xl bg-card border border-border shadow-2xl overflow-hidden"
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className={cn("border-l-4 px-5 pt-4 pb-3", colors.border)}>
            <div className="flex items-start justify-between gap-3">
              <span className={cn("inline-block text-[11px] font-medium px-1.5 py-0.5 rounded-full", colors.badge)}>
                {SUBJECT_LABEL[session.subjectCode] ?? session.subjectCode}
              </span>
              <button
                onClick={onClose}
                className="p-1 -m-1 rounded-lg hover:bg-background transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <h2 className={cn("text-lg font-bold text-foreground mt-2", done && "line-through opacity-70")}>
              {session.subtopicName}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{session.topicName}</p>
          </div>

          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 shrink-0" />
              <span>{fmtClock(startMin)} – {fmtClock(endMin)} · {fmtMins(session.durationMins)}</span>
            </div>
            <div className="flex items-center gap-2">
              {done
                ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
              }
              <span className="text-sm text-foreground">{done ? "Completed" : "Not started"}</span>
            </div>

            {/* What the study session includes — funnels the user into our own
                study flow (timed lesson + progress tracking + quiz) rather than
                shipping them straight out to an external resource. */}
            <div className="rounded-lg bg-background border border-border px-3.5 py-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">In this session</p>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <BookOpen className="w-4 h-4 shrink-0 text-primary" />
                <span>{session.learningUrl ? "Guided lesson material" : "Study time (from your notes)"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Clock className="w-4 h-4 shrink-0 text-primary" />
                <span>Timed study with progress tracking</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Target className="w-4 h-4 shrink-0 text-primary" />
                <span>Quiz to check your understanding</span>
              </div>
            </div>
          </div>

          <div className="px-5 pb-5">
            <Link
              href={withReturnTo(`/study/${session.id}`, "/schedule")}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors"
            >
              {done ? "Review Session" : "Start Study Session"}
            </Link>
          </div>
        </motion.div>
      </div>
    </>
  );
}

// ─── DayDetailPanel ──────────────────────────────────────────────────────────

function DayDetailPanel({
  day,
  sessions,
  slots,
  onClose,
}: {
  day: Date;
  sessions: SessionEntry[];
  slots: AvailabilitySlot[];
  onClose: () => void;
}) {
  const placed = layoutDaySessions(sessions, slots).sort((a, b) => a.startMin - b.startMin);
  const totalMins = sessions.reduce((a, s) => a + s.durationMins, 0);
  const nextSession = sessions.find((s) => s.status !== "COMPLETED") ?? sessions[0];
  const fmtClock = (min: number) => {
    const h = Math.floor(min / 60) % 24;
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      />
      <motion.div
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-105 bg-card border-l border-border shadow-2xl flex flex-col"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-bold text-foreground">{format(day, "EEEE, MMM d, yyyy")}</h2>
            {sessions.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {sessions.length} session{sessions.length !== 1 ? "s" : ""} · {fmtMins(totalMins)} total
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-background transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {placed.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">
              No sessions scheduled for this day.
            </p>
          )}
          {placed.map(({ session, startMin, endMin }) => {
            const colors = SUBJECT_COLOR[session.subjectCode] ?? DEFAULT_SUBJECT_COLOR;
            const done = session.status === "COMPLETED";
            return (
              <Link
                key={session.id}
                href={withReturnTo(`/study/${session.id}`, "/schedule")}
                className={cn(
                  "block rounded-lg border border-border border-l-4 pl-3 pr-4 py-3 hover:bg-background transition-colors",
                  colors.border,
                  done && "opacity-60"
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {fmtClock(startMin)} – {fmtClock(endMin)}
                  </span>
                  <span className="text-xs text-muted-foreground">{fmtMins(session.durationMins)}</span>
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  {done
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    : <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  }
                  <span className={cn("inline-block text-[11px] font-medium px-1.5 py-0.5 rounded-full", colors.badge)}>
                    {SUBJECT_LABEL[session.subjectCode] ?? session.subjectCode}
                  </span>
                </div>
                <p className={cn("text-sm font-semibold text-foreground mb-1", done && "line-through")}>
                  {session.subtopicName}
                </p>
                <p className="text-xs text-muted-foreground">{session.topicName}</p>
              </Link>
            );
          })}
        </div>

        {nextSession && (
          <div className="p-5 border-t border-border shrink-0">
            <Link
              href={withReturnTo(`/study/${nextSession.id}`, "/schedule")}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors"
            >
              Start Study Session
            </Link>
          </div>
        )}
      </motion.div>
    </>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [csrfToken, setCsrfToken] = useState("");
  const [fitnessScore, setFitnessScore] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedSession, setSelectedSession] = useState<PlacedSession | null>(null);

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
      .then((data) => {
        setSessions(data.sessions ?? []);
        setFitnessScore(typeof data.plan?.fitnessScore === "number" ? data.plan.fitnessScore : null);
        setLoading(false);
      })
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

  // A day selected in a previous week view shouldn't linger once the user
  // navigates away from that week.
  const [direction, setDirection] = useState(1);
  const goToWeek = (next: Date) => {
    setDirection(next > weekStart ? 1 : -1);
    setSelectedDay(null);
    setWeekStart(next);
  };

  const weekDiff = differenceInCalendarWeeks(weekStart, currentWeekMon, { weekStartsOn: 1 });
  const isCurrentWeek = weekDiff === 0;

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

  // Focus areas: subjects getting the most study time this week, ranked —
  // the GA already weights weak subtopics heavier, so time share is a
  // reasonable proxy for "what's being prioritized" without new backend data.
  const minsBySubject = new Map<string, number>();
  for (const s of weekSessions) {
    minsBySubject.set(s.subjectCode, (minsBySubject.get(s.subjectCode) ?? 0) + s.durationMins);
  }
  const focusAreas = Array.from(minsBySubject.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([code], i) => ({ code, priority: i === 0 ? "High" : "Medium" }));

  // Show the review/generate panel for the current or a future week that has no
  // plan yet. (Past weeks and weeks that already have sessions don't show it.)
  const showSetup = weekDiff >= 0 && weekSessions.length === 0;

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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-3 sm:gap-0">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">Study Schedule</h1>
              {weekNumber >= 1 && (
                <span className="px-2.5 py-0.5 rounded-full text-sm font-semibold bg-primary-light text-primary">
                  Week {weekNumber}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => goToWeek(addDays(weekStart, -7))}
              className="p-2 rounded-lg border border-border hover:bg-background transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => !isCurrentWeek && goToWeek(currentWeekMon)}
              disabled={isCurrentWeek}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors min-w-25 text-center",
                isCurrentWeek
                  ? "text-muted-foreground bg-muted cursor-default"
                  : "text-primary bg-primary-light hover:bg-primary-light cursor-pointer"
              )}
            >
              {relativeWeekLabel(weekDiff)}
            </button>
            <button
              onClick={() => goToWeek(addDays(weekStart, 7))}
              className="p-2 rounded-lg border border-border hover:bg-background transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* ── Stat cards ────────────────────────────────────────────────── */}
        {weekSessions.length > 0 && (
          <motion.div
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
            initial="hidden"
            animate="visible"
            transition={{ staggerChildren: 0.06 }}
          >
            <StatCard
              icon={CalendarDays}
              label="Sessions"
              value={<><AnimatedNumber value={weekCompleted} /> / {weekSessions.length}</>}
              sub={relativeWeekLabel(weekDiff)}
              iconClass="text-primary"
            />
            <StatCard
              icon={Clock}
              label="Study Time"
              value={fmtMins(weekTotalMins)}
              sub="Planned"
              iconClass="text-amber-500"
            />
            <StatCard
              icon={Target}
              label="Focus Areas"
              value={focusAreas.length
                ? focusAreas.map((f) => SUBJECT_LABEL[f.code] ?? f.code).join(", ")
                : "—"}
              sub={focusAreas.length
                ? focusAreas.map((f) => `${SUBJECT_LABEL[f.code] ?? f.code}: ${f.priority}`).join(" · ")
                : undefined}
              iconClass="text-red-500"
            />
            <StatCard
              icon={Sparkles}
              label="AI Fitness Score"
              value={fitnessScore !== null ? <AnimatedNumber value={Math.round(fitnessScore * 100)} format={(n) => `${n}%`} /> : "—"}
              sub={fitnessScore !== null ? "Great progress!" : undefined}
              iconClass="text-purple-500"
            />
          </motion.div>
        )}

        {/* ── No plan at all ───────────────────────────────────────────── */}
        {sessions.length === 0 && !showSetup ? (
          <div className="py-20 text-center">
            <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-3">No study plan found.</p>
            <Link href="/dashboard" className="text-primary font-medium text-sm hover:underline">
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
          /* ── Week calendar grid ───────────────────────────────────────── */
          <AnimatePresence mode="wait">
            <motion.div
              key={weekStart.getTime()}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
            <MobileDayCalendar
              weekDays={weekDays}
              getSessionsForDay={getSessionsForDay}
              getSlotsForDay={getSlotsForDay}
              onSelectSession={setSelectedSession}
            />
            <WeekCalendarGrid
              weekDays={weekDays}
              getSessionsForDay={getSessionsForDay}
              getSlotsForDay={getSlotsForDay}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              onSelectSession={setSelectedSession}
            />
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {selectedSession ? (
          <SessionDetailModal
            key="session-modal"
            placed={selectedSession}
            onClose={() => setSelectedSession(null)}
          />
        ) : selectedDay && (
          <DayDetailPanel
            key="day-panel"
            day={selectedDay}
            sessions={getSessionsForDay(selectedDay)}
            slots={getSlotsForDay(selectedDay)}
            onClose={() => setSelectedDay(null)}
          />
        )}
      </AnimatePresence>
    </MainLayout>
  );
}

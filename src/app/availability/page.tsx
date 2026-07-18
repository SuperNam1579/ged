"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Plus, X, Clock, Moon, Sun, CalendarRange, Eraser } from "lucide-react";
import { motion } from "motion/react";
import MainLayout from "@/components/layout/MainLayout";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import Toast from "@/components/ui/Toast";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { useAuth } from "@/lib/hooks/useAuth";
import { cn } from "@/lib/utils/cn";

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEK_DAYS = [
  { label: "Monday", dow: 1 }, { label: "Tuesday", dow: 2 }, { label: "Wednesday", dow: 3 },
  { label: "Thursday", dow: 4 }, { label: "Friday", dow: 5 }, { label: "Saturday", dow: 6 },
  { label: "Sunday", dow: 0 },
];
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const value = `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`;
  return { value, label: value };
});

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeSlot = { id: string; start: string; end: string };
type Schedule = Record<number, { enabled: boolean; slots: TimeSlot[] }>;
type TemplateSlot = { dayOfWeek: number; startTime: string; endTime: string };

const EMPTY_SCHEDULE: Schedule = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6].map((d) => [d, { enabled: false, slots: [] }])
) as Schedule;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slotMins(s: TimeSlot): number {
  const [sh, sm] = s.start.split(":").map(Number);
  const [eh, em] = s.end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

function scheduleToSlots(schedule: Schedule): TemplateSlot[] {
  const out: TemplateSlot[] = [];
  for (const [dow, day] of Object.entries(schedule)) {
    if (!day.enabled) continue;
    for (const s of day.slots) {
      if (s.start < s.end) out.push({ dayOfWeek: Number(dow), startTime: s.start, endTime: s.end });
    }
  }
  return out;
}

function slotsToSchedule(slots: TemplateSlot[]): Schedule {
  const sched: Schedule = Object.fromEntries(
    [0, 1, 2, 3, 4, 5, 6].map((d) => [d, { enabled: false, slots: [] as TimeSlot[] }])
  ) as Schedule;
  for (const s of slots) {
    sched[s.dayOfWeek].enabled = true;
    sched[s.dayOfWeek].slots.push({ id: crypto.randomUUID(), start: s.startTime, end: s.endTime });
  }
  return sched;
}

// ─── Presets ────────────────────────────────────────────────────────────────

function buildPreset(dows: number[], start: string, end: string): Schedule {
  const sched: Schedule = Object.fromEntries(
    [0, 1, 2, 3, 4, 5, 6].map((d) => [d, { enabled: false, slots: [] as TimeSlot[] }])
  ) as Schedule;
  for (const dow of dows) {
    sched[dow] = { enabled: true, slots: [{ id: crypto.randomUUID(), start, end }] };
  }
  return sched;
}

const PRESETS: { label: string; icon: typeof Moon; build: () => Schedule }[] = [
  { label: "Weekday evenings", icon: Moon, build: () => buildPreset([1, 2, 3, 4, 5], "18:00", "20:00") },
  { label: "Weekends", icon: Sun, build: () => buildPreset([6, 0], "09:00", "12:00") },
  { label: "Every day", icon: CalendarRange, build: () => buildPreset([0, 1, 2, 3, 4, 5, 6], "09:00", "11:00") },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AvailabilityPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasTemplate, setHasTemplate] = useState(false);
  const [schedule, setSchedule] = useState<Schedule>(EMPTY_SCHEDULE);
  const [csrfToken, setCsrfToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/csrf").then((r) => r.json()).then((d) => setCsrfToken(d.csrfToken ?? "")).catch(() => {});
  }, []);

  useEffect(() => {
    if (authLoading) return;
    fetch("/api/user/availability/template")
      .then((r) => r.json())
      .then((d: { hasTemplate?: boolean; template?: { slots: TemplateSlot[] } | null }) => {
        setHasTemplate(!!d.hasTemplate);
        if (d.template?.slots?.length) setSchedule(slotsToSchedule(d.template.slots));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [authLoading]);

  // ── Mutations ──
  const toggleDay = (dow: number) =>
    setSchedule((prev) => {
      const enabled = !prev[dow].enabled;
      return {
        ...prev,
        [dow]: {
          enabled,
          slots: enabled && prev[dow].slots.length === 0
            ? [{ id: crypto.randomUUID(), start: "18:00", end: "20:00" }]
            : prev[dow].slots,
        },
      };
    });
  const addSlot = (dow: number) =>
    setSchedule((prev) => ({
      ...prev,
      [dow]: { enabled: true, slots: [...prev[dow].slots, { id: crypto.randomUUID(), start: "18:00", end: "20:00" }] },
    }));
  const removeSlot = (dow: number, id: string) =>
    setSchedule((prev) => {
      const slots = prev[dow].slots.filter((s) => s.id !== id);
      return { ...prev, [dow]: { enabled: slots.length > 0, slots } };
    });
  const updateSlot = (dow: number, id: string, field: "start" | "end", value: string) =>
    setSchedule((prev) => ({
      ...prev,
      [dow]: { ...prev[dow], slots: prev[dow].slots.map((s) => (s.id === id ? { ...s, [field]: value } : s)) },
    }));

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch("/api/user/availability/template", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ slots: scheduleToSlots(schedule) }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "Failed to save.");
      } else {
        setHasTemplate(true);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const totalMins = WEEK_DAYS.reduce(
    (sum, { dow }) => sum + (schedule[dow].enabled ? schedule[dow].slots.reduce((a, s) => a + slotMins(s), 0) : 0),
    0
  );
  const totalHours = Math.round(totalMins / 6) / 10;
  const activeDays = WEEK_DAYS.filter(({ dow }) => schedule[dow].enabled && schedule[dow].slots.some((s) => s.start < s.end)).length;

  if (authLoading || loading) {
    return (
      <MainLayout userName={user?.name}>
        <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
      </MainLayout>
    );
  }

  return (
    <MainLayout userName={user?.name}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {hasTemplate ? "My Availability" : "Set up your recurring availability"}
            </h1>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            {hasTemplate
              ? "This is your usual weekly free time. Each week we'll pre-fill your study plan from it — you only tweak the days that change."
              : "Tell us when you're usually free to study each week. We'll reuse this every week so you don't have to re-enter it, and you can adjust any week before generating its plan."}
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/25 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Quick presets */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-xs font-medium text-muted-foreground mr-0.5">Quick fill:</span>
          {PRESETS.map(({ label, icon: Icon, build }) => (
            <button
              key={label}
              onClick={() => setSchedule(build())}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:border-primary/50 hover:bg-primary-light/40 transition-colors"
            >
              <Icon className="w-3.5 h-3.5 text-primary" />
              {label}
            </button>
          ))}
          {activeDays > 0 && (
            <button
              onClick={() => setSchedule(EMPTY_SCHEDULE)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-red-500 transition-colors"
            >
              <Eraser className="w-3.5 h-3.5" />
              Clear all
            </button>
          )}
        </div>

        {/* Day rows */}
        <motion.div className="space-y-2.5 mb-6" initial="hidden" animate="visible" transition={{ staggerChildren: 0.05 }}>
          {WEEK_DAYS.map(({ label, dow }) => {
            const day = schedule[dow];
            const dayMins = day.enabled ? day.slots.reduce((a, s) => a + slotMins(s), 0) : 0;
            const dayHours = Math.round(dayMins / 6) / 10;
            return (
              <motion.div
                key={dow}
                variants={fadeUp}
                className={cn(
                  "rounded-xl border transition-all overflow-hidden",
                  day.enabled
                    ? "border-primary/40 bg-primary-light/20 shadow-sm shadow-blue-100/50 dark:shadow-none"
                    : "border-border bg-card"
                )}
              >
                {/* Day header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleDay(dow)}
                    role="switch"
                    aria-checked={day.enabled}
                    aria-label={`Toggle ${label}`}
                    className={cn(
                      "w-11 h-6 p-0 rounded-full transition-colors relative shrink-0",
                      day.enabled ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <span className={cn(
                      "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform",
                      day.enabled ? "translate-x-5" : "translate-x-0"
                    )} />
                  </button>
                  <span className={cn("text-sm font-semibold", day.enabled ? "text-foreground" : "text-muted-foreground")}>
                    {label}
                  </span>
                  <div className="ml-auto">
                    {day.enabled ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary-light px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" />
                        {dayHours}h
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not available</span>
                    )}
                  </div>
                </div>

                {/* Slots */}
                {day.enabled && (
                  <div className="border-t border-primary/15 bg-card/40 px-4 py-3 space-y-2">
                    {day.slots.map((slot) => {
                      const invalid = slot.start >= slot.end;
                      const mins = slotMins(slot);
                      const hrs = Math.round(mins / 6) / 10;
                      const selCls = cn(
                        "px-2.5 py-1.5 rounded-lg border bg-card text-sm font-medium focus:outline-none focus:ring-2 cursor-pointer transition-colors",
                        invalid ? "border-red-400 focus:ring-red-300 text-red-600 dark:text-red-400" : "border-border focus:ring-ring hover:border-primary/50"
                      );
                      return (
                        <div key={slot.id} className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <select value={slot.start} onChange={(e) => updateSlot(dow, slot.id, "start", e.target.value)} className={selCls}>
                              {TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <span className="text-muted-foreground text-sm">—</span>
                            <select value={slot.end} onChange={(e) => updateSlot(dow, slot.id, "end", e.target.value)} className={selCls}>
                              {TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            {!invalid && (
                              <span className="text-xs font-medium text-muted-foreground tabular-nums">{hrs}h</span>
                            )}
                            <button
                              onClick={() => removeSlot(dow, slot.id)}
                              aria-label="Remove time slot"
                              className="ml-auto p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          {invalid && <p className="text-xs text-red-500 pl-1">End time must be after start time</p>}
                        </div>
                      );
                    })}
                    <button onClick={() => addSlot(dow)} className="flex items-center gap-1 text-sm text-primary hover:text-primary-dark font-medium transition-colors pt-0.5">
                      <Plus className="w-4 h-4" /> Add time
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
            <div className="w-9 h-9 rounded-lg bg-primary-light flex items-center justify-center shrink-0">
              <Clock className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-tight">{totalHours}h</p>
              <p className="text-xs text-muted-foreground">weekly study time</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
            <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-500/15 flex items-center justify-center shrink-0">
              <CalendarDays className="w-4.5 h-4.5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-tight"><AnimatedNumber value={activeDays} /></p>
              <p className="text-xs text-muted-foreground">day{activeDays !== 1 ? "s" : ""} available</p>
            </div>
          </div>
        </div>

        {/* Save — sticky so it stays reachable while editing a long list */}
        <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/80 backdrop-blur border-t border-border flex items-center justify-end gap-3">
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} loading={saving} disabled={saving || activeDays === 0}>
              {hasTemplate ? "Save changes" : "Save availability"}
            </Button>
          </div>
        </div>
      </div>

      <Toast message="Availability saved" show={saved} />
    </MainLayout>
  );
}

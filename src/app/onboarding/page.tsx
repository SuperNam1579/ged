"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  BookOpen, Calculator, Globe, Atom,
  Clock, Calendar, X, Plus, Check, CheckCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import { cn } from "@/lib/utils/cn";
import { clearExistingSession } from "@/lib/auth-client";

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

// ─── Subject definitions ────────────────────────────────────────────────────
// Colors & topic counts mirror the landing page's Subjects section so the
// two experiences read as one system.

// Order follows standard GED test sequence: RLA → Math → Science → Social Studies
const SUBJECTS = [
  {
    code: "RLA",
    name: "Reasoning Through Language Arts",
    description: "Reading informational & literary texts, writing argument essays, grammar and language usage.",
    topics: "18 topics",
    Icon: BookOpen,
    iconBg: "bg-green-500",
    cardSelected: "border-green-400 bg-green-50 dark:bg-green-500/10",
    checkSelected: "bg-green-500 border-green-500",
    badgeCls: "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/25 text-green-700 dark:text-green-400",
  },
  {
    code: "MATH",
    name: "Mathematical Reasoning",
    description: "Number sense, algebraic reasoning, geometry, data analysis, and graphing functions.",
    topics: "14 topics",
    Icon: Calculator,
    iconBg: "bg-primary",
    cardSelected: "border-primary bg-primary-light",
    checkSelected: "bg-primary border-primary",
    badgeCls: "bg-primary-light border-primary/30 text-primary",
  },
  {
    code: "SCI",
    name: "Science",
    description: "Life science (biology, genetics, ecology), physical science (chemistry, physics), and earth & space science.",
    topics: "15 topics",
    Icon: Atom,
    iconBg: "bg-purple-500",
    cardSelected: "border-purple-400 bg-purple-50 dark:bg-purple-500/10",
    checkSelected: "bg-purple-500 border-purple-500",
    badgeCls: "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/25 text-purple-700 dark:text-purple-400",
  },
  {
    code: "SS",
    name: "Social Studies",
    description: "US civics & government, American history, economics, and world geography.",
    topics: "10 topics",
    Icon: Globe,
    iconBg: "bg-amber-500",
    cardSelected: "border-amber-400 bg-amber-50 dark:bg-amber-500/10",
    checkSelected: "bg-amber-500 border-amber-500",
    badgeCls: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25 text-amber-700 dark:text-amber-400",
  },
];

// ─── Schedule types ─────────────────────────────────────────────────────────

type TimeSlot = { id: string; start: string; end: string };
type DaySchedule = { enabled: boolean; slots: TimeSlot[] };
type Schedule = Record<number, DaySchedule>; // keyed by dayOfWeek (0=Sun..6=Sat)

// 30-min interval options in 24h format: 00:00 … 23:30
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  const value = `${String(h).padStart(2, "0")}:${m}`;
  return { value, label: value };
});

const WEEK_DAYS = [
  { label: "Mon", dow: 1 },
  { label: "Tue", dow: 2 },
  { label: "Wed", dow: 3 },
  { label: "Thu", dow: 4 },
  { label: "Fri", dow: 5 },
  { label: "Sat", dow: 6 },
  { label: "Sun", dow: 0 },
];

const DEFAULT_SCHEDULE: Schedule = {
  1: { enabled: false, slots: [] },
  2: { enabled: false, slots: [] },
  3: { enabled: false, slots: [] },
  4: { enabled: false, slots: [] },
  5: { enabled: false, slots: [] },
  6: { enabled: false, slots: [] },
  0: { enabled: false, slots: [] },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function slotMins(slot: TimeSlot): number {
  const [sh, sm] = slot.start.split(":").map(Number);
  const [eh, em] = slot.end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

function weeklyStats(schedule: Schedule) {
  let totalMins = 0;
  let activeDays = 0;
  for (const day of Object.values(schedule)) {
    if (!day.enabled) continue;
    const validSlots = day.slots.filter((s) => s.start < s.end);
    if (validSlots.length === 0) continue;
    activeDays++;
    for (const s of validSlots) totalMins += slotMins(s);
  }
  return { totalHours: Math.round(totalMins / 6) / 10, activeDays };
}

function fmt12h(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${period}`;
}

function thisMonday(): string {
  const today = new Date();
  const diff = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const mon = new Date(today);
  mon.setDate(today.getDate() - diff);
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
}

// ─── Exam date picker (Month / Day / Year dropdowns) ───────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DATE_SELECT_CLS =
  "w-full px-3 py-2.5 rounded-xl border border-input bg-card text-sm text-foreground " +
  "hover:border-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring " +
  "focus:border-transparent transition-colors appearance-none";

function DateSelectChevron() {
  return (
    <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}

function ExamDatePicker({
  value,
  onChange,
  minDate,
}: {
  value: string;
  onChange: (v: string) => void;
  minDate: string;
}) {
  const parts = value ? value.split("-") : ["", "", ""];
  const [year, setYear] = useState(parts[0]);
  const [month, setMonth] = useState(parts[1] ? String(parseInt(parts[1])) : "");
  const [day, setDay] = useState(parts[2] ? String(parseInt(parts[2])) : "");

  const minYear = parseInt(minDate.split("-")[0]);
  const years = useMemo(() => Array.from({ length: 5 }, (_, i) => minYear + i), [minYear]);

  const daysInMonth = useMemo(() => {
    if (!month || !year) return 31;
    return new Date(parseInt(year), parseInt(month), 0).getDate();
  }, [month, year]);

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const emit = (y: string, m: string, d: string) => {
    if (y && m && d) {
      const mm = m.padStart(2, "0");
      const dd = d.padStart(2, "0");
      onChange(`${y}-${mm}-${dd}`);
    } else {
      onChange("");
    }
  };

  const handleYear = (v: string) => { setYear(v); emit(v, month, day); };
  const handleMonth = (v: string) => {
    setMonth(v);
    const maxDay = v && year ? new Date(parseInt(year), parseInt(v), 0).getDate() : 31;
    const clampedDay = day && parseInt(day) > maxDay ? "" : day;
    if (clampedDay !== day) setDay(clampedDay);
    emit(year, v, clampedDay);
  };
  const handleDay = (v: string) => { setDay(v); emit(year, month, v); };

  const selectStyle = { WebkitAppearance: "none" as const };

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* Month */}
      <div className="relative">
        <select aria-label="Month" value={month} onChange={(e) => handleMonth(e.target.value)} className={DATE_SELECT_CLS} style={selectStyle}>
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>{m}</option>
          ))}
        </select>
        <DateSelectChevron />
      </div>

      {/* Day */}
      <div className="relative">
        <select aria-label="Day" value={day} onChange={(e) => handleDay(e.target.value)} className={DATE_SELECT_CLS} style={selectStyle}>
          <option value="">Day</option>
          {days.map((d) => (
            <option key={d} value={String(d)}>{d}</option>
          ))}
        </select>
        <DateSelectChevron />
      </div>

      {/* Year */}
      <div className="relative">
        <select aria-label="Year" value={year} onChange={(e) => handleYear(e.target.value)} className={DATE_SELECT_CLS} style={selectStyle}>
          <option value="">Year</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        <DateSelectChevron />
      </div>
    </div>
  );
}

// ─── Date-of-birth picker (Month / Day / Year dropdowns, ages 16–100) ──────────

function DobPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parts = value ? value.split("-") : ["", "", ""];
  const [year, setYear] = useState(parts[0]);
  const [month, setMonth] = useState(parts[1] ? String(parseInt(parts[1])) : "");
  const [day, setDay] = useState(parts[2] ? String(parseInt(parts[2])) : "");

  const currentYear = new Date().getFullYear();
  // Oldest 100, youngest 16.
  const years = useMemo(
    () => Array.from({ length: 85 }, (_, i) => currentYear - 16 - i),
    [currentYear]
  );

  const daysInMonth = useMemo(() => {
    if (!month || !year) return 31;
    return new Date(parseInt(year), parseInt(month), 0).getDate();
  }, [month, year]);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const emit = (y: string, m: string, d: string) => {
    if (y && m && d) onChange(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
    else onChange("");
  };
  const handleYear = (v: string) => { setYear(v); emit(v, month, day); };
  const handleMonth = (v: string) => {
    setMonth(v);
    const maxDay = v && year ? new Date(parseInt(year), parseInt(v), 0).getDate() : 31;
    const clamped = day && parseInt(day) > maxDay ? "" : day;
    if (clamped !== day) setDay(clamped);
    emit(year, v, clamped);
  };
  const handleDay = (v: string) => { setDay(v); emit(year, month, v); };
  const selectStyle = { WebkitAppearance: "none" as const };

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="relative">
        <select aria-label="Birth month" value={month} onChange={(e) => handleMonth(e.target.value)} className={DATE_SELECT_CLS} style={selectStyle}>
          <option value="">Month</option>
          {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
        </select>
        <DateSelectChevron />
      </div>
      <div className="relative">
        <select aria-label="Birth day" value={day} onChange={(e) => handleDay(e.target.value)} className={DATE_SELECT_CLS} style={selectStyle}>
          <option value="">Day</option>
          {days.map((d) => <option key={d} value={String(d)}>{d}</option>)}
        </select>
        <DateSelectChevron />
      </div>
      <div className="relative">
        <select aria-label="Birth year" value={year} onChange={(e) => handleYear(e.target.value)} className={DATE_SELECT_CLS} style={selectStyle}>
          <option value="">Year</option>
          {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
        </select>
        <DateSelectChevron />
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [csrfToken, setCsrfToken] = useState("");

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [examDate, setExamDate] = useState("");
  const [schedule, setSchedule] = useState<Schedule>(DEFAULT_SCHEDULE);

  // Google sign-ups skip the credentials form, so they never provided a date
  // of birth. If it's missing we collect it here (with the same 16+ rule).
  const [needsDob, setNeedsDob] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState("");

  useEffect(() => {
    fetch("/api/csrf")
      .then((r) => r.json())
      .then((d: { csrfToken?: string }) => setCsrfToken(d.csrfToken ?? ""))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user?: { dateOfBirth?: string | null } }) => {
        if (d.user && !d.user.dateOfBirth) setNeedsDob(true);
      })
      .catch(() => {});
  }, []);

  // ── Schedule mutations ──────────────────────────────────────────────────

  const toggleDay = (dow: number) => {
    setSchedule((prev) => {
      const day = prev[dow];
      const enabled = !day.enabled;
      const slots =
        enabled && day.slots.length === 0
          ? [{ id: `${dow}-${Date.now()}`, start: "00:00", end: "00:00" }]
          : day.slots;
      return { ...prev, [dow]: { enabled, slots } };
    });
  };

  const addSlot = (dow: number) => {
    setSchedule((prev) => {
      const day = prev[dow];
      const newSlot = { id: `${dow}-${Date.now()}`, start: "00:00", end: "00:00" };
      return {
        ...prev,
        [dow]: { enabled: true, slots: [...day.slots, newSlot] },
      };
    });
  };

  const removeSlot = (dow: number, id: string) => {
    setSchedule((prev) => {
      const slots = prev[dow].slots.filter((s) => s.id !== id);
      return { ...prev, [dow]: { enabled: slots.length > 0, slots } };
    });
  };

  const updateSlot = (dow: number, id: string, field: "start" | "end", value: string) => {
    setSchedule((prev) => ({
      ...prev,
      [dow]: {
        ...prev[dow],
        slots: prev[dow].slots.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
      },
    }));
  };

  // ── Validation ──────────────────────────────────────────────────────────

  const dobValid = () => {
    if (!dateOfBirth) return false;
    const age = (Date.now() - new Date(dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return age >= 16 && age <= 120;
  };

  const canProceed = () => {
    if (step === 1) return selectedSubjects.length > 0;
    if (step === 2) {
      if (needsDob && !dobValid()) return false;
      if (!examDate || examDate < minDate) return false;
      return Object.values(schedule).some((d) => d.enabled && d.slots.length > 0);
    }
    return true;
  };

  // ── Submit ──────────────────────────────────────────────────────────────

  const handleFinish = async () => {
    setError("");
    setLoading(true);
    try {
      // Persist the date of birth first for Google accounts that never gave one.
      if (needsDob) {
        const dobRes = await fetch("/api/user/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({ dateOfBirth }),
        });
        if (dobRes.status === 401 || dobRes.status === 404) {
          await clearExistingSession();
          router.replace("/login?expired=1");
          return;
        }
        if (!dobRes.ok) throw new Error((await dobRes.json()).error ?? "Failed to save date of birth");
      }

      const prefRes = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({
          studyGoal: "PASS",
          targetScore: 145,
          targetExamDate: examDate,
          selectedSubjectCodes: selectedSubjects,
        }),
      });
      // A 401/404 here means the session is stale/orphaned (e.g. the account was
      // deleted while a cookie lingered). Self-heal: clear it and send to login
      // rather than leaving the user stuck on an "Unauthorized" banner.
      if (prefRes.status === 401 || prefRes.status === 404) {
        await clearExistingSession();
        router.replace("/login?expired=1");
        return;
      }
      if (!prefRes.ok) throw new Error((await prefRes.json()).error ?? "Failed to save preferences");

      const slots: { dayOfWeek: number; startTime: string; endTime: string }[] = [];
      for (const [dowStr, day] of Object.entries(schedule)) {
        if (!day.enabled) continue;
        for (const s of day.slots) {
          if (slotMins(s) > 0) slots.push({ dayOfWeek: parseInt(dowStr), startTime: s.start, endTime: s.end });
        }
      }

      const availRes = await fetch("/api/user/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        // The schedule entered here is the user's initial recurring availability,
        // so save it as the template (applyToFutureWeeks) — future weeks pre-fill
        // from it instead of asking the user to re-enter everything.
        body: JSON.stringify({ weekStartDate: thisMonday(), slots, applyToFutureWeeks: true }),
      });
      if (!availRes.ok) throw new Error((await availRes.json()).error ?? "Failed to generate plan");

      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const { totalHours, activeDays } = weeklyStats(schedule);
  const daysUntilExam = examDate
    ? Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000)
    : 0;
  const weeksUntilExam = Math.ceil(daysUntilExam / 7);

  const minDate = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-[9px]">
            <div
              className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0"
              style={{ boxShadow: "0 3px 0 var(--primary-dark)" }}
            >
              <BookOpen className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold text-foreground" style={{ fontFamily: "var(--font-feather)" }}>
              GED Prep
            </span>
          </div>
          {step < 4 && (
            <span className="text-sm text-muted-foreground">
              Step {step} of 3 &middot; {Math.round((step / 3) * 100)}% complete
            </span>
          )}
          {step === 4 && (
            <span className="text-sm text-muted-foreground">Step 4 of 4 &middot; 100% complete</span>
          )}
        </div>
      </header>

      {step < 4 && (
        <div className="bg-card border-b border-border px-4 sm:px-6 py-2">
          <div className="max-w-3xl mx-auto">
            <ProgressBar value={(step / 3) * 100} showPercent={false} variant="blue" size="sm" />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <div className="max-w-3xl mx-auto">
          <AnimatePresence mode="wait">

          {/* ── Step 1: Subjects ───────────────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <p className="text-[11px] font-bold text-primary uppercase tracking-[0.12em] mb-1.5">Step 1</p>
              <h1 className="text-3xl font-bold text-foreground mb-1" style={{ fontFamily: "var(--font-feather)" }}>
                Which subjects do you want to study?
              </h1>
              <p className="text-muted-foreground mb-8">Select one or more subjects. We&apos;ll personalize your study plan.</p>

              <motion.div className="space-y-3" initial="hidden" animate="visible" transition={{ staggerChildren: 0.06 }}>
                {SUBJECTS.map(({ code, name, description, topics, Icon, iconBg, cardSelected, checkSelected, badgeCls }) => {
                  const selected = selectedSubjects.includes(code);
                  return (
                    <motion.button
                      key={code}
                      variants={fadeUp}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() =>
                        setSelectedSubjects((prev) =>
                          prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
                        )
                      }
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all hover:shadow-md",
                        selected ? cardSelected : "border-border bg-card hover:border-border"
                      )}
                    >
                      {/* Checkbox */}
                      <div
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                          selected ? checkSelected : "border-border bg-card"
                        )}
                      >
                        <AnimatePresence>
                          {selected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 20 }}
                            >
                              <Check className="w-3 h-3 text-white" strokeWidth={3} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Icon — keyed on `selected` so the pop only plays on the actual
                          toggle, not on every re-render caused by clicking a different card */}
                      <motion.div
                        key={String(selected)}
                        className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", iconBg)}
                        initial={{ scale: 0.85, rotate: selected ? -8 : 0 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      >
                        <Icon className="w-6 h-6 text-white" />
                      </motion.div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-foreground">{name}</p>
                        <p className="text-sm text-muted-foreground">{description}</p>
                      </div>

                      {/* Topic count badge */}
                      <span className={cn("shrink-0 self-start text-[11px] font-bold px-2.5 py-1 rounded-full border", badgeCls)}>
                        {topics}
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            </motion.div>
          )}

          {/* ── Step 2: Exam date + Schedule ───────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <p className="text-[11px] font-bold text-primary uppercase tracking-[0.12em] mb-1.5">Step 2</p>
              <h1 className="text-3xl font-bold text-foreground mb-1" style={{ fontFamily: "var(--font-feather)" }}>
                When is your exam?
              </h1>
              <p className="text-muted-foreground mb-8">We&apos;ll use this to create a realistic study schedule that fits your timeline.</p>

              {/* Date of birth — only for accounts that never provided one (Google sign-ups) */}
              {needsDob && (
                <div className="mb-8">
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Date of birth
                  </label>
                  <DobPicker value={dateOfBirth} onChange={setDateOfBirth} />
                  {dateOfBirth && !dobValid() && (
                    <p className="mt-1.5 text-xs text-danger">You must be at least 16 years old to use GED Prep.</p>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground">We need this to confirm you meet the age requirement.</p>
                </div>
              )}

              {/* Exam date */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Target exam date
                </label>
                <ExamDatePicker value={examDate} onChange={setExamDate} minDate={minDate} />
                {examDate && examDate < minDate && (
                  <p className="mt-1.5 text-xs text-danger">Please choose a date at least 7 days from today.</p>
                )}
              </div>

              {/* Schedule builder */}
              <div>
                <p className="text-sm font-semibold text-foreground mb-0.5">Set your study schedule</p>
                <p className="text-sm text-muted-foreground mb-4">Add the days and times you&apos;re available to study.</p>

                <div className="bg-card rounded-xl border border-border divide-y divide-border">
                  {WEEK_DAYS.map(({ label, dow }) => {
                    const day = schedule[dow];
                    return (
                      <div key={dow} className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          {/* Day toggle */}
                          <button
                            onClick={() => toggleDay(dow)}
                            className="mt-0.5 shrink-0"
                            aria-label={`Toggle ${label}`}
                          >
                            <div className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                              day.enabled ? "bg-green-500 border-green-500" : "border-border"
                            )}>
                              {day.enabled && <div className="w-2 h-2 bg-card rounded-full" />}
                            </div>
                          </button>

                          {/* Day label */}
                          <span className={cn(
                            "w-8 text-sm font-semibold shrink-0 mt-0.5",
                            day.enabled ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {label}
                          </span>

                          {/* Slots */}
                          <div className="flex-1 space-y-2">
                            {day.enabled && day.slots.map((slot) => {
                              const invalid = slot.start >= slot.end;
                              const selectCls = (invalid: boolean) => cn(
                                "px-2.5 py-1.5 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 cursor-pointer",
                                invalid
                                  ? "border-red-400 focus:ring-red-300 text-red-600 dark:text-red-400"
                                  : "border-border focus:ring-ring"
                              );
                              return (
                              <div key={slot.id} className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                <select
                                  value={slot.start}
                                  onChange={(e) => updateSlot(dow, slot.id, "start", e.target.value)}
                                  className={selectCls(invalid)}
                                >
                                  {TIME_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                                <span className="text-muted-foreground text-sm">—</span>
                                <select
                                  value={slot.end}
                                  onChange={(e) => updateSlot(dow, slot.id, "end", e.target.value)}
                                  className={selectCls(invalid)}
                                >
                                  {TIME_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => removeSlot(dow, slot.id)}
                                  className="p-1 text-muted-foreground hover:text-muted-foreground transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              {invalid && (
                                <p className="text-xs text-red-500 pl-1">End time must be after start time</p>
                              )}
                              </div>
                              );
                            })}

                            {/* Add time button */}
                            <button
                              onClick={() => addSlot(dow)}
                              className="flex items-center gap-1 text-sm text-primary hover:text-primary font-medium transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                              Add time
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Weekly summary */}
                <div className="mt-4 flex items-center gap-3 bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/25 rounded-xl px-4 py-3">
                  <Clock className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Your weekly study time</p>
                    <p className="text-sm text-muted-foreground">
                      {totalHours} hour{totalHours !== 1 ? "s" : ""} &middot; {activeDays} day{activeDays !== 1 ? "s" : ""} per week
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Review ─────────────────────────────────────────── */}
          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <p className="text-[11px] font-bold text-primary uppercase tracking-[0.12em] mb-1.5">Step 3</p>
              <h1 className="text-3xl font-bold text-foreground mb-1" style={{ fontFamily: "var(--font-feather)" }}>
                Review your plan.
              </h1>
              <p className="text-muted-foreground mb-8">Here&apos;s a summary of your study plan. You can go back to make changes.</p>

              {error && (
                <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/25 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Left: Subjects */}
                <div className="md:col-span-2 bg-card rounded-xl border border-border p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-foreground">Subjects</p>
                    <button onClick={() => setStep(1)} className="text-sm text-primary hover:underline font-medium">Edit</button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{selectedSubjects.length} of {SUBJECTS.length} selected</p>
                  <div className="space-y-2.5">
                    {SUBJECTS.map(({ code, name, Icon, iconBg }) => {
                      const sel = selectedSubjects.includes(code);
                      return (
                        <div key={code} className="flex items-center gap-2.5">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", sel ? iconBg : "bg-muted")}>
                            <Icon className={cn("w-4 h-4", sel ? "text-white" : "text-muted-foreground")} />
                          </div>
                          <span className={cn("text-sm flex-1", sel ? "text-foreground font-medium" : "text-muted-foreground")}>{name}</span>
                          {sel && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Exam + Schedule + Estimate */}
                <div className="md:col-span-3 space-y-4">
                  {/* Exam Date */}
                  <div className="bg-card rounded-xl border border-border p-5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        Exam Date
                      </div>
                      <button onClick={() => setStep(2)} className="text-sm text-primary hover:underline font-medium">Edit</button>
                    </div>
                    <p className="text-2xl font-bold text-foreground mt-2">
                      {examDate
                        ? new Date(examDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                        : "—"}
                    </p>
                    {daysUntilExam > 0 && (
                      <p className="text-sm text-muted-foreground mt-0.5">(In {daysUntilExam} days)</p>
                    )}
                  </div>

                  {/* Study Schedule */}
                  <div className="bg-card rounded-xl border border-border p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        Study Schedule
                      </div>
                      <button onClick={() => setStep(2)} className="text-sm text-primary hover:underline font-medium">Edit</button>
                    </div>
                    <div className="space-y-1.5">
                      {WEEK_DAYS.filter(({ dow }) => schedule[dow].enabled).map(({ label, dow }) => (
                        <div key={dow} className="flex gap-3 text-sm">
                          <span className="w-8 font-medium text-foreground">{label}</span>
                          <span className="text-muted-foreground">
                            {schedule[dow].slots
                              .filter((s) => slotMins(s) > 0)
                              .map((s) => `${fmt12h(s.start)}–${fmt12h(s.end)}`)
                              .join(", ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Estimate */}
                  <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/25 rounded-xl p-5">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">Estimated Study Plan</p>
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Based on your availability, we recommend a plan of about{" "}
                      <strong>{totalHours} hours per week</strong> for{" "}
                      <strong>{weeksUntilExam} weeks</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Step 4: Complete ───────────────────────────────────────── */}
          {step === 4 && (
            <motion.div
              key="step-4"
              className="flex flex-col items-center text-center py-8"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              {/* Mascot celebration */}
              <div className="relative mb-4">
                <div
                  className="absolute inset-0 -z-10"
                  style={{
                    background: "radial-gradient(circle,rgba(37,99,235,.16) 0%,transparent 70%)",
                    filter: "blur(6px)",
                  }}
                />
                <Image
                  src="/mascots/duo-hero.png"
                  alt="Nam and Nick celebrating with you"
                  width={220}
                  height={180}
                  style={{ width: 220, height: "auto", filter: "drop-shadow(0 10px 20px rgba(37,99,235,.2))" }}
                  className="relative"
                />
                <div className="absolute -top-1 -right-2 w-9 h-9 bg-green-500 rounded-full flex items-center justify-center shadow-[0_3px_0_rgba(0,0,0,0.15)]">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
              </div>

              <h1 className="text-3xl font-bold text-foreground mb-2" style={{ fontFamily: "var(--font-feather)" }}>
                You&apos;re all set!
              </h1>
              <p className="text-muted-foreground mb-10">Your personalized study plan is ready.</p>

              {/* Summary card */}
              <motion.div
                className="w-full max-w-md bg-card rounded-xl border border-border divide-y divide-border mb-6 text-left"
                initial="hidden"
                animate="visible"
                transition={{ staggerChildren: 0.08, delayChildren: 0.2 }}
              >
                {[
                  { label: "Subjects", value: `${selectedSubjects.length} selected` },
                  {
                    label: "Exam Date",
                    value: examDate
                      ? new Date(examDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                      : "—",
                  },
                  { label: "Study Schedule", value: `${activeDays} days per week` },
                  { label: "Total Study Time", value: `${totalHours} hours per week` },
                  { label: "Estimated Duration", value: `${weeksUntilExam} weeks` },
                ].map(({ label, value }) => (
                  <motion.div key={label} variants={fadeUp} className="flex items-center justify-between px-5 py-3.5">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="text-sm font-semibold text-foreground">{value}</span>
                  </motion.div>
                ))}
              </motion.div>

              {/* Tip */}
              <div className="w-full max-w-md bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/25 rounded-xl px-5 py-4 text-left mb-8">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-0.5">💡 Tip</p>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Consistency is key! Stick to your schedule and you&apos;ll be ready to achieve your goal.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => router.push("/dashboard")}>
                  Go to Dashboard
                </Button>
                <Button onClick={() => router.push("/pre-assessment")}>
                  Start My Plan
                </Button>
              </div>
            </motion.div>
          )}

          </AnimatePresence>

          {/* ── Navigation ─────────────────────────────────────────────── */}
          {step < 3 && (
            <div className="flex items-center justify-between mt-10">
              <Button
                variant="ghost"
                onClick={() => setStep((s) => s - 1)}
                className={step === 1 ? "invisible" : ""}
              >
                Back
              </Button>
              {/* Keyed on canProceed() so the pop/glow only plays the moment it
                  actually flips enabled, not on every unrelated re-render. */}
              <motion.div
                key={String(canProceed())}
                className="rounded-full"
                initial={{ scale: 0.92, boxShadow: "0 0 0 6px rgba(30,144,232,0.25)" }}
                animate={{ scale: 1, boxShadow: "0 0 0 0 rgba(30,144,232,0)" }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}>
                  Continue
                </Button>
              </motion.div>
            </div>
          )}

          {step === 3 && (
            <div className="flex items-center justify-between mt-10">
              <Button variant="ghost" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={handleFinish} loading={loading} disabled={loading}>
                Continue
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

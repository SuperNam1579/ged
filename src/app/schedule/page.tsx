"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  AlertCircle, ArrowLeftRight, ArrowRight, BookOpen, CalendarClock, CalendarDays, Check, CheckCircle2,
  ChevronLeft, ChevronRight, Clock, Ellipsis, Flag, Inbox, Loader2, Pencil, Plus, RotateCcw, Search,
  Shuffle, Sparkles, Target, Trash2, X,
} from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import MainLayout from "@/components/layout/MainLayout";
import Spinner from "@/components/ui/Spinner";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { useAuth } from "@/lib/hooks/useAuth";
import { postJson, sendJson } from "@/lib/csrf-client";
import { cn } from "@/lib/utils/cn";
import { withReturnTo } from "@/lib/utils/return-to";
import { addDaysStr, bangkokDateStr, dayOfWeekOf } from "@/lib/schedule/calendar";

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
  /** YYYY-MM-DD */
  scheduledDate: string;
  durationMins: number;
  status: string;
  /** STUDY = new content; REVIEW = going back over a subtopic before the exam. */
  kind: "STUDY" | "REVIEW";
  order: number;
  /** One part of a subtopic split across several sessions; partCount null until all are scheduled. */
  partIndex?: number | null;
  partCount?: number | null;
  unitNames?: string[];
}

/** What the fit check returns when a plan can't be made (POST /api/ga/generate → 422). */
interface Feasibility {
  status: string;
  shortfallMinutes: number;
  suggestions: { extraMinutesPerWeek?: number; suggestedExamDate?: string; dropOneOf?: string[] };
}

/**
 * GET /api/plans/active — whether the plan was edited, and sessions whose content
 * arrived later. (It also lists days over the learner's free time; that isn't
 * shown: after the first plan the schedule is the learner's to arrange.)
 */
interface PlanStatus {
  plan: { customized: boolean; customizedAt: string | null; canReset: boolean };
  /** Sessions planned at an estimate whose subtopic's videos have arrived since. */
  contentUpdates: ContentUpdate[];
}

interface ContentUpdate {
  sessionId: string;
  subtopicId: string;
  scheduledDate: string;
  /** The estimate it was planned at. */
  plannedMinutes: number;
  /** What the videos and articles now take. */
  contentMinutes: number;
}

/** GET /api/plans/backlog — content of the learner's subjects that isn't in the plan. */
interface BacklogItem {
  subtopicId: string;
  name: string;
  subjectCode: string;
  difficultyLevel: number;
  remainingMinutes: number;
  /** Some of it is planned or done already; remainingMinutes is the rest. */
  partlyPlanned: boolean;
}

/** What the edit forms need from the page. */
interface EditContext {
  today: string;
  /** The last day a session can go on: the day before the exam. */
  lastDay: string | null;
  byDate: Map<string, SessionEntry[]>;
  backlog: BacklogItem[];
  /** By session id: sessions whose content arrived after they were planned. */
  contentUpdates: Map<string, ContentUpdate>;
  /** Reloads the plan after a change. */
  refresh: () => Promise<void>;
}

/** Shown at the top of the day panel after a change, with a link to the day it touched. */
interface Notice {
  text: string;
  date?: string;
}

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
/** For calendar cells, where a full subject name doesn't fit. */
const SUBJECT_SHORT: Record<string, string> = { MATH: "Math", RLA: "RLA", SS: "Social", SCI: "Science" };
/** Fixed order, so a day's subjects always list the same way. */
const SUBJECT_ORDER = ["MATH", "RLA", "SCI", "SS"];
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];


// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** "Part 2/5", "Part 3" (total not known yet), or "" for a whole-subtopic session. */
function partLabel(s: SessionEntry): string {
  if (!s.partIndex) return "";
  return s.partCount ? `Part ${s.partIndex}/${s.partCount}` : `Part ${s.partIndex}`;
}

/** YYYY-MM-DD → "Tue, Oct 13" and friends. Dates are plain calendar days, so local parsing is fine for display. */
const fmtDay = (date: string, pattern: string) => format(parseISO(date), pattern);

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** The weeks (Monday first) a month view needs: 4–6 rows, never a row that is wholly another month. */
function monthGrid(year: number, month: number): string[] {
  const first = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const offset = (dayOfWeekOf(first) + 6) % 7; // days since Monday
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  const start = addDaysStr(first, -offset);
  return Array.from({ length: weeks * 7 }, (_, i) => addDaysStr(start, i));
}

type DayState = "done" | "missed" | "upcoming" | "empty";

/** A day is done when every session on it is, missed when one is past and not done. */
function dayState(daySessions: SessionEntry[], date: string, today: string): DayState {
  if (daySessions.length === 0) return "empty";
  if (daySessions.every((s) => s.status === "COMPLETED")) return "done";
  if (date < today) return "missed";
  return "upcoming";
}

function sessionState(s: SessionEntry, today: string): "done" | "missed" | "upcoming" {
  if (s.status === "COMPLETED") return "done";
  return s.scheduledDate < today ? "missed" : "upcoming";
}

function notEnoughTimeMessage(f: Feasibility): string {
  if (f.status === "exam-passed") return "Your exam date has passed. Pick a later exam date in Settings.";
  if (f.status === "no-time") return "You have no study time before your exam. Add some free time first.";
  // Same advice as onboarding: more free time. Moving the exam isn't offered.
  const perWeek = f.suggestions.extraMinutesPerWeek;
  return `You need about ${Math.ceil(f.shortfallMinutes / 60)} more hours of free time before your exam.` +
    (perWeek
      ? ` Add about ${Math.ceil(perWeek / 60)} hours each week (about ${Math.max(5, Math.ceil(perWeek / 7 / 5) * 5)} minutes a day) and we can make your plan.`
      : "");
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

// ─── PlanStatusBar ───────────────────────────────────────────────────────────
// The GA plans once; after that the plan is the learner's. This says when it
// has been changed, offers the way back, and lists sessions whose lessons
// arrived after they were planned.

function PlanStatusBar({
  status,
  onReset,
  onShowDay,
  onApplyContent,
}: {
  status: PlanStatus;
  onReset: () => Promise<void>;
  onShowDay: (date: string) => void;
  /** Sets every session in contentUpdates to the length its content now takes. */
  onApplyContent: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const { customized, canReset } = status.plan;
  const updates = status.contentUpdates ?? [];
  const updateDates = [...new Set(updates.map((u) => u.scheduledDate))].sort();

  if (!customized && updates.length === 0) return null;

  const applyContent = async () => {
    setApplying(true);
    setApplyError(null);
    try {
      await onApplyContent();
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : "Couldn't update the lengths.");
    } finally {
      setApplying(false);
    }
  };

  const reset = async () => {
    setResetting(true);
    setError(null);
    try {
      await onReset();
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reset your plan.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="mb-6 space-y-3">
      {customized && (
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full bg-primary-light text-primary">
              <Pencil className="w-3 h-3" /> Edited
            </span>
            <p className="text-sm text-muted-foreground flex-1 min-w-48">
              You&apos;ve changed this plan
              {status.plan.customizedAt ? ` (last on ${format(new Date(status.plan.customizedAt), "MMM d")})` : ""}.
            </p>
            {canReset && !confirming && (
              <button
                onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-background transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset to original plan
              </button>
            )}
          </div>
          {confirming && (
            <div className="mt-3 rounded-lg bg-background border border-border px-3.5 py-3">
              <p className="text-sm text-foreground">
                Put back the plan we made for you? Every change you made is undone. Sessions you&apos;ve
                completed stay completed.
              </p>
              {error && <p className="text-sm text-red-600 mt-1.5">{error}</p>}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={reset}
                  disabled={resetting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60"
                >
                  {resetting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Reset plan
                </button>
                <button
                  onClick={() => { setConfirming(false); setError(null); }}
                  disabled={resetting}
                  className="px-3.5 py-1.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-card transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {updates.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="flex flex-wrap items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-48">
              <p className="text-sm font-semibold text-blue-900">
                New lessons arrived for {updates.length} session{updates.length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-blue-800 mt-0.5">
                They were planned before their videos existed, so their length is still a guess. The session already
                shows the new videos; update the length so your days add up.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {updateDates.slice(0, 8).map((d) => (
                  <button
                    key={d}
                    onClick={() => onShowDay(d)}
                    className="text-xs font-semibold px-2 py-1 rounded-md bg-white border border-blue-200 text-blue-800 hover:bg-blue-100 transition-colors"
                  >
                    {fmtDay(d, "EEE d MMM")}
                  </button>
                ))}
                {updateDates.length > 8 && <span className="text-xs text-blue-800 self-center">+{updateDates.length - 8} more</span>}
              </div>
              {applyError && <p className="text-sm text-red-600 mt-2">{applyError}</p>}
            </div>
            <button
              onClick={applyContent}
              disabled={applying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              {applying && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Update all lengths
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MonthCalendar ───────────────────────────────────────────────────────────

function MonthCalendar({
  year,
  month,
  today,
  examDate,
  selected,
  byDate,
  onSelect,
  onPrev,
  onNext,
  onToday,
}: {
  year: number;
  month: number;
  today: string;
  examDate: string | null;
  selected: string | null;
  byDate: Map<string, SessionEntry[]>;
  onSelect: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const days = monthGrid(year, month);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const isThisMonth = today.startsWith(monthPrefix);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Month header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <h2 className="text-base font-bold text-foreground">{format(new Date(year, month, 1), "MMMM yyyy")}</h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onPrev}
            aria-label="Previous month"
            className="p-2 rounded-lg border border-border hover:bg-background transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          {/* Only away from the current month, where there is somewhere to go back to. */}
          {!isThisMonth && (
            <button
              onClick={onToday}
              className="px-3 py-1.5 text-sm font-medium rounded-lg text-primary bg-primary-light hover:bg-primary/15 transition-colors"
            >
              Back to today
            </button>
          )}
          <button
            onClick={onNext}
            aria-label="Next month"
            className="p-2 rounded-lg border border-border hover:bg-background transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 border-b border-border bg-background/60">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7">
        {days.map((date, i) => {
          const inMonth = date.startsWith(monthPrefix);
          const cellBorders = cn(i % 7 !== 0 && "border-l", i >= 7 && "border-t", "border-border");

          // Days of the neighbouring months only fill the grid: a faint number,
          // nothing to read and nothing to tap, so each month reads on its own.
          if (!inMonth) {
            return (
              <div key={date} className={cn("h-16 sm:h-28 xl:h-[8.5rem] p-1.5 bg-muted/40", cellBorders)} aria-hidden="true">
                <span className="text-xs font-medium text-muted-foreground/40">{Number(date.slice(8))}</span>
              </div>
            );
          }

          const daySessions = byDate.get(date) ?? [];
          const state = dayState(daySessions, date, today);
          const isToday = date === today;
          const isSelected = date === selected;
          const isExam = date === examDate;
          const afterExam = examDate !== null && date > examDate;
          const isPast = date < today;
          const subjects = SUBJECT_ORDER.filter((code) => daySessions.some((s) => s.subjectCode === code));
          const hasReview = daySessions.some((s) => s.kind === "REVIEW");
          const mins = daySessions.reduce((n, s) => n + s.durationMins, 0);

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              aria-label={`${fmtDay(date, "EEEE, MMMM d")}${daySessions.length ? `, ${daySessions.length} sessions` : ", no study"}`}
              aria-pressed={isSelected}
              className={cn(
                "relative flex flex-col items-stretch text-left h-16 sm:h-28 xl:h-[8.5rem] p-1 sm:p-1.5 transition-colors",
                cellBorders,
                afterExam ? "bg-muted/40" : "hover:bg-background",
                isSelected && "bg-primary-light/60 hover:bg-primary-light/60 ring-2 ring-inset ring-primary"
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={cn(
                    "w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold",
                    isToday ? "bg-primary text-white" : afterExam || isPast ? "text-muted-foreground" : "text-foreground"
                  )}
                >
                  {Number(date.slice(8))}
                </span>
                <span className="flex items-center gap-0.5">
                  {hasReview && !isExam && (
                    <RotateCcw className="w-3 h-3 text-teal-600" aria-label="Includes a review session">
                      <title>Includes a review session</title>
                    </RotateCcw>
                  )}
                  {state === "done" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" aria-label="All done" />}
                  {state === "missed" && <AlertCircle className="w-3.5 h-3.5 text-red-500" aria-label="Missed" />}
                </span>
              </div>

              {isExam ? (
                <span className="mt-1 inline-flex items-center justify-center gap-1 rounded-md bg-red-100 text-red-700 text-[10px] sm:text-[11px] font-bold py-0.5">
                  <Flag className="w-3 h-3" /> <span className="hidden sm:inline">Exam</span>
                </span>
              ) : (
                <>
                  {/* Phone: one dot per subject. Wider: a dot and the subject's name. */}
                  <div className="mt-1 flex flex-wrap gap-0.5 px-0.5 sm:hidden">
                    {subjects.map((code) => (
                      <span key={code} className={cn("w-2 h-2 rounded-full", (SUBJECT_COLOR[code] ?? DEFAULT_SUBJECT_COLOR).dot)} />
                    ))}
                  </div>
                  {/* Every subject by name. All four fit only in the taller xl
                      cells; below that, a four-subject day shows its four dots. */}
                  <ul className={cn("mt-1 hidden sm:flex flex-col gap-px px-0.5", state === "done" && "opacity-50")}>
                    {subjects.map((code) => (
                      <li
                        key={code}
                        className={cn(
                          "items-center gap-1.5 min-w-0 text-[11.5px] leading-[18px] text-foreground/85",
                          subjects.length > 3 ? "hidden xl:flex" : "flex"
                        )}
                      >
                        <span className={cn("w-2 h-2 rounded-full shrink-0", (SUBJECT_COLOR[code] ?? DEFAULT_SUBJECT_COLOR).dot)} />
                        <span className="truncate">{SUBJECT_SHORT[code] ?? code}</span>
                      </li>
                    ))}
                    {subjects.length > 3 && (
                      <li className="flex xl:hidden flex-col gap-1 text-[11px] leading-[18px] text-foreground/85">
                        <span className="flex gap-1">
                          {subjects.map((code) => (
                            <span key={code} className={cn("w-2 h-2 rounded-full", (SUBJECT_COLOR[code] ?? DEFAULT_SUBJECT_COLOR).dot)} />
                          ))}
                        </span>
                        {subjects.length} subjects
                      </li>
                    )}
                  </ul>
                </>
              )}

              {!isExam && daySessions.length > 0 && (
                <div className="mt-auto hidden sm:block px-0.5 text-[10.5px] text-muted-foreground tabular-nums">
                  {fmtMins(mins)}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 border-t border-border text-[11px] text-muted-foreground">
        {SUBJECT_ORDER.map((code) => (
          <span key={code} className="inline-flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full", (SUBJECT_COLOR[code] ?? DEFAULT_SUBJECT_COLOR).dot)} />
            {SUBJECT_LABEL[code]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1"><RotateCcw className="w-3 h-3 text-teal-600" /> Review</span>
        <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> Done</span>
        <span className="inline-flex items-center gap-1"><AlertCircle className="w-3 h-3 text-red-500" /> Missed</span>
        <span className="inline-flex items-center gap-1"><Flag className="w-3 h-3 text-red-600" /> Exam</span>
      </div>
    </div>
  );
}

// ─── Editing ─────────────────────────────────────────────────────────────────
// The plan is the learner's once the GA has made it. Every change goes through
// /api/sessions and is applied exactly; nothing re-plans around it. Completed
// sessions can't be changed, and a missed one can be moved but not swapped.

type EditMode = "move" | "swap" | "topic" | "remove";

const EDIT_ACTIONS: { mode: EditMode; label: string; icon: typeof Clock }[] = [
  { mode: "move", label: "Move to another day", icon: CalendarClock },
  { mode: "swap", label: "Swap with another session", icon: ArrowLeftRight },
  { mode: "topic", label: "Study another topic", icon: Shuffle },
  { mode: "remove", label: "Remove", icon: Trash2 },
];

const INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

const canPlanOn = (ctx: EditContext, date: string) =>
  date >= ctx.today && (ctx.lastDay === null || date <= ctx.lastDay);

const validMinutes = (v: string) => /^\d+$/.test(v) && Number(v) >= 5 && Number(v) <= 600;

/** What is already on a day, so the learner can see if it has room. */
function dayLoadText(ctx: EditContext, date: string, exceptId?: string): string {
  const list = (ctx.byDate.get(date) ?? []).filter((s) => s.id !== exceptId);
  if (list.length === 0) return "Nothing planned that day yet.";
  const mins = list.reduce((n, s) => n + s.durationMins, 0);
  return `Already planned that day: ${list.length} session${list.length !== 1 ? "s" : ""} · ${fmtMins(mins)}`;
}

/**
 * Parts of a split subtopic are numbered by their content, not their day, and
 * the server keeps them in order: an edit that puts a later part before an
 * earlier one is refused (409). This finds that before the learner submits, so
 * the form can say why and hold the button.
 *
 * `moves` puts sessions at a new day and position; a moved session without a
 * position goes last on its day, as the server does.
 */
function partOrderWarning(ctx: EditContext, moves: { s: SessionEntry; date: string; order?: number }[]): string | null {
  const all = [...ctx.byDate.values()].flat();
  const place = (x: SessionEntry): [string, number] => {
    const m = moves.find((mv) => mv.s.id === x.id);
    return m ? [m.date, m.order ?? Infinity] : [x.scheduledDate, x.order];
  };
  for (const { s } of moves) {
    if (s.kind !== "STUDY" || !s.partIndex) continue;
    for (const o of all) {
      if (o.id === s.id || o.subtopicId !== s.subtopicId || o.kind !== "STUDY" || !o.partIndex) continue;
      const [sd, so] = place(s);
      const [od, oo] = place(o);
      const sFirst = sd < od || (sd === od && so < oo);
      if (sFirst !== s.partIndex < o.partIndex) {
        return `This puts Part ${s.partIndex} of ${s.subtopicName} ${sFirst ? "before" : "after"} Part ${o.partIndex} (${fmtDay(od, "EEE, MMM d")}), and parts stay in order. Pick a day ${sFirst ? "after" : "before"} it.`;
      }
    }
  }
  return null;
}

/** Why the change can't be made; the form's button stays off while it shows. */
function OrderWarning({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="mt-2 flex items-start gap-1.5 rounded-md bg-red-50 border border-red-200 px-2.5 py-2 text-xs text-red-700">
      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px text-red-600" /> {text}
    </p>
  );
}

/** Runs a change, keeps its error to show, and calls onSuccess once it worked. */
function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (change: () => Promise<unknown>, onSuccess: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await change();
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/** The ⋯ button on a session and its menu. */
function SessionMenu({
  actions,
  onPick,
  className,
}: {
  actions: typeof EDIT_ACTIONS;
  onPick: (mode: EditMode) => void;
  /** Where the button sits in the session. */
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div
      ref={ref}
      className={cn("absolute", className)}
      // Esc closes the menu first, not the whole day panel.
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Change this session"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn("p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors", open && "bg-muted text-foreground")}
      >
        <Ellipsis className="w-4 h-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-20 w-56 rounded-lg border border-border bg-card shadow-lg py-1">
          {actions.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onPick(mode);
              }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-background transition-colors",
                mode === "remove" ? "text-red-600" : "text-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" /> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The frame every edit form shares: a title, the fields, an error, and the buttons. */
function EditBox({
  title,
  children,
  error,
  busy,
  submitLabel,
  canSubmit,
  danger,
  onSubmit,
  onCancel,
}: {
  title: string;
  children: React.ReactNode;
  error: string | null;
  busy: boolean;
  submitLabel: string;
  canSubmit: boolean;
  danger?: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      // Fields are checked here, not by the browser: its step check would
      // refuse lengths like 74 minutes, which content often adds up to.
      noValidate
      className="mt-2 rounded-lg border border-border bg-background p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit && !busy) onSubmit();
      }}
      // Esc cancels the form first, not the whole day panel.
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <p className="text-sm font-semibold text-foreground mb-2">{title}</p>
      {children}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      <div className="flex gap-2 mt-3">
        <button
          type="submit"
          disabled={!canSubmit || busy}
          className={cn(
            "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-50",
            danger ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary-dark"
          )}
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-3.5 py-1.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-card transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function DateField({ ctx, value, onChange, label = "Day" }: { ctx: EditContext; value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="date"
        value={value}
        min={ctx.today}
        max={ctx.lastDay ?? undefined}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLASS}
      />
      {value && !canPlanOn(ctx, value) && (
        <span className="block text-xs text-red-600 mt-1">
          {value < ctx.today ? "Pick today or a later day." : "Pick a day before your exam."}
        </span>
      )}
    </label>
  );
}

function MinutesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">Length (minutes)</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={5}
          max={600}
          step={5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(INPUT_CLASS, "w-28")}
        />
        {validMinutes(value) && <span className="mt-1 text-sm text-muted-foreground">= {fmtMins(Number(value))}</span>}
      </div>
      {value && !validMinutes(value) && <span className="block text-xs text-red-600 mt-1">Between 5 and 600 minutes.</span>}
    </label>
  );
}

/** GET /api/plans/topics — a topic of any subject, with where it stands for this learner. */
interface TopicItem {
  subtopicId: string;
  name: string;
  subjectCode: string;
  category: string;
  topic: string;
  status: "new" | "partly" | "planned" | "done";
  remainingMinutes: number;
  /** What a study session of it covers: its next part, or all of it when it is one part. */
  nextPartMinutes: number;
  /** Which part that is; null for a topic that is one part. */
  nextPart: { index: number; total: number } | null;
  /** First unfinished session of it in the plan. */
  nextDate: string | null;
  score: number | null;
}

/** Whether picking it adds new content (STUDY) or goes back over it (REVIEW). */
const isStudied = (t: TopicItem) => t.status === "planned" || t.status === "done";

type StatusFilter = "all" | "new" | "planned" | "done";
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "Not in plan" },
  { key: "planned", label: "In plan" },
  { key: "done", label: "Done" },
];

function statusLine(t: TopicItem): string {
  if (t.status === "done") return "Done";
  if (t.status === "planned") return t.nextDate ? `In your plan · ${fmtDay(t.nextDate, "EEE d MMM")}` : "In your plan";
  const part = t.nextPart ? `Part ${t.nextPart.index} of ${t.nextPart.total}` : null;
  if (t.status === "partly") return `${part ?? "Part of it is planned"} · ${fmtMins(t.remainingMinutes)} left`;
  return [part, t.category, t.topic].filter(Boolean).join(" · ");
}

/** What a study session of the topic will cover, for the add/replace forms. */
function nextPartNote(t: TopicItem): string {
  if (!t.nextPart) return `This session covers the whole topic: ${fmtMins(t.nextPartMinutes)}.`;
  const { index, total } = t.nextPart;
  const after = index < total ? ` Add part ${index + 1} on another day.` : " It's the last part.";
  return `This session covers part ${index} of ${total} (${fmtMins(t.nextPartMinutes)}). Long topics come in parts of up to 2 hours.${after}`;
}

/**
 * Every topic of every subject, filtered by subject (all four can be ticked —
 * a learner may add any subject's topics, no test needed; none is ticked at
 * first) and by where it stands. Listed in the planner's own order — basics first, weakest first — so
 * the topic marked "Next up" in each subject is the sensible one to take.
 *
 * `studiedPickable`: whether a topic already planned or done may be picked
 * (adding one makes a review). A study session given another topic needs
 * content still to plan, so that picker greys them out.
 */
function TopicPicker({
  onPick,
  studiedPickable,
  exclude,
}: {
  onPick: (item: TopicItem) => void;
  studiedPickable: boolean;
  exclude?: string;
}) {
  const [catalog, setCatalog] = useState<{ selected: string[]; topics: TopicItem[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/plans/topics")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { selected: string[]; topics: TopicItem[] }) => {
        if (cancelled) return;
        // Nothing ticked to start: the learner picks the subject they want first.
        setCatalog(d);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return <p className="text-sm text-red-600">Couldn&apos;t load the topics. Close this and try again.</p>;
  if (!catalog) {
    return (
      <div className="py-6 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const matches = (t: TopicItem) =>
    t.subtopicId !== exclude &&
    (status === "all" ||
      (status === "new" && (t.status === "new" || t.status === "partly")) ||
      (status === "planned" && t.status === "planned") ||
      (status === "done" && t.status === "done")) &&
    (!q || `${t.name} ${t.topic} ${t.category}`.toLowerCase().includes(q));
  const codes = SUBJECT_ORDER.filter((c) => ticked.has(c));
  const toggle = (code: string) =>
    setTicked((cur) => {
      const next = new Set(cur);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  return (
    <div className="space-y-2">
      {/* Subjects: tick any of the four. */}
      <div className="flex flex-wrap gap-1.5">
        {SUBJECT_ORDER.map((code) => {
          const on = ticked.has(code);
          const mine = catalog.selected.includes(code);
          return (
            <button
              key={code}
              type="button"
              onClick={() => toggle(code)}
              aria-pressed={on}
              title={mine ? undefined : "Not one of your subjects — you can still add its topics"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
                on ? "border-primary bg-primary-light/60 text-foreground" : "border-border bg-card text-muted-foreground hover:bg-background"
              )}
            >
              <span className={cn("flex items-center justify-center w-3.5 h-3.5 rounded-[4px] border", on ? "bg-primary border-primary" : "border-border")}>
                {on && <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />}
              </span>
              <span className={cn("w-2 h-2 rounded-full", (SUBJECT_COLOR[code] ?? DEFAULT_SUBJECT_COLOR).dot)} />
              {SUBJECT_SHORT[code] ?? code}
            </button>
          );
        })}
      </div>

      {/* Where it stands, and a search. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatus(f.key)}
              aria-pressed={status === f.key}
              className={cn(
                "px-2 py-1 rounded-md text-[11px] font-semibold transition-colors",
                status === f.key ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="relative flex-1 min-w-36">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topics"
            aria-label="Search topics"
            className="w-full rounded-lg border border-border bg-card pl-8 pr-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-card divide-y divide-border">
        {codes.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Pick a subject above to see its topics.</p>}
        {codes.map((code) => {
          // What's left to study first, then what's planned, then what's done —
          // each in the planner's order.
          const rank = (t: TopicItem) => (t.status === "done" ? 2 : t.status === "planned" ? 1 : 0);
          const list = catalog.topics
            .filter((t) => t.subjectCode === code && matches(t))
            .map((t, i) => ({ t, i }))
            .sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i)
            .map(({ t }) => t);
          if (list.length === 0) return null;
          // The planner's next pick in this subject: its first topic still to plan.
          const nextUp = !q && status !== "planned" && status !== "done" ? list.find((t) => !isStudied(t))?.subtopicId : undefined;
          return (
            <div key={code}>
              <p className="sticky top-0 z-10 bg-card px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {SUBJECT_LABEL[code] ?? code}
                {!catalog.selected.includes(code) && <span className="normal-case tracking-normal font-normal"> · not one of your subjects</span>}
              </p>
              {list.map((t) => {
                const disabled = !studiedPickable && isStudied(t);
                return (
                  <button
                    key={t.subtopicId}
                    type="button"
                    onClick={() => onPick(t)}
                    disabled={disabled}
                    title={disabled ? "Already in your plan or done — pick a topic with something left to study." : undefined}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-background transition-colors disabled:opacity-45 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                  >
                    <span className={cn("w-2 h-2 rounded-full shrink-0", (SUBJECT_COLOR[code] ?? DEFAULT_SUBJECT_COLOR).dot)} />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm text-foreground truncate">{t.name}</span>
                        {t.subtopicId === nextUp && (
                          <span className="shrink-0 rounded-full bg-primary-light px-1.5 py-px text-[10px] font-bold text-primary">Next up</span>
                        )}
                      </span>
                      <span className="block text-[11px] text-muted-foreground truncate">{statusLine(t)}</span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-[11px] font-semibold tabular-nums",
                        t.status === "done" ? "text-green-600" : isStudied(t) ? "text-teal-700" : "text-muted-foreground"
                      )}
                    >
                      {t.status === "done" ? "✓ Done" : isStudied(t) ? "Review" : fmtMins(t.nextPartMinutes)}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
        {codes.length > 0 && codes.every((code) => !catalog.topics.some((t) => t.subjectCode === code && matches(t))) && (
          <p className="px-3 py-3 text-sm text-muted-foreground">No topic matches.</p>
        )}
      </div>
    </div>
  );
}

/** The form for one action on one session. */
function SessionEditor({
  mode,
  session: s,
  ctx,
  onDone,
  onCancel,
}: {
  mode: EditMode;
  session: SessionEntry;
  ctx: EditContext;
  onDone: (notice: Notice) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(() => (mode === "move" ? (s.scheduledDate < ctx.today ? ctx.today : s.scheduledDate) : ""));
  const [swapWith, setSwapWith] = useState<string | null>(null);
  const [topic, setTopic] = useState<TopicItem | null>(null);
  const { busy, error, run } = useSubmit();
  // A study session takes the new topic's next part, at its length; a review keeps its own.
  const coversPart = s.kind === "STUDY" && topic !== null && !isStudied(topic);
  const url = `/api/sessions/${s.id}`;

  const change = (send: () => Promise<unknown>, done: Notice) =>
    run(
      async () => {
        await send();
        await ctx.refresh();
      },
      () => onDone(done)
    );
  const common = { error, busy, onCancel };

  if (mode === "move") {
    return (
      <EditBox
        {...common}
        title="Move to another day"
        submitLabel="Move"
        canSubmit={canPlanOn(ctx, date) && date !== s.scheduledDate && !partOrderWarning(ctx, [{ s, date }])}
        onSubmit={() =>
          change(() => sendJson("PATCH", url, { scheduledDate: date }), { text: `Moved to ${fmtDay(date, "EEE, MMM d")}.`, date })
        }
      >
        <DateField ctx={ctx} value={date} onChange={setDate} />
        {date && canPlanOn(ctx, date) && <p className="text-xs text-muted-foreground mt-1.5">{dayLoadText(ctx, date, s.id)}</p>}
        {date && canPlanOn(ctx, date) && date !== s.scheduledDate && <OrderWarning text={partOrderWarning(ctx, [{ s, date }])} />}
      </EditBox>
    );
  }

  if (mode === "swap") {
    const others = date ? (ctx.byDate.get(date) ?? []).filter((o) => o.id !== s.id && o.status !== "COMPLETED") : [];
    const target = others.find((o) => o.id === swapWith);
    return (
      <EditBox
        {...common}
        title="Swap with another session"
        submitLabel="Swap"
        canSubmit={
          Boolean(target) &&
          !partOrderWarning(ctx, [
            { s, date: target!.scheduledDate, order: target!.order },
            { s: target!, date: s.scheduledDate, order: s.order },
          ])
        }
        onSubmit={() =>
          change(() => postJson("/api/sessions/swap", { a: s.id, b: swapWith }), {
            text: `Swapped with ${target!.subtopicName} on ${fmtDay(date, "EEE, MMM d")}.`,
            date,
          })
        }
      >
        <DateField
          ctx={ctx}
          label="Day of the other session"
          value={date}
          onChange={(v) => {
            setDate(v);
            setSwapWith(null);
          }}
        />
        {date && canPlanOn(ctx, date) && (
          <div className="mt-2 space-y-1.5">
            {others.length === 0 && <p className="text-xs text-muted-foreground">No session to swap with on that day.</p>}
            {others.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setSwapWith(o.id)}
                aria-pressed={swapWith === o.id}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                  swapWith === o.id ? "border-primary bg-primary-light/60" : "border-border bg-card hover:bg-background"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full shrink-0", (SUBJECT_COLOR[o.subjectCode] ?? DEFAULT_SUBJECT_COLOR).dot)} />
                <span className="flex-1 min-w-0 text-sm text-foreground truncate">
                  {o.subtopicName}
                  {partLabel(o) && <span className="text-muted-foreground"> · {partLabel(o)}</span>}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{fmtMins(o.durationMins)}</span>
              </button>
            ))}
          </div>
        )}
        {target && (
          <OrderWarning
            text={partOrderWarning(ctx, [
              { s, date: target.scheduledDate, order: target.order },
              { s: target, date: s.scheduledDate, order: s.order },
            ])}
          />
        )}
        <p className="text-xs text-muted-foreground mt-2">The two sessions trade days. Their lengths stay as they are.</p>
      </EditBox>
    );
  }

  if (mode === "topic") {
    return (
      <EditBox
        {...common}
        title="Study another topic"
        submitLabel="Study this instead"
        canSubmit={Boolean(topic)}
        onSubmit={() =>
          change(
            () =>
              sendJson("PATCH", url, { subtopicId: topic!.subtopicId }),
            { text: `Changed to ${topic!.name}.` }
          )
        }
      >
        {topic ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-primary bg-primary-light/60 px-3 py-2">
            <span className={cn("w-2 h-2 rounded-full shrink-0", (SUBJECT_COLOR[topic.subjectCode] ?? DEFAULT_SUBJECT_COLOR).dot)} />
            <span className="flex-1 min-w-0 text-sm text-foreground truncate">{topic.name}</span>
            <button type="button" onClick={() => setTopic(null)} className="text-xs font-semibold text-primary hover:underline shrink-0">
              Change
            </button>
          </div>
        ) : (
          <TopicPicker onPick={setTopic} studiedPickable={s.kind === "REVIEW"} exclude={s.subtopicId} />
        )}
        {coversPart && <p className="text-xs text-muted-foreground mt-2">{nextPartNote(topic!)}</p>}
        <p className="text-xs text-muted-foreground mt-2">
          {s.kind === "REVIEW"
            ? "This review will go over the new topic instead."
            : `Same day. The session takes as long as the part of the new topic it covers, and ${s.subtopicName} goes back to “Not in your plan yet”. Topics already in your plan or done are greyed out — add a review of them instead.`}
        </p>
      </EditBox>
    );
  }

  return (
    <EditBox
      {...common}
      title="Remove this session?"
      submitLabel="Remove"
      danger
      canSubmit
      onSubmit={() => change(() => sendJson("DELETE", url), { text: `Removed ${s.subtopicName}.` })}
    >
      <p className="text-sm text-muted-foreground">
        {s.kind === "REVIEW"
          ? "The review is taken out of your plan."
          : "Its content goes to “Not in your plan yet”, so you can add it to another day later."}
      </p>
    </EditBox>
  );
}

/** Length of a review session, as the planner makes them (lib/schedule/review.ts). */
const REVIEW_LENGTH = 30;

/**
 * Adds a session from the backlog. With `date` it adds to that day (the day
 * panel); without, the learner picks the day too (the backlog notice).
 */
function AddSessionForm({
  ctx,
  date: fixedDate,
  onDone,
  onCancel,
}: {
  ctx: EditContext;
  date?: string;
  onDone: (notice: Notice) => void;
  onCancel: () => void;
}) {
  const [item, setItem] = useState<TopicItem | null>(null);
  const [date, setDate] = useState(fixedDate ?? "");
  const [mins, setMins] = useState("");
  const { busy, error, run } = useSubmit();
  // A topic already planned or done can't be planned again; adding it goes back over it.
  const review = item !== null && isStudied(item);

  const pick = (i: TopicItem) => {
    setItem(i);
    setMins(String(REVIEW_LENGTH));
  };

  return (
    <EditBox
      title={fixedDate ? `Add a session on ${fmtDay(fixedDate, "EEE, MMM d")}` : "Add a topic to a day"}
      submitLabel="Add session"
      error={error}
      busy={busy}
      canSubmit={Boolean(item) && canPlanOn(ctx, date) && (!review || validMinutes(mins))}
      onCancel={onCancel}
      onSubmit={() =>
        run(
          async () => {
            await postJson("/api/sessions", {
              subtopicId: item!.subtopicId,
              scheduledDate: date,
              // A study session is the topic's next part, at that part's length; only a review has a length to pick.
              ...(review ? { durationMins: Number(mins) } : {}),
              kind: review ? "REVIEW" : "STUDY",
            });
            await ctx.refresh();
          },
          () => onDone({ text: `Added ${review ? "a review of " : ""}${item!.name} on ${fmtDay(date, "EEE, MMM d")}.`, date })
        )
      }
    >
      {item ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 rounded-lg border border-primary bg-primary-light/60 px-3 py-2">
            <span className={cn("w-2 h-2 rounded-full shrink-0", (SUBJECT_COLOR[item.subjectCode] ?? DEFAULT_SUBJECT_COLOR).dot)} />
            <span className="flex-1 min-w-0 text-sm text-foreground truncate">{item.name}</span>
            <button type="button" onClick={() => setItem(null)} className="text-xs font-semibold text-primary hover:underline shrink-0">
              Change
            </button>
          </div>
          {!fixedDate && (
            <div>
              <DateField ctx={ctx} value={date} onChange={setDate} />
              {date && canPlanOn(ctx, date) && <p className="text-xs text-muted-foreground mt-1.5">{dayLoadText(ctx, date)}</p>}
            </div>
          )}
          {review ? (
            <div>
              <MinutesField value={mins} onChange={setMins} />
              <p className="text-xs text-muted-foreground mt-1.5">
                {`${item.status === "done" ? "You've done this topic" : "This topic is already in your plan"}, so this adds a review session to go back over it.`}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{nextPartNote(item)}</p>
          )}
        </div>
      ) : (
        <TopicPicker onPick={pick} studiedPickable />
      )}
    </EditBox>
  );
}

/** Says how much of the learner's subjects isn't planned, and lets them add it to a day. */
function BacklogNotice({ ctx, onAdded }: { ctx: EditContext; onAdded: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  if (ctx.backlog.length === 0) return null;
  const total = ctx.backlog.reduce((n, i) => n + i.remainingMinutes, 0);
  const n = ctx.backlog.length;

  return (
    <div className="mb-6 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <Inbox className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-48">
          <p className="text-sm font-semibold text-foreground">
            {n} topic{n !== 1 ? "s" : ""} not in your plan yet · {fmtMins(total)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            What didn&apos;t fit before your exam, or what you removed. Add it to a day when you have time.
          </p>
        </div>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-background transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add to a day
          </button>
        )}
      </div>
      {open && (
        <AddSessionForm
          ctx={ctx}
          onCancel={() => setOpen(false)}
          onDone={(notice) => {
            setOpen(false);
            if (notice.date) onAdded(notice.date);
          }}
        />
      )}
    </div>
  );
}

// ─── SessionItem ─────────────────────────────────────────────────────────────

/** Lengths a session can take (PATCH /api/sessions/:id). */
const clampMinutes = (m: number) => Math.min(600, Math.max(5, Math.round(m)));

/** Past this, one session is a long day; the note suggests splitting it. */
const LONG_SESSION_MINUTES = 180;

/** Under a session planned at an estimate whose videos have arrived since: one click to fit the length. */
function ContentUpdateNote({
  session: s,
  update,
  ctx,
  onDone,
}: {
  session: SessionEntry;
  update: ContentUpdate;
  ctx: EditContext;
  onDone: (notice: Notice) => void;
}) {
  const { busy, error, run } = useSubmit();
  const target = clampMinutes(update.contentMinutes);
  return (
    <div className="mx-3 mb-2.5 rounded-md bg-blue-50 border border-blue-200 px-2.5 py-2 text-xs text-blue-900">
      <p className="flex items-start gap-1.5">
        <Sparkles className="w-3.5 h-3.5 shrink-0 mt-px text-blue-600" />
        <span>
          New lessons arrived. This now takes about <b>{fmtMins(update.contentMinutes)}</b>; it was planned at{" "}
          {fmtMins(s.durationMins)}.
        </span>
      </p>
      {/* A whole subtopic's worth in one day is too much. Removing the session
          puts its videos in the backlog, from where it can go back in parts. */}
      {update.contentMinutes > LONG_SESSION_MINUTES && (
        <p className="mt-1 text-blue-800">
          That&apos;s a lot for one day. To spread it out, remove this session, then add the topic back in parts from
          “Not in your plan yet”.
        </p>
      )}
      {error && <p className="text-red-600 mt-1">{error}</p>}
      {target !== s.durationMins && (
        <button
          disabled={busy}
          onClick={() =>
            run(
              async () => {
                await sendJson("PATCH", `/api/sessions/${s.id}`, { durationMins: target });
                await ctx.refresh();
              },
              () => onDone({ text: `Set ${s.subtopicName} to ${fmtMins(target)}.` })
            )
          }
          className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-white font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60"
        >
          {busy && <Loader2 className="w-3 h-3 animate-spin" />} Set to {fmtMins(target)}
        </button>
      )}
    </div>
  );
}

/** One session in the day panel: a card for study, a single row for a review. */
function SessionItem({
  session: s,
  today,
  ctx,
  compact,
  editingMode,
  onPick,
  onDone,
  onCancel,
}: {
  session: SessionEntry;
  today: string;
  ctx: EditContext;
  compact: boolean;
  editingMode: EditMode | null;
  onPick: (mode: EditMode) => void;
  onDone: (notice: Notice) => void;
  onCancel: () => void;
}) {
  const colors = SUBJECT_COLOR[s.subjectCode] ?? DEFAULT_SUBJECT_COLOR;
  const state = sessionState(s, today);
  // Completed sessions are history. A missed one can go to a later day,
  // but swapping needs both sessions on today or later.
  const actions = state === "done" ? [] : state === "missed" ? EDIT_ACTIONS.filter((a) => a.mode !== "swap") : EDIT_ACTIONS;
  const href = withReturnTo(`/study/${s.id}`, "/schedule");
  const cta = state === "done" ? "Open again" : state === "missed" ? "Catch up" : s.kind === "REVIEW" ? "Start review" : "Start";
  const detail = [partLabel(s), (s.unitNames ?? []).join(", ") || s.topicName].filter(Boolean).join(" · ");
  const update = ctx.contentUpdates.get(s.id);

  return (
    <div>
      <div
        className={cn(
          "relative rounded-lg border border-border border-l-4 hover:bg-background hover:shadow-sm transition-all",
          colors.border,
          state === "done" && "opacity-60",
          editingMode && "ring-2 ring-primary/30"
        )}
      >
        {compact ? (
          <Link href={href} className={cn("group flex items-center gap-2.5 pl-3 py-2", actions.length ? "pr-10" : "pr-3")} title={cta}>
            <span className="flex-1 min-w-0">
              <span className={cn("block text-sm font-medium text-foreground truncate", state === "done" && "line-through")}>
                {s.subtopicName}
              </span>
              <span className="block text-[11px] text-muted-foreground truncate">
                {SUBJECT_LABEL[s.subjectCode] ?? s.subjectCode} · {s.topicName}
                {state === "missed" && <span className="font-semibold text-red-600"> · Missed</span>}
              </span>
            </span>
            {state === "done" && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" aria-label="Completed" />}
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">{fmtMins(s.durationMins)}</span>
            <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" aria-label={cta} />
          </Link>
        ) : (
          <Link href={href} className="group block pl-3 pr-3.5 py-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn("inline-block text-[11px] font-medium px-1.5 py-0.5 rounded-full", colors.badge)}>
                {SUBJECT_LABEL[s.subjectCode] ?? s.subjectCode}
              </span>
              {s.kind === "REVIEW" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700">
                  <RotateCcw className="w-3 h-3" /> Review
                </span>
              )}
              {state === "missed" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">
                  <AlertCircle className="w-3 h-3" /> Missed
                </span>
              )}
              {state === "done" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700">
                  <CheckCircle2 className="w-3 h-3" /> Done
                </span>
              )}
              <span className={cn("ml-auto text-xs text-muted-foreground", actions.length && "mr-7")}>{fmtMins(s.durationMins)}</span>
            </div>
            <p className={cn("mt-1 text-sm font-semibold text-foreground leading-snug", state === "done" && "line-through")}>
              {s.subtopicName}
            </p>
            <div className="flex items-end justify-between gap-3 mt-0.5">
              <p className="text-xs text-muted-foreground line-clamp-2 min-w-0">{detail}</p>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary group-hover:gap-1.5 transition-all">
                {cta} <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </Link>
        )}
        {actions.length > 0 && (
          <SessionMenu actions={actions} onPick={onPick} className={compact ? "top-1/2 -translate-y-1/2 right-2" : "top-2 right-2"} />
        )}
        {update && state !== "done" && <ContentUpdateNote session={s} update={update} ctx={ctx} onDone={onDone} />}
      </div>
      {editingMode && (
        <SessionEditor key={editingMode} mode={editingMode} session={s} ctx={ctx} onDone={onDone} onCancel={onCancel} />
      )}
    </div>
  );
}

// ─── DayDetails ──────────────────────────────────────────────────────────────

function DayDetails({
  date,
  today,
  examDate,
  sessions,
  ctx,
  onClose,
  onShowDay,
}: {
  date: string;
  today: string;
  examDate: string | null;
  sessions: SessionEntry[];
  ctx: EditContext;
  onClose: () => void;
  onShowDay: (date: string) => void;
}) {
  // One form open at a time: an action on a session, or adding one.
  const [editing, setEditing] = useState<{ id: string; mode: EditMode } | "add" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const finish = (n: Notice) => {
    setEditing(null);
    setNotice(n);
  };
  const totalMins = sessions.reduce((n, s) => n + s.durationMins, 0);
  const done = sessions.filter((s) => s.status === "COMPLETED").length;
  // Near the exam a day can hold many short reviews; they get their own,
  // one-line-per-session section so new content stays easy to find.
  // Reviews are listed subject by subject, so a long list reads in blocks.
  const bySubject = (a: SessionEntry, b: SessionEntry) =>
    SUBJECT_ORDER.indexOf(a.subjectCode) - SUBJECT_ORDER.indexOf(b.subjectCode) || a.order - b.order;
  const groups = (["STUDY", "REVIEW"] as const)
    .map((kind) => {
      const list = sessions.filter((s) => s.kind === kind);
      return { kind, list: kind === "REVIEW" ? list.sort(bySubject) : list };
    })
    .filter((g) => g.list.length > 0);
  const relative =
    date === today ? "Today" : date === addDaysStr(today, 1) ? "Tomorrow" : date === addDaysStr(today, -1) ? "Yesterday" : null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
        <div className="min-w-0">
          {relative && <p className="text-xs font-semibold text-primary">{relative}</p>}
          <h2 className="text-lg font-bold text-foreground">{fmtDay(date, "EEEE, MMM d")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sessions.length > 0
              ? `${sessions.length} session${sessions.length !== 1 ? "s" : ""} · ${fmtMins(totalMins)}${done ? ` · ${done} done` : ""}`
              : date === examDate
                ? "Exam day"
                : "No study planned"}
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 -mr-1 rounded-lg hover:bg-background transition-colors shrink-0" aria-label="Close">
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {notice && (
          <div role="status" className="rounded-lg bg-green-50 border border-green-200 px-3.5 py-2.5 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            <p className="flex-1 text-sm text-green-800">
              {notice.text}
              {notice.date && notice.date !== date && (
                <button onClick={() => onShowDay(notice.date!)} className="ml-1.5 font-semibold underline underline-offset-2">
                  Show that day
                </button>
              )}
            </p>
            <button onClick={() => setNotice(null)} aria-label="Dismiss" className="p-0.5 rounded hover:bg-green-100">
              <X className="w-3.5 h-3.5 text-green-700" />
            </button>
          </div>
        )}

        {date === examDate && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2.5">
            <Flag className="w-4 h-4 text-red-600 shrink-0" />
            <p className="text-sm font-semibold text-red-700">Your GED exam. Good luck!</p>
          </div>
        )}

        {sessions.length === 0 && date !== examDate && (
          <div className="text-center py-10">
            <CalendarDays className="w-8 h-8 text-muted-foreground/60 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">A free day — nothing to study.</p>
          </div>
        )}

        {groups.map(({ kind, list }) => (
          <section key={kind} className="space-y-2">
            {(groups.length > 1 || kind === "REVIEW") && (
              <div className="pt-1">
                <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {kind === "REVIEW" && <RotateCcw className="w-3 h-3 text-teal-600" />}
                  {kind === "REVIEW" ? "Review" : "Study"}
                  <span className="ml-auto normal-case tracking-normal font-medium tabular-nums">
                    {list.length} · {fmtMins(list.reduce((n, s) => n + s.durationMins, 0))}
                  </span>
                </h3>
                {kind === "REVIEW" && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">Short look-backs at topics you&apos;ve studied, before the exam.</p>
                )}
              </div>
            )}
            {list.map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                today={today}
                ctx={ctx}
                compact={kind === "REVIEW"}
                editingMode={editing !== null && editing !== "add" && editing.id === s.id ? editing.mode : null}
                onPick={(mode) => {
                  setNotice(null);
                  setEditing({ id: s.id, mode });
                }}
                onDone={finish}
                onCancel={() => setEditing(null)}
              />
            ))}
          </section>
        ))}

        {canPlanOn(ctx, date) &&
          (editing === "add" ? (
            <AddSessionForm ctx={ctx} date={date} onDone={finish} onCancel={() => setEditing(null)} />
          ) : (
            <button
              onClick={() => {
                setNotice(null);
                setEditing("add");
              }}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary-light/30 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add a session
            </button>
          ))}
      </div>
    </div>
  );
}

// ─── NoPlan ──────────────────────────────────────────────────────────────────
// The planner plans once, from the free time given at onboarding. A learner
// whose time didn't fit then has no plan; this is where they add time (their
// usual week, saved as the availability template) and make it. After the
// first plan, free time isn't asked for again: the schedule is theirs.

type FreeSlot = { start: string; end: string };
/** Monday first, as the calendar shows the week. dayOfWeek: 0 = Sunday. */
const WEEK = [1, 2, 3, 4, 5, 6, 0].map((dow, i) => ({ dow, label: WEEKDAY_LABELS[i] }));
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const toMins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const emptyWeek = (): Record<number, FreeSlot[]> => ({ 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] });

function weekToSlots(week: Record<number, FreeSlot[]>) {
  return Object.entries(week).flatMap(([dow, slots]) =>
    slots
      .filter((s) => toMins(s.end) > toMins(s.start))
      .map((s) => ({ dayOfWeek: Number(dow), startTime: s.start, endTime: s.end }))
  );
}

/** The fit check's answer, with the fields this card reads. */
type LiveFit = Feasibility & { canPlan?: boolean; requiredMinutes?: number; contentMinutes?: number };

function NoPlan({ onCreated }: { onCreated: () => void }) {
  const [week, setWeek] = useState<Record<number, FreeSlot[]> | null>(null);
  const [creating, setCreating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // The usual week saved at onboarding.
  useEffect(() => {
    fetch("/api/user/availability/template")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { template?: { slots: { dayOfWeek: number; startTime: string; endTime: string }[] } | null } | null) => {
        const w = emptyWeek();
        for (const s of d?.template?.slots ?? []) w[s.dayOfWeek].push({ start: s.startTime, end: s.endTime });
        setWeek(w);
      })
      .catch(() => setWeek(emptyWeek()));
  }, []);

  // Whether this week fits, checked as it's edited (nothing is saved). Keyed by
  // what was checked, so an answer for an older week is never shown.
  const request = week ? JSON.stringify({ template: weekToSlots(week) }) : null;
  const [fit, setFit] = useState<{ request: string; f: LiveFit | null } | null>(null);
  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      postJson<{ feasibility: LiveFit }>("/api/plans/feasibility", JSON.parse(request))
        .then((d) => !cancelled && setFit({ request, f: d.feasibility }))
        .catch(() => !cancelled && setFit({ request, f: null }));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [request]);
  const live = fit && fit.request === request ? fit.f : null;
  const weeklyMins = week ? weekToSlots(week).reduce((n, s) => n + toMins(s.endTime) - toMins(s.startTime), 0) : 0;

  const setDay = (dow: number, slots: FreeSlot[]) => week && setWeek({ ...week, [dow]: slots });

  const create = async () => {
    if (!week) return;
    setCreating(true);
    setProblem(null);
    try {
      await sendJson("PUT", "/api/user/availability/template", { slots: weekToSlots(week) });
      const res = await fetch("/api/csrf").then((r) => r.json()).catch(() => ({}));
      const token = (res as { csrfToken?: string }).csrfToken ?? "";
      const r = await fetch("/api/ga/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({ triggerReason: "INITIAL" }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok || r.status === 409) return onCreated();
      if (r.status === 422 && data.feasibility) setProblem(notEnoughTimeMessage(data.feasibility as Feasibility));
      else setProblem(data.error ?? "Couldn't make your plan. Please try again.");
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const fits = live?.canPlan === true;
  return (
    <div className="rounded-xl border border-border bg-card p-6 sm:p-8 max-w-2xl mx-auto">
      <div className="text-center">
        <BookOpen className="w-10 h-10 text-primary mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">You don&apos;t have a study plan yet</h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          We plan every day from today to your exam once, from your usual free time. After that the schedule is
          yours to change.
        </p>
      </div>

      <div className="mt-6">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Your usual free time</h3>
          <span className="text-xs text-muted-foreground tabular-nums">{fmtMins(weeklyMins)} a week</span>
        </div>
        {!week ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            {WEEK.map(({ dow, label }) => (
              <div key={dow} className="flex items-start gap-3 px-3 py-2.5">
                <span className="w-10 pt-1.5 text-sm font-medium text-foreground">{label}</span>
                <div className="flex-1 min-w-0 space-y-1.5">
                  {week[dow].length === 0 && <p className="pt-1.5 text-sm text-muted-foreground">Not free</p>}
                  {week[dow].map((slot, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-1.5">
                      {(["start", "end"] as const).map((k) => (
                        <select
                          key={k}
                          aria-label={`${label} ${k} time`}
                          value={slot[k]}
                          onChange={(e) =>
                            setDay(dow, week[dow].map((s, j) => (j === i ? { ...s, [k]: e.target.value } : s)))
                          }
                          className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          {TIMES.map((tm) => (
                            <option key={tm} value={tm}>
                              {tm}
                            </option>
                          ))}
                        </select>
                      ))}
                      <button
                        onClick={() => setDay(dow, week[dow].filter((_, j) => j !== i))}
                        aria-label={`Remove ${label} ${slot.start}–${slot.end}`}
                        className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      {toMins(slot.end) <= toMins(slot.start) && (
                        <span className="text-xs text-red-600">End after the start</span>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setDay(dow, [...week[dow], { start: "18:00", end: "20:00" }])}
                  className="shrink-0 inline-flex items-center gap-1 pt-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> Add time
                </button>
              </div>
            ))}
          </div>
        )}

        {/* The live check: whether this week covers the subjects before the exam. */}
        {week && (
          <div
            className={cn(
              "mt-3 rounded-lg border px-4 py-3 text-sm",
              !live
                ? "border-border bg-background text-muted-foreground"
                : fits
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
            )}
          >
            {!live
              ? "Checking whether this fits…"
              : fits
                ? `This fits: your subjects need about ${Math.ceil((live.requiredMinutes ?? 0) / 60)} h, and this week gives about ${Math.floor((live.contentMinutes ?? 0) / 60)} h before your exam.`
                : notEnoughTimeMessage(live)}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Can&apos;t add more time? Study fewer subjects for now, or move your exam date, in{" "}
          <Link href="/settings" className="font-semibold text-primary hover:underline">
            Settings
          </Link>
          .
        </p>
      </div>

      {problem && (
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-sm text-amber-800">{problem}</p>
        </div>
      )}

      <div className="mt-6 text-center">
        <button
          onClick={create}
          disabled={creating || !week || weeklyMins === 0}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60"
        >
          {creating && <Loader2 className="w-4 h-4 animate-spin" />}
          {creating ? "Making your plan…" : "Make my study plan"}
        </button>
        {creating && <p className="text-xs text-muted-foreground mt-2">This can take up to 20 seconds.</p>}
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [hasPlan, setHasPlan] = useState(false);
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [backlog, setBacklog] = useState<BacklogItem[]>([]);
  const [examDate, setExamDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Bangkok's date, so "today" and "missed" agree with the planner on the server.
  const [today] = useState(() => bangkokDateStr());
  // The open day. Null = no details shown; the calendar takes the full width.
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }));

  const calendarRef = useRef<HTMLDivElement>(null);
  // Two refs: the desktop panel and the phone sheet are both mounted while a
  // day is open (CSS shows one), and a click inside either must not close it.
  const asideRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const fetchPlan = useCallback(
    () =>
      Promise.all([
        fetch("/api/sessions").then((r) => r.json()),
        fetch("/api/user/preferences").then((r) => r.json()).catch(() => ({})),
        fetch("/api/plans/active").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/plans/backlog").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ])
        .then(([s, p, status, b]) => {
          setSessions(s.sessions ?? []);
          setHasPlan(Boolean(s.plan));
          setPlanStatus(status as PlanStatus | null);
          setBacklog((b as { backlog?: BacklogItem[] } | null)?.backlog ?? []);
          const exam = (p as { preferences?: { targetExamDate?: string } }).preferences?.targetExamDate;
          setExamDate(exam ? exam.slice(0, 10) : null);
        })
        .catch(() => {})
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    if (authLoading) return;
    fetchPlan();
  }, [authLoading, fetchPlan]);

  // Close the details with Esc, or with a click anywhere outside the calendar
  // and the details themselves.
  useEffect(() => {
    if (!selected) return;
    // An open menu or form takes Esc first and marks it handled. (React listens
    // on the document too, so stopPropagation can't keep it from here.)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && setSelected(null);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if ([calendarRef, asideRef, sheetRef].some((r) => r.current?.contains(t))) return;
      setSelected(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [selected]);

  const byDate = useMemo(() => {
    const m = new Map<string, SessionEntry[]>();
    for (const s of [...sessions].sort((a, b) => a.order - b.order)) {
      const list = m.get(s.scheduledDate) ?? [];
      list.push(s);
      m.set(s.scheduledDate, list);
    }
    return m;
  }, [sessions]);

  const contentUpdates = useMemo(() => planStatus?.contentUpdates ?? [], [planStatus]);

  const completed = sessions.filter((s) => s.status === "COMPLETED").length;
  const missed = sessions.filter((s) => sessionState(s, today) === "missed").length;
  const minsLeft = sessions.filter((s) => s.status !== "COMPLETED").reduce((n, s) => n + s.durationMins, 0);
  const daysToExam = examDate ? daysBetween(today, examDate) : null;

  const shiftMonth = (delta: number) =>
    setView(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  /** Opens a day; the same day again closes it. Jumps the calendar to that day's month. */
  const selectDay = (date: string, toggle = true) => {
    setSelected((cur) => (toggle && cur === date ? null : date));
    const y = Number(date.slice(0, 4));
    const m = Number(date.slice(5, 7)) - 1;
    if (y !== view.year || m !== view.month) setView({ year: y, month: m });
  };

  const resetPlan = async () => {
    await postJson("/api/plans/reset", {});
    setSelected(null);
    fetchPlan();
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

  const editContext: EditContext = {
    today,
    lastDay: examDate ? addDaysStr(examDate, -1) : null,
    byDate,
    backlog,
    contentUpdates: new Map(contentUpdates.map((u) => [u.sessionId, u])),
    refresh: fetchPlan,
  };

  const applyContentUpdates = async () => {
    // One at a time: each edit is rate-limited and renumbers the plan's parts.
    for (const u of contentUpdates) {
      await sendJson("PATCH", `/api/sessions/${u.sessionId}`, { durationMins: clampMinutes(u.contentMinutes) });
    }
    await fetchPlan();
  };

  // Keyed by day, so an open form or notice doesn't carry over to another day.
  const details = selected && (
    <DayDetails
      key={selected}
      date={selected}
      today={today}
      examDate={examDate}
      sessions={byDate.get(selected) ?? []}
      ctx={editContext}
      onClose={() => setSelected(null)}
      onShowDay={(d) => selectDay(d, false)}
    />
  );

  return (
    <MainLayout userName={user?.name}>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Study Schedule</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {examDate
              ? `Your plan to the exam on ${fmtDay(examDate, "MMMM d, yyyy")}`
              : "Your plan from today to your exam"}
          </p>
        </div>

        {!hasPlan ? (
          <NoPlan onCreated={fetchPlan} />
        ) : (
          <>
            {/* ── Plan summary ───────────────────────────────────────────── */}
            <motion.div
              className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
              initial="hidden"
              animate="visible"
              transition={{ staggerChildren: 0.06 }}
            >
              <StatCard
                icon={CheckCircle2}
                label="Sessions done"
                value={<><AnimatedNumber value={completed} /> / {sessions.length}</>}
                sub={sessions.length ? `${Math.round((completed / sessions.length) * 100)}% of your plan` : undefined}
                iconClass="text-green-500"
              />
              <StatCard
                icon={Clock}
                label="Study time left"
                value={fmtMins(minsLeft)}
                sub="Across all remaining sessions"
                iconClass="text-amber-500"
              />
              <StatCard
                icon={Flag}
                label="Days to exam"
                value={daysToExam !== null ? <AnimatedNumber value={Math.max(0, daysToExam)} /> : "—"}
                sub={examDate ? fmtDay(examDate, "MMM d, yyyy") : undefined}
                iconClass="text-red-500"
              />
              <StatCard
                icon={missed ? AlertCircle : Target}
                label="Missed sessions"
                value={<AnimatedNumber value={missed} />}
                sub={missed ? "Open one to catch up" : "You're on track"}
                iconClass={missed ? "text-red-500" : "text-primary"}
              />
            </motion.div>

            {planStatus && (
              <PlanStatusBar
                status={{ ...planStatus, contentUpdates }}
                onReset={resetPlan}
                onShowDay={(d) => selectDay(d, false)}
                onApplyContent={applyContentUpdates}
              />
            )}
            <BacklogNotice ctx={editContext} onAdded={(d) => selectDay(d, false)} />

            {/* ── Calendar + day details ─────────────────────────────────── */}
            <div className={cn("grid gap-6 items-start", selected && "lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]")}>
              <div ref={calendarRef}>
                <MonthCalendar
                  year={view.year}
                  month={view.month}
                  today={today}
                  examDate={examDate}
                  selected={selected}
                  byDate={byDate}
                  onSelect={(d) => selectDay(d)}
                  onPrev={() => shiftMonth(-1)}
                  onNext={() => shiftMonth(1)}
                  onToday={() => selectDay(today, false)}
                />
              </div>

              {/* Desktop: beside the calendar while a day is open. */}
              {selected && (
                <aside
                  ref={asideRef}
                  className="hidden lg:flex flex-col sticky top-6 rounded-xl border border-border bg-card overflow-hidden max-h-[calc(100vh-3rem)]"
                >
                  {details}
                </aside>
              )}
            </div>
          </>
        )}
      </div>

      {/* Phone/tablet: a sheet that slides up from the bottom. */}
      <AnimatePresence>
        {hasPlan && selected && (
          <div className="lg:hidden">
            <motion.div
              className="fixed inset-0 z-40 bg-black/30"
              onClick={() => setSelected(null)}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            />
            <motion.div
              ref={sheetRef}
              role="dialog"
              aria-label={fmtDay(selected, "EEEE, MMMM d")}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] flex flex-col rounded-t-2xl bg-card border-t border-border shadow-2xl overflow-hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
            >
              <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-border" aria-hidden="true" />
              {details}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MainLayout>
  );
}

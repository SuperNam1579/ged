// The study calendar from today to the exam: which days the learner studies,
// and for how many minutes.
//
// Pure: no Prisma. ./regenerate.ts loads the inputs.
//
// Every week follows the learner's usual pattern (WeeklyAvailabilityTemplate)
// unless they set that week on its own (a WeeklyAvailability row). A week set
// with no slots is a week off — the template does not fill it back in.
//
// Dates are "YYYY-MM-DD" strings throughout and day arithmetic is done in UTC,
// so the weekday of a date never depends on the server's time zone.

import type { AvailabilitySlotInput } from "../../types";

export interface CalendarDay {
  date: string;
  dayOfWeek: number;
  /** Monday of the week this date belongs to. */
  weekStartDate: string;
  /** Study minutes available that day; 0 = no study. */
  capacity: number;
}

export interface CalendarWeek {
  weekStartDate: string;
  /** "week" = the learner set this week on its own; "template" = their usual week. */
  source: "week" | "template";
  slots: AvailabilitySlotInput[];
  /** The days of this week inside the calendar — fewer than 7 for the first and last week. */
  days: CalendarDay[];
  totalMinutes: number;
}

export interface StudyCalendar {
  /** First day planned (today). */
  from: string;
  /** Exam day; the last day planned is the day before. */
  examDate: string;
  weeks: CalendarWeek[];
  /** Every day in the calendar, study day or not, in order. */
  days: CalendarDay[];
  totalMinutes: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDaysStr(date: string, n: number): string {
  return fromUtc(toUtc(date) + n * DAY_MS);
}

export function dayOfWeekOf(date: string): number {
  return new Date(toUtc(date)).getUTCDay();
}

/** Monday on or before `date`. */
export function mondayOf(date: string): string {
  const dow = dayOfWeekOf(date);
  return addDaysStr(date, dow === 0 ? -6 : 1 - dow);
}

/** The learners' time zone. The server runs in UTC, 7 hours behind. */
export const STUDY_TIME_ZONE = "Asia/Bangkok";

const bangkokFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: STUDY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * The date in Bangkok — what "today" means to a learner. On the server's own
 * clock, 00:00–07:00 in Bangkok is still yesterday.
 */
export function bangkokDateStr(d: Date = new Date()): string {
  return bangkokFormat.format(d); // en-CA formats as YYYY-MM-DD
}

function slotMinutes(s: AvailabilitySlotInput): number {
  const [sh, sm] = s.startTime.split(":").map(Number);
  const [eh, em] = s.endTime.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

/**
 * Lays the learner's availability over every day from `from` up to, but not
 * including, `examDate`.
 *
 * @param weekOverrides slots of the weeks set on their own, keyed by Monday.
 */
export function buildStudyCalendar(input: {
  from: string;
  examDate: string;
  template: AvailabilitySlotInput[];
  weekOverrides: Map<string, AvailabilitySlotInput[]>;
}): StudyCalendar {
  const { from, examDate, template, weekOverrides } = input;
  const weeks: CalendarWeek[] = [];
  const days: CalendarDay[] = [];

  for (let date = from; date < examDate; date = addDaysStr(date, 1)) {
    const weekStartDate = mondayOf(date);
    let week = weeks[weeks.length - 1];
    if (!week || week.weekStartDate !== weekStartDate) {
      const override = weekOverrides.get(weekStartDate);
      week = {
        weekStartDate,
        source: override ? "week" : "template",
        slots: override ?? template,
        days: [],
        totalMinutes: 0,
      };
      weeks.push(week);
    }

    const dayOfWeek = dayOfWeekOf(date);
    const capacity = week.slots.filter((s) => s.dayOfWeek === dayOfWeek).reduce((a, s) => a + slotMinutes(s), 0);
    const day = { date, dayOfWeek, weekStartDate, capacity };
    week.days.push(day);
    week.totalMinutes += capacity;
    days.push(day);
  }

  return {
    from,
    examDate,
    weeks,
    days,
    totalMinutes: weeks.reduce((a, w) => a + w.totalMinutes, 0),
  };
}

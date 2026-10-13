import { DEFAULT_CONFIG } from "@/lib/ga/constants";
import { WEIGHTS } from "@/lib/ga/fitness";

/** Real engine figures — never retype these, so the page can't drift. */
export const POP = DEFAULT_CONFIG.populationSize;
export const GENS = DEFAULT_CONFIG.generations;

export const INK = "#0f2748";
export const MUTED = "#5b769a";
export const LINE = "#d8e6f7";
export const BLUE = "#1e90e8";

/**
 * The six scoring goals in plain language, each with the reason its weight is
 * set where it is.
 *
 * `key` indexes WEIGHTS, so the percentages come from the fitness function
 * itself rather than being retyped alongside it.
 */
export const GOALS = [
  {
    key: "coverage",
    name: "Covers your weak spots",
    hint: "Anything under 60 out of 100",
    why: "Weighted highest because a plan that skips a whole topic can't be fixed by doing the others well.",
  },
  {
    key: "weaknessFocus",
    name: "Most time where you're weakest",
    hint: "The lower the score, the more time",
    why: "Exam time is finite, so hours are worth more spent on a topic you're failing than one you've already passed.",
  },
  {
    key: "timeFeasibility",
    name: "Fits your free hours",
    hint: "Never books a day you're busy",
    why: "A session booked when you're at work is a session that doesn't happen — an unrealistic plan scores nothing in practice.",
  },
  {
    key: "prerequisiteOrder",
    name: "Basics before the hard stuff",
    hint: "Expressions before quadratics",
    why: "Studying a topic before its groundwork wastes the session, so order carries the same weight as fitting your calendar.",
  },
  {
    key: "variety",
    name: "Rotates your subjects",
    hint: "Not one subject all week",
    why: "Mixing subjects across a week is harder in the moment but retains better than blocking one subject solid.",
  },
  {
    key: "balance",
    name: "Spreads the hard days out",
    hint: "No two heavy days in a row",
    why: "Lowest weight — it protects against burnout, but it matters less than studying the right things in the right order.",
  },
] as const;

export const TOP_WEIGHT = Math.max(...GOALS.map((g) => WEIGHTS[g.key]));

export type GoalKey = (typeof GOALS)[number]["key"];

/** Subject colours, matching the palette used across the public pages. */
export const SUBJECT_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  MATH: { bg: "#e4edfd", fg: "#1e5fc4", label: "Math" },
  RLA: { bg: "#e3f6ec", fg: "#127a45", label: "RLA" },
  SCI: { bg: "#efe6fb", fg: "#6429c0", label: "Science" },
  SS: { bg: "#fdf1e3", fg: "#a8620a", label: "Social" },
};

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Days this example learner said they aren't free. */
export const BUSY_DAYS = new Set(["Wed", "Sat"]);

export type Session = { subject: keyof typeof SUBJECT_COLORS; lesson: string };
export type Week = Record<string, Session[]>;

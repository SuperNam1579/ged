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
    why: "Weighted highest because a plan that skips a whole lesson can't be fixed by doing the others well.",
  },
  {
    key: "weaknessFocus",
    name: "Most time where you're weakest",
    hint: "The lower the score, the more time",
    why: "Exam time is finite, so hours are worth more spent on a lesson you're failing than one you've already passed.",
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
    why: "Studying a lesson before its groundwork wastes the session, so order carries the same weight as fitting your calendar.",
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

/** What a hand-written plan tends to score — the line the algorithm has to beat. */
export const HAND_MADE_SCORE = 45;

export type Session = { subject: keyof typeof SUBJECT_COLORS; lesson: string };
export type Week = Record<string, Session[]>;

/**
 * Six snapshots of one run, from a random first draft to the winner.
 *
 * These are an illustration of the shape of a run, not measured output — the
 * score dips at stage 2 because a real population does lose ground when a
 * promising combination turns out worse than its parents. Anything presented as
 * a measured result would have to come from the engine itself.
 */
export const STAGES: {
  gen: number;
  score: number;
  goals: Record<GoalKey, number>;
  week: Week;
  note: string;
}[] = [
  {
    gen: 1,
    score: 41,
    goals: { coverage: 0.35, weaknessFocus: 0.2, timeFeasibility: 0.15, prerequisiteOrder: 0.3, variety: 0.2, balance: 0.25 },
    note: "A random first draft. Three Math sessions stacked on Monday, two more booked on days this learner said they're busy, and half the week empty.",
    week: {
      Mon: [
        { subject: "MATH", lesson: "Quadratics" },
        { subject: "MATH", lesson: "Expressions" },
        { subject: "MATH", lesson: "Geometry" },
      ],
      Tue: [],
      Wed: [{ subject: "SCI", lesson: "Genetics" }],
      Thu: [],
      Fri: [{ subject: "RLA", lesson: "Main idea" }],
      Sat: [{ subject: "MATH", lesson: "Ratios" }],
      Sun: [],
    },
  },
  {
    gen: 12,
    score: 55,
    goals: { coverage: 0.5, weaknessFocus: 0.4, timeFeasibility: 0.45, prerequisiteOrder: 0.35, variety: 0.35, balance: 0.4 },
    note: "The busy Saturday has cleared and a fourth subject has appeared, but Monday is still overloaded.",
    week: {
      Mon: [
        { subject: "MATH", lesson: "Quadratics" },
        { subject: "MATH", lesson: "Expressions" },
      ],
      Tue: [{ subject: "RLA", lesson: "Main idea" }],
      Wed: [{ subject: "SCI", lesson: "Genetics" }],
      Thu: [{ subject: "SS", lesson: "US civics" }],
      Fri: [{ subject: "MATH", lesson: "Geometry" }],
      Sat: [],
      Sun: [],
    },
  },
  {
    gen: 24,
    score: 54,
    goals: { coverage: 0.55, weaknessFocus: 0.38, timeFeasibility: 0.5, prerequisiteOrder: 0.3, variety: 0.45, balance: 0.42 },
    note: "A step backwards. This draft spread the week out but pushed Quadratics ahead of Expressions, and lost more on ordering than it gained on spacing.",
    week: {
      Mon: [{ subject: "MATH", lesson: "Quadratics" }],
      Tue: [{ subject: "RLA", lesson: "Main idea" }],
      Wed: [],
      Thu: [
        { subject: "MATH", lesson: "Expressions" },
        { subject: "SS", lesson: "US civics" },
      ],
      Fri: [{ subject: "SCI", lesson: "Genetics" }],
      Sat: [],
      Sun: [{ subject: "MATH", lesson: "Geometry" }],
    },
  },
  {
    gen: 45,
    score: 68,
    goals: { coverage: 0.7, weaknessFocus: 0.6, timeFeasibility: 0.75, prerequisiteOrder: 0.65, variety: 0.6, balance: 0.55 },
    note: "Expressions has moved back in front of Quadratics, and nothing is booked on a busy day any more.",
    week: {
      Mon: [{ subject: "MATH", lesson: "Expressions" }],
      Tue: [
        { subject: "RLA", lesson: "Main idea" },
        { subject: "SCI", lesson: "Genetics" },
      ],
      Wed: [],
      Thu: [{ subject: "MATH", lesson: "Quadratics" }],
      Fri: [{ subject: "SS", lesson: "US civics" }],
      Sat: [],
      Sun: [{ subject: "MATH", lesson: "Geometry" }],
    },
  },
  {
    gen: 72,
    score: 76,
    goals: { coverage: 0.82, weaknessFocus: 0.75, timeFeasibility: 0.9, prerequisiteOrder: 0.8, variety: 0.7, balance: 0.68 },
    note: "Math — this learner's weakest subject — now gets the most sessions, and no two heavy days sit back to back.",
    week: {
      Mon: [
        { subject: "MATH", lesson: "Expressions" },
        { subject: "RLA", lesson: "Main idea" },
      ],
      Tue: [{ subject: "SCI", lesson: "Genetics" }],
      Wed: [],
      Thu: [
        { subject: "MATH", lesson: "Quadratics" },
        { subject: "SS", lesson: "US civics" },
      ],
      Fri: [{ subject: "MATH", lesson: "Ratios" }],
      Sat: [],
      Sun: [{ subject: "MATH", lesson: "Geometry" }],
    },
  },
  {
    gen: GENS,
    score: 83,
    goals: { coverage: 0.92, weaknessFocus: 0.88, timeFeasibility: 1, prerequisiteOrder: 0.9, variety: 0.82, balance: 0.78 },
    note: "The winner. Every lesson covered, the weakest subject given the most time, the basics first, subjects rotating, and not one session on a day this learner isn't free.",
    week: {
      Mon: [
        { subject: "MATH", lesson: "Expressions" },
        { subject: "RLA", lesson: "Main idea" },
      ],
      Tue: [
        { subject: "SCI", lesson: "Genetics" },
        { subject: "MATH", lesson: "Ratios" },
      ],
      Wed: [],
      Thu: [
        { subject: "MATH", lesson: "Quadratics" },
        { subject: "SS", lesson: "US civics" },
      ],
      Fri: [
        { subject: "RLA", lesson: "Evidence" },
        { subject: "SCI", lesson: "Energy" },
      ],
      Sat: [],
      Sun: [{ subject: "MATH", lesson: "Geometry" }],
    },
  },
];

/** The hand-written plan from section 5 — the thing the run is measured against. */
export const HAND_MADE_WEEK: Week = {
  Mon: [
    { subject: "MATH", lesson: "Quadratics" },
    { subject: "MATH", lesson: "Geometry" },
  ],
  Tue: [{ subject: "MATH", lesson: "Ratios" }],
  Wed: [{ subject: "MATH", lesson: "Expressions" }],
  Thu: [],
  Fri: [{ subject: "RLA", lesson: "Main idea" }],
  Sat: [{ subject: "SCI", lesson: "Genetics" }],
  Sun: [],
};

export const FINAL_STAGE = STAGES[STAGES.length - 1];

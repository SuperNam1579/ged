import type { ReactNode } from "react";
import { subjectOrder } from "@/lib/subject-order";
import { GENERATED_CURRICULUM } from "./curriculum.generated";

/**
 * The GED curriculum as presented on the marketing pages.
 *
 * Subjects built from the curriculum sheets (MATH, SS, SCI) take their tree from
 * curriculum.generated.ts, which scripts/import-curriculum.ts writes from the
 * same data the product teaches from — so these pages can't drift from it the
 * way the hand-written copy did. RLA has no sheet yet and keeps its hand-written
 * block below until it does.
 *
 * Everything countable is derived from this list rather than written by hand.
 */
/** The smallest unit — one studiable lesson. */
export interface LandingSubtopic {
  name: string;
  description: string;
  /** Estimated study time, in minutes. */
  minutes: number;
  /** Difficulty, 1 (easiest) to 4 (hardest). */
  level: number;
  /** Clips and Khan articles in the lesson. Absent for subjects without a sheet. */
  videos?: number;
  articles?: number;
}

/** A topic within a category. */
export interface LandingTopic {
  name: string;
  subtopics: LandingSubtopic[];
}

/** An exam category — the weights are the real GED exam weightings. */
export interface LandingCategory {
  name: string;
  /** Share of the exam, as a percentage. Weights within a subject total 100. */
  weight: number;
  topics: LandingTopic[];
}

export interface LandingSubject {
  /** Stable key, also used for the dropdown's anchor. */
  slug: string;
  /** Matches Subject.code in the database (MATH | RLA | SCI | SS). */
  code: string;
  name: string;
  /** Short name for tight spaces like the navbar dropdown. */
  shortName: string;
  desc: string;
  /** Accent colour — bar, topic label, icon stroke. */
  color: string;
  /** Tinted background behind the icon. */
  iconBg: string;
  icon: ReactNode;
  categories: LandingCategory[];
}

export const LANDING_SUBJECTS: LandingSubject[] = [
  {
    slug: "math",
    code: "MATH",
    name: "Mathematical Reasoning",
    shortName: "Math Reasoning",
    desc: "Algebra, geometry, statistics, data analysis",
    color: "#1e90e8",
    iconBg: "#d8ecfd",
    icon: (
      <span style={{ color: "#1e90e8", fontWeight: 700, fontSize: 20, fontFamily: "var(--font-feather)" }}>
        ∑
      </span>
    ),
    // From the curriculum sheets — see curriculum.generated.ts.
    categories: GENERATED_CURRICULUM.MATH,
  },
  {
    slug: "rla",
    code: "RLA",
    name: "Reasoning Through Language Arts",
    shortName: "Language Arts",
    desc: "Reading, writing, grammar, argument analysis",
    color: "#16A34A",
    iconBg: "#F0FDF4",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    categories: [
      {
        name: "Reading for Meaning",
        weight: 45,
        topics: [
          {
            name: "Informational Text",
            subtopics: [
              {
                name: "Main Idea & Supporting Details",
                description: "Identify the central idea and how details support it in informational texts.",
                minutes: 40,
                level: 2,
              },
              {
                name: "Author's Purpose & Point of View",
                description: "Determine the author's purpose and analyze bias in non-fiction texts.",
                minutes: 45,
                level: 3,
              },
              {
                name: "Text Structure & Features",
                description: "Analyze how authors use text structure (cause-effect, compare-contrast) to convey meaning.",
                minutes: 40,
                level: 2,
              },
              {
                name: "Argument Analysis",
                description: "Evaluate claims, evidence, and reasoning in argumentative texts.",
                minutes: 50,
                level: 4,
              },
            ],
          },
          {
            name: "Literary Text",
            subtopics: [
              {
                name: "Reading Fiction",
                description: "Analyze plot, character, setting, and theme in literary texts.",
                minutes: 45,
                level: 2,
              },
              {
                name: "Figurative Language & Tone",
                description: "Identify and interpret figurative language, mood, and tone in literature.",
                minutes: 45,
                level: 3,
              },
              {
                name: "Comparing Texts",
                description: "Compare themes, arguments, and structures across multiple texts.",
                minutes: 50,
                level: 4,
              },
            ],
          },
        ],
      },
      {
        name: "Extended Writing",
        weight: 35,
        topics: [
          {
            name: "Argument & Evidence Writing",
            subtopics: [
              {
                name: "Writing an Argument Essay",
                description: "Structure and write a persuasive extended response using evidence.",
                minutes: 90,
                level: 4,
              },
              {
                name: "Using Evidence & Citations",
                description: "Integrate and cite textual evidence effectively in written responses.",
                minutes: 60,
                level: 3,
              },
            ],
          },
        ],
      },
      {
        name: "Language & Grammar",
        weight: 20,
        topics: [
          {
            name: "Grammar & Usage",
            subtopics: [
              {
                name: "Sentence Structure",
                description: "Identify and correct run-ons, fragments, and complex sentence structures.",
                minutes: 45,
                level: 2,
              },
              {
                name: "Punctuation & Capitalization",
                description: "Apply correct punctuation (commas, semicolons, apostrophes) and capitalization rules.",
                minutes: 40,
                level: 2,
              },
              {
                name: "Vocabulary in Context",
                description: "Use context clues and word parts to determine the meaning of unfamiliar words.",
                minutes: 35,
                level: 2,
              },
              {
                name: "Subject-Verb Agreement",
                description: "Apply subject-verb and pronoun-antecedent agreement rules.",
                minutes: 40,
                level: 2,
              },
              {
                name: "Verb Tense & Modifiers",
                description: "Use consistent verb tenses and correctly place modifiers in sentences.",
                minutes: 40,
                level: 3,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "science",
    code: "SCI",
    name: "Science",
    shortName: "Science",
    desc: "Life science, physical science, earth and space science",
    color: "#7C3AED",
    iconBg: "#F5F3FF",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="3" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
      </svg>
    ),
    // From the curriculum sheets — see curriculum.generated.ts.
    categories: GENERATED_CURRICULUM.SCI,
  },
  {
    slug: "social",
    code: "SS",
    name: "Social Studies",
    shortName: "Social Studies",
    desc: "US civics, American history, economics, geography",
    color: "#D97706",
    iconBg: "#FFFBEB",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    // From the curriculum sheets — see curriculum.generated.ts.
    categories: GENERATED_CURRICULUM.SS,
  },
];

/** Every subtopic in a subject, flattened. Internal helper. */
function allSubtopics(subject: LandingSubject): LandingSubtopic[] {
  return subject.categories.flatMap((c) => c.topics.flatMap((t) => t.subtopics));
}

/** Subtopics in one subject — what the pages call that subject's "topics". */
export function subtopicCount(subject: LandingSubject): number {
  return allSubtopics(subject).length;
}

/** Topics (the mid level) in one subject. */
export function topicCount(subject: LandingSubject): number {
  return subject.categories.reduce((sum, c) => sum + c.topics.length, 0);
}

/**
 * Study time for display: "45 min", "3 h", "7 h 10 min". Sheet-built lessons run
 * from minutes to several hours, and "430 min" is harder to read than "7 h 10 min".
 */
export function formatStudyTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * A real lesson that fits in one sitting, for mock-ups of a single study
 * session. The first lessons of a sheet-built subject can run for hours (MATH
 * opens with Fractions, 7 h), which no one session shows.
 */
export function sampleLesson(subject: LandingSubject, maxMinutes = 60): LandingSubtopic {
  const all = allSubtopics(subject);
  return all.find((s) => s.minutes <= maxMinutes) ?? all[0];
}

export function findSubject(slug: string): LandingSubject | undefined {
  return LANDING_SUBJECTS.find((s) => s.slug === slug);
}

/**
 * Position of a subject in the canonical order, by database code.
 *
 * Delegates to `@/lib/subject-order` so the in-app screens and the server
 * routes sort by the same list. Previously this derived the order from
 * `LANDING_SUBJECTS` itself, which made the marketing page's display order and
 * the app's ordering the same thing by coincidence rather than by intent —
 * reordering the array below to change how the landing page reads would have
 * silently reordered the pre-assessment's sections too.
 */
export function subjectOrderByCode(code: string): number {
  return subjectOrder(code);
}

/** Lesson count for a subject by its database code — for the in-app screens. */
export function lessonCountByCode(code: string): number {
  const subject = LANDING_SUBJECTS.find((s) => s.code === code);
  return subject ? subtopicCount(subject) : 0;
}

/** Totals quoted across the marketing pages, all derived from the list above. */
export const TOTAL_TOPICS = LANDING_SUBJECTS.reduce((sum, s) => sum + subtopicCount(s), 0);
export const TOTAL_MID_TOPICS = LANDING_SUBJECTS.reduce((sum, s) => sum + topicCount(s), 0);

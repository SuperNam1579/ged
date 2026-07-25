import type { ReactNode } from "react";

/**
 * The GED curriculum as presented on the marketing pages.
 *
 * Mirrors the hierarchy in `prisma/seed.ts` — subject → category → topic →
 * subtopic — and the figures here were extracted from it, so the public pages
 * quote the same 12 categories, 18 topics and 57 subtopics the product teaches.
 * Everything countable is derived from this list rather than written by hand;
 * the per-subject numbers previously hardcoded on the landing page had drifted
 * from the seed (14/18/15/10 against an actual 15/14/14/14).
 *
 * This stays presentation data, not a runtime source of truth. Onboarding,
 * mock-test and the seed each still carry their own subject lists; unifying all
 * of those is a separate job.
 */

/** The smallest unit — one studiable lesson. */
export interface LandingSubtopic {
  name: string;
  description: string;
  /** Estimated study time, in minutes. */
  minutes: number;
  /** Difficulty, 1 (easiest) to 4 (hardest). */
  level: number;
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
    categories: [
      {
        name: "Quantitative Problem Solving",
        weight: 45,
        topics: [
          {
            name: "Number Sense",
            subtopics: [
              {
                name: "Integer Operations",
                description: "Add, subtract, multiply, and divide integers including negative numbers.",
                minutes: 45,
                level: 1,
              },
              {
                name: "Fractions, Decimals & Percents",
                description: "Convert and compute with fractions, decimals, and percentages.",
                minutes: 60,
                level: 2,
              },
              {
                name: "Ratios & Rates",
                description: "Understand and apply ratios, unit rates, and proportional reasoning.",
                minutes: 50,
                level: 2,
              },
              {
                name: "Percent Problems",
                description: "Solve percent change, percent of a number, and real-world percent applications.",
                minutes: 45,
                level: 2,
              },
            ],
          },
          {
            name: "Data and Statistics",
            subtopics: [
              {
                name: "Data Analysis & Central Tendency",
                description: "Calculate mean, median, mode, and interpret data displays.",
                minutes: 55,
                level: 2,
              },
              {
                name: "Probability",
                description: "Compute and interpret basic and compound probability.",
                minutes: 55,
                level: 3,
              },
            ],
          },
          {
            name: "Geometric Measurement",
            subtopics: [
              {
                name: "Area, Perimeter & Volume",
                description: "Calculate area, perimeter, surface area, and volume of 2D and 3D figures.",
                minutes: 70,
                level: 2,
              },
              {
                name: "Pythagorean Theorem",
                description: "Apply the Pythagorean theorem and distance formula.",
                minutes: 50,
                level: 3,
              },
              {
                name: "Coordinate Geometry",
                description: "Work with the coordinate plane, midpoints, and transformations.",
                minutes: 55,
                level: 3,
              },
            ],
          },
        ],
      },
      {
        name: "Algebraic Reasoning",
        weight: 55,
        topics: [
          {
            name: "Expressions and Polynomials",
            subtopics: [
              {
                name: "Algebraic Expressions",
                description: "Write, simplify, and evaluate algebraic expressions.",
                minutes: 55,
                level: 2,
              },
              {
                name: "Polynomial Operations",
                description: "Add, subtract, multiply, and factor polynomials.",
                minutes: 70,
                level: 3,
              },
            ],
          },
          {
            name: "Equations and Inequalities",
            subtopics: [
              {
                name: "Linear Equations",
                description: "Solve one-variable and two-variable linear equations.",
                minutes: 60,
                level: 2,
              },
              {
                name: "Inequalities & Systems",
                description: "Solve linear inequalities and systems of equations.",
                minutes: 65,
                level: 3,
              },
            ],
          },
          {
            name: "Graphs and Functions",
            subtopics: [
              {
                name: "Slope & Linear Graphs",
                description: "Calculate slope, interpret graphs, and write linear equations.",
                minutes: 60,
                level: 2,
              },
              {
                name: "Quadratic Functions",
                description: "Graph, solve, and interpret quadratic equations and parabolas.",
                minutes: 75,
                level: 4,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "rla",
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
    categories: [
      {
        name: "Life Science",
        weight: 40,
        topics: [
          {
            name: "Biology & Ecology",
            subtopics: [
              {
                name: "Cell Biology",
                description: "Identify cell structures and explain cellular processes including mitosis.",
                minutes: 60,
                level: 3,
              },
              {
                name: "Genetics & Heredity",
                description: "Explain DNA structure, inheritance, and how traits are passed to offspring.",
                minutes: 65,
                level: 4,
              },
              {
                name: "Evolution & Natural Selection",
                description: "Understand the mechanisms of evolution and how species adapt over time.",
                minutes: 55,
                level: 3,
              },
              {
                name: "Ecosystems & Energy Flow",
                description: "Describe food webs, energy pyramids, and nutrient cycles in ecosystems.",
                minutes: 55,
                level: 3,
              },
              {
                name: "Human Body Systems",
                description: "Explain the major human body systems and how they interact.",
                minutes: 70,
                level: 3,
              },
            ],
          },
        ],
      },
      {
        name: "Physical Science",
        weight: 40,
        topics: [
          {
            name: "Chemistry",
            subtopics: [
              {
                name: "Atomic Structure & Periodic Table",
                description: "Describe atomic structure and trends in the periodic table.",
                minutes: 60,
                level: 3,
              },
              {
                name: "Chemical Reactions & Bonding",
                description: "Identify types of chemical reactions and explain chemical bonding.",
                minutes: 65,
                level: 4,
              },
              {
                name: "States of Matter & Solutions",
                description: "Explain properties of solids, liquids, gases, and solutions.",
                minutes: 55,
                level: 3,
              },
            ],
          },
          {
            name: "Physics",
            subtopics: [
              {
                name: "Motion & Forces",
                description: "Apply Newton's laws of motion and analyze forces in everyday situations.",
                minutes: 60,
                level: 3,
              },
              {
                name: "Energy & Work",
                description: "Distinguish kinetic and potential energy and apply the law of conservation of energy.",
                minutes: 55,
                level: 3,
              },
              {
                name: "Waves, Light & Sound",
                description: "Describe wave properties, the electromagnetic spectrum, and sound.",
                minutes: 55,
                level: 3,
              },
            ],
          },
        ],
      },
      {
        name: "Earth & Space Science",
        weight: 20,
        topics: [
          {
            name: "Earth & Space",
            subtopics: [
              {
                name: "Earth's Structure & Plate Tectonics",
                description: "Describe Earth's layers and explain plate tectonic theory and its effects.",
                minutes: 55,
                level: 2,
              },
              {
                name: "Weather, Climate & Atmosphere",
                description: "Explain weather patterns, climate change, and atmospheric science.",
                minutes: 50,
                level: 2,
              },
              {
                name: "Astronomy & the Universe",
                description: "Describe the solar system, stars, and the scale and origin of the universe.",
                minutes: 50,
                level: 2,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "social",
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
    categories: [
      {
        name: "Civics & Government",
        weight: 50,
        topics: [
          {
            name: "Government & Citizenship",
            subtopics: [
              {
                name: "US Constitution & Bill of Rights",
                description: "Understand the structure of the US Constitution and the rights it guarantees.",
                minutes: 60,
                level: 3,
              },
              {
                name: "Branches of Government",
                description: "Describe the powers and functions of the legislative, executive, and judicial branches.",
                minutes: 55,
                level: 2,
              },
              {
                name: "Elections & Political Participation",
                description: "Explain the electoral process, voting rights, and civic responsibility.",
                minutes: 45,
                level: 2,
              },
              {
                name: "Civil Rights & Liberties",
                description: "Trace the civil rights movement and key legislation protecting individual rights.",
                minutes: 55,
                level: 3,
              },
            ],
          },
        ],
      },
      {
        name: "United States History",
        weight: 20,
        topics: [
          {
            name: "American History",
            subtopics: [
              {
                name: "American Revolution & Founding",
                description: "Analyze causes and outcomes of the American Revolution and the founding documents.",
                minutes: 60,
                level: 3,
              },
              {
                name: "Civil War & Reconstruction",
                description: "Examine causes, key events, and aftermath of the Civil War and Reconstruction era.",
                minutes: 60,
                level: 3,
              },
              {
                name: "World Wars & Modern America",
                description: "Evaluate America's role in WWI, WWII, and the Cold War era.",
                minutes: 65,
                level: 3,
              },
              {
                name: "Social Movements of the 20th Century",
                description: "Analyse the civil rights, women's rights, and labor movements.",
                minutes: 50,
                level: 3,
              },
            ],
          },
        ],
      },
      {
        name: "Economics",
        weight: 15,
        topics: [
          {
            name: "Economic Principles",
            subtopics: [
              {
                name: "Supply, Demand & Markets",
                description: "Apply supply and demand principles to real-world economic scenarios.",
                minutes: 55,
                level: 3,
              },
              {
                name: "Personal Finance",
                description: "Understand budgeting, credit, taxes, and basic personal financial planning.",
                minutes: 50,
                level: 2,
              },
              {
                name: "Macro & Microeconomics",
                description: "Distinguish macro and microeconomic concepts including GDP, inflation, and competition.",
                minutes: 60,
                level: 4,
              },
            ],
          },
        ],
      },
      {
        name: "Geography & the World",
        weight: 15,
        topics: [
          {
            name: "World Geography & Cultures",
            subtopics: [
              {
                name: "Map Skills & Geographic Tools",
                description: "Read and interpret maps, charts, and geographic data.",
                minutes: 40,
                level: 1,
              },
              {
                name: "Human Geography & Migration",
                description: "Examine how geography shapes human societies, culture, and migration patterns.",
                minutes: 50,
                level: 2,
              },
              {
                name: "Global Interdependence",
                description: "Analyze trade, environmental, and political connections between nations.",
                minutes: 45,
                level: 3,
              },
            ],
          },
        ],
      },
    ],
  },
];

/** Every subtopic in a subject, flattened. */
export function allSubtopics(subject: LandingSubject): LandingSubtopic[] {
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

/** Estimated study time for a whole subject, in minutes. */
export function studyMinutes(subject: LandingSubject): number {
  return allSubtopics(subject).reduce((sum, st) => sum + st.minutes, 0);
}

/** Round minutes to a friendly "12h" / "45m" label. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return `${hours % 1 === 0 ? hours : hours.toFixed(1)}h`;
}

export function findSubject(slug: string): LandingSubject | undefined {
  return LANDING_SUBJECTS.find((s) => s.slug === slug);
}

/** Totals quoted across the marketing pages, all derived from the list above. */
export const TOTAL_TOPICS = LANDING_SUBJECTS.reduce((sum, s) => sum + subtopicCount(s), 0);
export const TOTAL_MID_TOPICS = LANDING_SUBJECTS.reduce((sum, s) => sum + topicCount(s), 0);
export const TOTAL_CATEGORIES = LANDING_SUBJECTS.reduce((sum, s) => sum + s.categories.length, 0);
export const TOTAL_STUDY_MINUTES = LANDING_SUBJECTS.reduce((sum, s) => sum + studyMinutes(s), 0);

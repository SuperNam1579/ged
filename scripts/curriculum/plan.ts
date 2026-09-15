/**
 * Editorial layer between the raw curriculum CSVs and the database.
 *
 * The CSVs in `curriculum/` are a flat list of Khan clips with a subtopic name
 * attached. They carry no category, no weight, no scope sentence and no
 * difficulty — those are judgement calls, and judgement calls belong in a file
 * a person can read and argue with, not in a heuristic.
 *
 * So this file answers, per subject:
 *
 *   1. Which category and topic each CSV subtopic hangs under, and what the
 *      categories weigh against each other in the real exam.
 *   2. What the subtopic actually covers — the `description` sentence, which is
 *      the authority on scope everywhere else in this codebase.
 *   3. Which clips, if any, do not belong.
 *
 * On point 3: nothing is cut from MATH today. A Khan unit is built for a school
 * year rather than for the GED, so some units do run past the test's edge —
 * the descriptive-statistics unit into population variance, the bivariate-data
 * unit into least-squares proofs — but the whole unit is kept anyway, because a
 * learner who wants the full lesson sequence should get it. Where those edges
 * are is written down in BEYOND_GED_SCOPE at the bottom of this file.
 *
 * The machinery for cutting is still here and still enforced: dropLessons,
 * dropClips and keepClips work, and a rule that matches no row fails the import
 * rather than silently doing nothing.
 */

export interface SubtopicPlan {
  /** Value in the CSV's "Subtopic (GED)" column. */
  csv: string;
  /** Display name. Defaults to `csv`. */
  name?: string;
  /** Extra CSV subtopics folded into this one. */
  merge?: string[];
  /** One sentence defining scope. The authority everywhere downstream. */
  description: string;
  /** 1–5, matching Subtopic.difficultyLevel. */
  difficulty: number;
  /** Khan lessons dropped whole, by "หัวข้อหลัก (Lesson)" value. */
  dropLessons?: string[];
  /** Individual clips dropped, by "หัวข้อย่อย (Clip)" value. */
  dropClips?: string[];
  /** Clips kept even though their lesson is in `dropLessons`. */
  keepClips?: string[];
}

export interface TopicPlan {
  name: string;
  subtopics: SubtopicPlan[];
}

export interface CategoryPlan {
  name: string;
  /** Percentage weight in the subject exam. Must total 100 per subject. */
  weight: number;
  topics: TopicPlan[];
}

export interface SubjectPlan {
  code: string;
  name: string;
  categories: CategoryPlan[];
}

// ─── MATH ───────────────────────────────────────────────────────────────────

const MATH: SubjectPlan = {
  code: "MATH",
  name: "Mathematical Reasoning",
  categories: [
    {
      name: "Quantitative Problem Solving",
      weight: 45,
      topics: [
        {
          name: "Number Sense",
          subtopics: [
            {
              csv: "Fractions",
              description:
                "Read, compare, and compute with fractions and mixed numbers, including unlike denominators.",
              difficulty: 1,
            },
            {
              csv: "Decimals",
              description:
                "Read place value and add, subtract, multiply, and divide decimals.",
              difficulty: 1,
            },
            {
              csv: "Positive & negative numbers",
              // Absolute value is one clip on its own — a subtopic a learner
              // finishes in four minutes reads as a mistake in the planner, and
              // absolute value is taught inside this Khan unit anyway.
              merge: ["Absolute value"],
              description:
                "Add, subtract, multiply, and divide signed numbers, and interpret absolute value.",
              difficulty: 1,
            },
            {
              csv: "Factors & Multiples",
              description:
                "Find factors, multiples, GCF, LCM, and prime factorisations.",
              difficulty: 1,
            },
            {
              csv: "Exponents & roots",
              description:
                "Apply exponent rules and evaluate square and cube roots.",
              difficulty: 2,
            },
            {
              csv: "Scientific notation",
              description:
                "Convert between standard and scientific notation and compute with it.",
              difficulty: 2,
            },
          ],
        },
        {
          name: "Ratios, Rates and Proportion",
          subtopics: [
            {
              csv: "Ratios",
              description:
                "Write and compare ratios and unit rates, and solve rate problems.",
              difficulty: 1,
            },
            {
              csv: "Percentages",
              description:
                "Calculate percent of a number, percent change, discount, markup, tax, and tip.",
              difficulty: 2,
            },
            {
              csv: "Proportions",
              description:
                "Set up and solve proportions, including scale and constant-of-proportionality problems.",
              difficulty: 2,
            },
          ],
        },
        {
          name: "Data and Statistics",
          subtopics: [
            {
              csv: "Mean, median, mode, range",
              description:
                "Calculate mean, median, mode, range, and weighted average, and judge the effect of outliers.",
              difficulty: 2,
            },
            {
              csv: "Bar & circle graphs",
              description:
                "Read and interpret bar graphs, circle graphs, and pictographs.",
              difficulty: 1,
            },
            {
              csv: "Dot / Histograms / Box plots",
              name: "Dot plots, histograms & box plots",
              description:
                "Build and interpret dot plots, histograms, and box plots, including shape and spread.",
              difficulty: 2,
            },
            {
              csv: "Scatter plots",
              description:
                "Describe association in a scatter plot and use a line of best fit to make predictions.",
              difficulty: 2,
            },
            {
              csv: "Probability",
              description:
                "Find probabilities of simple and compound events, including independent and dependent events.",
              difficulty: 2,
            },
          ],
        },
        {
          name: "Geometric Measurement",
          subtopics: [
            {
              csv: "Area & perimeter",
              description:
                "Calculate area and perimeter of rectangles, triangles, and composite figures.",
              difficulty: 2,
            },
            {
              csv: "Surface area & volume",
              description:
                "Calculate surface area and volume of prisms, cylinders, cones, spheres, and pyramids.",
              difficulty: 3,
            },
            {
              csv: "Circles: area & circumference",
              name: "Circles",
              description:
                "Calculate circumference, area, radius, and diameter of circles.",
              difficulty: 2,
            },
            {
              csv: "Pythagorean theorem",
              description:
                "Apply the Pythagorean theorem to find missing side lengths in right triangles.",
              difficulty: 3,
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
              csv: "Variables & expressions",
              description:
                "Write, evaluate, and simplify algebraic expressions using the properties of operations.",
              difficulty: 2,
            },
          ],
        },
        {
          name: "Equations and Inequalities",
          subtopics: [
            {
              csv: "Solving equations & inequalities",
              description:
                "Solve one- and two-step linear equations and inequalities, including word problems.",
              difficulty: 2,
            },
            {
              csv: "Systems of equations",
              description:
                "Solve systems of two linear equations by graphing, substitution, and elimination.",
              difficulty: 3,
            },
          ],
        },
        {
          name: "Graphs and Functions",
          subtopics: [
            {
              csv: "Slope, intercepts, linear functions",
              name: "Slope & linear functions",
              description:
                "Find slope and intercepts, and graph and interpret linear functions.",
              difficulty: 3,
            },
            {
              csv: "Quadratic functions",
              description:
                "Factor, solve, and graph quadratic expressions and functions.",
              difficulty: 4,
            },
          ],
        },
      ],
    },
  ],
};

export const PLANS: SubjectPlan[] = [MATH];

/**
 * Clips that Khan teaches inside an in-scope unit but the GED does not test.
 *
 * These were cut once and put back on purpose: a learner who wants the full
 * Khan unit should get the full Khan unit, and deciding what to skip is a
 * judgement they are allowed to make for themselves. What survives here is the
 * analysis, so the decision can be revisited without redoing it — and so that a
 * future "show only what's on the exam" filter has its source list ready.
 *
 * Every entry was checked against the published GED Mathematical Reasoning
 * assessment targets. To re-apply any of them, move the arrays back onto the
 * matching subtopic in the plan above as `dropLessons` / `dropClips`, keeping
 * `keepClips` where it is noted — the importer supports all three and will
 * fail the run if any rule stops matching a row.
 */
export const BEYOND_GED_SCOPE: Record<string, {
  reason: string;
  dropLessons?: string[];
  dropClips?: string[];
  keepClips?: string[];
}> = {
  "Mean, median, mode, range": {
    reason:
      "Standard deviation, variance and mean absolute deviation are not GED " +
      "targets and appear on none of the formula sheets handed out in the test " +
      "centre. Khan's unit runs three lessons past the exam's edge. IQR and " +
      "range stay in scope — both are read off box plots, which the test asks about.",
    dropLessons: [
      "Variance and standard deviation of a population",
      "Variance and standard deviation of a sample",
      "More on standard deviation",
    ],
    dropClips: ["Mean absolute deviation (MAD)", "Mean absolute deviation example"],
  },
  "Scatter plots": {
    reason:
      "The GED asks a learner to look at a scatter plot: direction, linearity, " +
      "clusters, outliers, and a prediction read off a trend line. It never asks " +
      "for the regression maths — residuals, R-squared, RMSD, and four parts of a " +
      "minimisation proof are an undergraduate statistics course. Reading a trend " +
      "line is on target and is kept.",
    dropLessons: [
      "Least-squares regression equations",
      "Assessing the fit in least-squares regression",
      "More on regression",
    ],
    keepClips: ["Interpreting a trend line"],
    dropClips: ["Calculating correlation coefficient r"],
  },
  "Probability": {
    reason:
      "Compound probability is on the test; the set-theory notation Khan uses to " +
      "introduce it is not, and the addition-rule and Venn-diagram clips teach the " +
      "same idea in the form the test uses. Sampling design and significance " +
      "testing are not GED targets, and the Monty Hall problem is a famous puzzle " +
      "rather than an exam question.",
    dropLessons: ["Basic set operations"],
    dropClips: [
      "The Monty Hall problem",
      "Random number list to run experiment",
      "Random numbers for experimental probability",
      "Statistical significance of experiment",
    ],
  },
};


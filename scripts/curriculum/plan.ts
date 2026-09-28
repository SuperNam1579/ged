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

// ─── SOCIAL STUDIES ─────────────────────────────────────────────────────────
//
// From curriculum/Social Studies_wordcount.xlsx. Category weights are the GED
// Social Studies blueprint. Six sheet names are Thai; the learner-facing UI is
// English, so those get an English `name` — the sheet value stays in `csv`,
// which is what the importer matches on. DRAFT: descriptions and difficulty
// were written by Claude on 2026-09-27 for the team to review.

const SS: SubjectPlan = {
  code: "SS",
  name: "Social Studies",
  categories: [
    {
      name: "Civics & Government",
      weight: 50,
      topics: [
        {
          name: "Foundations of Government",
          subtopics: [
            {
              csv: "ประเภทของรัฐบาล + หลักการรัฐธรรมนูญ (checks & balances, federalism)",
              name: "Types of Government & Constitutional Principles",
              description:
                "Compare forms of government and explain the principles behind the US Constitution: popular sovereignty, separation of powers, checks and balances, and federalism.",
              difficulty: 2,
            },
            {
              csv: "เอกสารสำคัญ (Declaration, Constitution)",
              name: "Founding Documents",
              description:
                "Read and interpret the Declaration of Independence, the Articles of Confederation and the Constitution as primary sources.",
              difficulty: 3,
            },
            {
              csv: "Branches of government",
              description:
                "Describe the powers of Congress, the presidency and the courts, and how each branch checks the others.",
              difficulty: 2,
            },
          ],
        },
        {
          name: "Rights & Civic Participation",
          subtopics: [
            {
              csv: "Bill of Rights & amendments",
              description:
                "Explain the rights protected by the Bill of Rights and later amendments, and how courts have applied them.",
              difficulty: 2,
            },
            {
              csv: "Elections & political parties",
              description:
                "Explain how elections, campaigns and political parties work in the United States.",
              difficulty: 2,
            },
            {
              csv: "Citizenship & civic responsibilities",
              description:
                "Describe the rights and responsibilities of citizens and how citizenship is gained.",
              difficulty: 1,
            },
            {
              csv: "Contemporary public policy",
              description:
                "Analyze how political ideology, public opinion and government institutions shape current policy debates.",
              difficulty: 3,
            },
          ],
        },
      ],
    },
    {
      name: "U.S. History",
      weight: 20,
      topics: [
        {
          name: "Founding to Reconstruction",
          subtopics: [
            {
              csv: "Colonial America + Revolutionary Era",
              description:
                "Trace colonial settlement, the causes of the American Revolution and the founding of the new nation.",
              difficulty: 2,
            },
            {
              csv: "Civil War & Reconstruction",
              description:
                "Explain the causes, major events and outcomes of the Civil War and Reconstruction.",
              difficulty: 2,
            },
          ],
        },
        {
          name: "Modern America",
          subtopics: [
            {
              csv: "สงครามโลก 1 + 2 (WWI, WWII)",
              name: "World Wars I & II",
              description:
                "Explain US involvement in World War I and World War II and their effects at home and abroad.",
              difficulty: 2,
            },
            {
              csv: "Cold War",
              description:
                "Describe the rivalry between the US and the Soviet Union and its major conflicts and policies.",
              difficulty: 3,
            },
            {
              csv: "Civil Rights Movement",
              description:
                "Explain the goals, strategies and key events of the civil rights movement.",
              difficulty: 2,
            },
            {
              csv: "นโยบายต่างประเทศหลัง 9/11",
              name: "Foreign Policy after 9/11",
              description:
                "Analyze US foreign policy from the late Cold War through the September 11 attacks and the war on terror.",
              difficulty: 3,
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
          name: "Microeconomics",
          subtopics: [
            {
              csv: "Supply, demand, market equilibrium",
              description:
                "Use supply and demand to explain prices, shortages, surpluses and market equilibrium.",
              difficulty: 2,
            },
            {
              // The sheet flags 19 rows from Khan's "Forms of competition" unit as
              // possibly beyond GED scope. Imported as the sheet has them until the team
              // decides; to cut them, list their lesson names in `dropLessons`.
              csv: "แนวคิดพื้นฐาน (opportunity cost, monopoly)",
              name: "Basic Economic Concepts",
              description:
                "Apply scarcity, opportunity cost and market structures such as monopoly to economic decisions.",
              difficulty: 3,
            },
          ],
        },
        {
          name: "Macroeconomics",
          subtopics: [
            {
              csv: "Banking & financial sector",
              description:
                "Explain how banks, money, interest and financial markets work.",
              difficulty: 3,
            },
            {
              csv: "Fiscal policy & government spending",
              description:
                "Explain how taxes and government spending affect aggregate demand and the economy.",
              difficulty: 4,
            },
            {
              csv: "GDP/inflation/unemployment",
              description:
                "Measure economic performance with GDP, inflation and unemployment, and describe the business cycle.",
              difficulty: 3,
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
          name: "World History",
          subtopics: [
            {
              // The sheet asks whether to keep Khan's Unit 4 (world religions and ancient
              // empires) or stop at Units 1-3. Imported whole until the team decides.
              csv: "World history beginnings",
              description:
                "Trace early humans, the rise of agrarian societies and the first empires and belief systems.",
              difficulty: 2,
            },
          ],
        },
        {
          name: "Geography",
          subtopics: [
            {
              // Same Khan unit as "World history beginnings" Unit 3, per the sheet's
              // GED mapping. Progress is per subtopic, so a learner assigned both
              // works through that material twice.
              csv: "Resources and society",
              description:
                "Explain how natural resources and the environment shaped early agrarian societies.",
              difficulty: 2,
            },
            {
              csv: "การอพยพ (migration)",
              name: "Migration",
              description:
                "Explain why people migrate and how population growth and urbanization change places.",
              difficulty: 2,
            },
            {
              csv: "พรมแดน/ภูมิภาค/เครื่องมือภูมิศาสตร์",
              name: "Borders, Regions & Geographic Tools",
              description:
                "Use maps and geographic tools, and explain how regions and borders are defined and contested.",
              difficulty: 2,
            },
          ],
        },
      ],
    },
  ],
};

// ─── SCIENCE ────────────────────────────────────────────────────────────────
//
// From curriculum/Science_wordcount.xlsx. Category weights are the GED Science
// blueprint. The sheet numbers its subtopics ("1. Cell parts…"); the number is
// kept in `csv` for matching and dropped from the learner-facing `name`.
// DRAFT: descriptions and difficulty were written by Claude on 2026-09-27 for
// the team to review.

const SCI: SubjectPlan = {
  code: "SCI",
  name: "Science",
  categories: [
    {
      name: "Life Science",
      weight: 40,
      topics: [
        {
          name: "Cells & Energy",
          subtopics: [
            {
              csv: "1. Cell parts and their functions",
              name: "Cell Parts and Their Functions",
              description:
                "Identify the organelles of plant and animal cells and describe what each does.",
              difficulty: 1,
            },
            {
              csv: "2. Photosynthesis",
              name: "Photosynthesis",
              description:
                "Explain how plants turn light, water and carbon dioxide into glucose and oxygen.",
              difficulty: 2,
            },
            {
              csv: "3. Cellular respiration",
              name: "Cellular Respiration",
              description:
                "Explain how cells release energy from glucose, with and without oxygen.",
              difficulty: 2,
            },
            {
              csv: "4. Cell theory",
              name: "Cell Theory",
              description:
                "State the principles of cell theory and compare prokaryotic and eukaryotic cells.",
              difficulty: 1,
            },
            {
              csv: "5. Mitosis & meiosis",
              name: "Mitosis & Meiosis",
              description:
                "Compare how cells divide by mitosis and meiosis and why each matters.",
              difficulty: 3,
            },
          ],
        },
        {
          name: "Human Body & Health",
          subtopics: [
            {
              csv: "6. Digestive, respiratory, nervous, immune systems",
              name: "Human Body Systems",
              description:
                "Describe how the digestive, respiratory, nervous and immune systems work and interact.",
              difficulty: 2,
            },
            {
              csv: "7. Homeostasis",
              name: "Homeostasis",
              description:
                "Explain how the body keeps conditions such as temperature and blood sugar stable.",
              difficulty: 2,
            },
            {
              csv: "8. Nutrition",
              name: "Nutrition",
              description:
                "Describe the nutrients the body needs and how diet affects health.",
              difficulty: 1,
            },
            {
              csv: "9. Disease & pathogens",
              name: "Disease & Pathogens",
              description:
                "Explain how bacteria, viruses and other pathogens cause disease and how the body and medicine fight them.",
              difficulty: 2,
            },
          ],
        },
        {
          name: "Heredity & Evolution",
          subtopics: [
            {
              csv: "10. DNA structure and heredity (Punnett squares)",
              name: "DNA & Heredity",
              description:
                "Describe DNA's structure and predict inheritance with Punnett squares.",
              difficulty: 3,
            },
            {
              csv: "11. Evolution and natural selection",
              name: "Evolution & Natural Selection",
              description:
                "Explain how natural selection drives evolution and the evidence for it.",
              difficulty: 3,
            },
          ],
        },
        {
          name: "Ecosystems",
          subtopics: [
            {
              csv: "12. Food webs and energy flow",
              name: "Food Webs & Energy Flow",
              description:
                "Trace energy through food chains, food webs and trophic levels.",
              difficulty: 2,
            },
            {
              csv: "13. Human impact on environment",
              name: "Human Impact on the Environment",
              description:
                "Analyze how human activity affects ecosystems, biodiversity and resources.",
              difficulty: 2,
            },
            {
              csv: "14. Carrying capacity",
              name: "Carrying Capacity",
              description:
                "Explain how limiting factors set the carrying capacity of a population.",
              difficulty: 2,
            },
            {
              csv: "15. Symbiosis (mutualism, parasitism)",
              name: "Symbiosis",
              description:
                "Distinguish mutualism, commensalism and parasitism with examples.",
              difficulty: 1,
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
              csv: "16. Atomic structure and properties of matter",
              name: "Atomic Structure & Properties of Matter",
              description:
                "Describe atoms, the periodic table and how structure determines a substance's properties.",
              difficulty: 3,
            },
            {
              csv: "17. States of matter",
              name: "States of Matter",
              description:
                "Explain solids, liquids and gases and the changes between them in terms of particle motion.",
              difficulty: 1,
            },
            {
              csv: "18. Solutions & solubility",
              name: "Solutions & Solubility",
              description:
                "Describe solutions and concentration, and what affects how much of a substance dissolves.",
              difficulty: 2,
            },
            {
              csv: "19. Balancing equations, exothermic vs endothermic",
              name: "Chemical Equations & Energy Changes",
              description:
                "Balance chemical equations and classify reactions as exothermic or endothermic.",
              difficulty: 3,
            },
          ],
        },
        {
          name: "Physics",
          subtopics: [
            {
              csv: "20. Speed, velocity, Newton's Laws of Motion",
              name: "Motion & Newton's Laws",
              description:
                "Calculate speed, velocity and acceleration, and apply Newton's three laws of motion.",
              difficulty: 3,
            },
            {
              csv: "21. Types & transformation of energy",
              name: "Types & Transformations of Energy",
              description:
                "Identify forms of energy and describe how energy changes form while being conserved.",
              difficulty: 2,
            },
            {
              csv: "22. Energy sources (fossil fuel, nuclear, renewable)",
              name: "Energy Sources",
              description:
                "Compare fossil, nuclear and renewable energy sources and their trade-offs.",
              difficulty: 2,
            },
            {
              csv: "23. Heat, temperature & heat transfer",
              name: "Heat & Heat Transfer",
              description:
                "Distinguish heat from temperature and explain conduction, convection and radiation.",
              difficulty: 2,
            },
            {
              csv: "24. Work & simple machines",
              name: "Work & Simple Machines",
              description:
                "Calculate work and explain how simple machines trade force for distance.",
              difficulty: 2,
            },
            {
              csv: "25. Wave theory and sound",
              name: "Waves & Sound",
              description:
                "Describe wave properties and how sound travels.",
              difficulty: 2,
            },
            {
              csv: "26. Light",
              name: "Light",
              description:
                "Explain the electromagnetic spectrum, reflection and refraction.",
              difficulty: 2,
            },
            {
              csv: "27. Magnetism",
              name: "Magnetism",
              description:
                "Describe magnetic fields and how electricity and magnetism produce each other.",
              difficulty: 3,
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
          name: "Earth Systems",
          subtopics: [
            {
              csv: "28. Plate tectonics, volcanoes, earthquakes",
              name: "Plate Tectonics, Volcanoes & Earthquakes",
              description:
                "Explain plate movement and how it causes earthquakes, volcanoes and mountains.",
              difficulty: 2,
            },
            {
              csv: "29. Weather and climate change",
              name: "Weather & Climate Change",
              description:
                "Distinguish weather from climate and explain the causes and effects of climate change.",
              difficulty: 2,
            },
            {
              csv: "30. Oceans & currents",
              name: "Oceans & Currents",
              description:
                "Explain what drives ocean currents and how they affect climate.",
              difficulty: 2,
            },
            {
              csv: "31. Cycles of matter",
              name: "Cycles of Matter",
              description:
                "Trace the water, carbon and nitrogen cycles through Earth's systems.",
              difficulty: 2,
            },
            {
              csv: "32. Natural hazards",
              name: "Natural Hazards",
              description:
                "Describe natural hazards and how people predict and reduce their impact.",
              difficulty: 1,
            },
            {
              csv: "33. Renewable/nonrenewable resources & sustainability",
              name: "Natural Resources & Sustainability",
              description:
                "Compare renewable and nonrenewable resources and how they can be managed sustainably.",
              difficulty: 2,
            },
          ],
        },
        {
          name: "Space & Earth History",
          subtopics: [
            {
              csv: "34. Solar system and stars",
              name: "The Solar System & Stars",
              description:
                "Describe the solar system and the life cycle of stars.",
              difficulty: 2,
            },
            {
              csv: "35. Earth's age, rock layers & fossils",
              name: "Earth's Age, Rock Layers & Fossils",
              description:
                "Use rock layers and fossils to reason about Earth's age and history.",
              difficulty: 2,
            },
          ],
        },
      ],
    },
  ],
};

export const PLANS: SubjectPlan[] = [MATH, SS, SCI];

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


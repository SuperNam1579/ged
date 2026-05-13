import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding GED curriculum...");

  // ─── Subjects ──────────────────────────────────────────────────────────────

  const [math, rla, ss, sci] = await Promise.all([
    prisma.subject.upsert({
      where: { code: "MATH" },
      update: {},
      create: { name: "Mathematical Reasoning", code: "MATH" },
    }),
    prisma.subject.upsert({
      where: { code: "RLA" },
      update: {},
      create: { name: "Reasoning Through Language Arts", code: "RLA" },
    }),
    prisma.subject.upsert({
      where: { code: "SS" },
      update: {},
      create: { name: "Social Studies", code: "SS" },
    }),
    prisma.subject.upsert({
      where: { code: "SCI" },
      update: {},
      create: { name: "Science", code: "SCI" },
    }),
  ]);

  // ─── MATH Categories & Topics & Subtopics ──────────────────────────────────

  const mathNumCat = await prisma.category.create({
    data: { subjectId: math.id, name: "Number & Quantity", weight: 20 },
  });
  const mathAlgCat = await prisma.category.create({
    data: { subjectId: math.id, name: "Algebra", weight: 30 },
  });
  const mathFuncCat = await prisma.category.create({
    data: { subjectId: math.id, name: "Functions", weight: 20 },

  });
  const mathGeoCat = await prisma.category.create({
    data: { subjectId: math.id, name: "Geometry", weight: 20 },
  });
  const mathDataCat = await prisma.category.create({
    data: { subjectId: math.id, name: "Data, Statistics & Probability", weight: 10 },
  });

  // Number & Quantity Topics
  const numOpTopic = await prisma.topic.create({
    data: { categoryId: mathNumCat.id, name: "Number Operations" },
  });
  const ratioTopic = await prisma.topic.create({
    data: { categoryId: mathNumCat.id, name: "Ratios & Proportional Relationships" },
  });

  // Algebra Topics
  const exprTopic = await prisma.topic.create({
    data: { categoryId: mathAlgCat.id, name: "Expressions & Polynomials" },
  });
  const eqTopic = await prisma.topic.create({
    data: { categoryId: mathAlgCat.id, name: "Equations & Inequalities" },
  });

  // Functions Topics
  const linFuncTopic = await prisma.topic.create({
    data: { categoryId: mathFuncCat.id, name: "Linear Functions" },
  });
  const quadFuncTopic = await prisma.topic.create({
    data: { categoryId: mathFuncCat.id, name: "Quadratic & Other Functions" },
  });

  // Geometry Topics
  const geoTopic = await prisma.topic.create({
    data: { categoryId: mathGeoCat.id, name: "Shapes, Area & Volume" },
  });

  // Data Topics
  const statTopic = await prisma.topic.create({
    data: { categoryId: mathDataCat.id, name: "Statistics & Probability" },
  });

  // MATH Subtopics (15 total)
  const mathSubtopics = await Promise.all([
    // Number Operations
    prisma.subtopic.create({
      data: {
        topicId: numOpTopic.id, name: "Integer Operations",
        description: "Add, subtract, multiply, and divide integers including negative numbers.",
        learningUrl: "https://www.khanacademy.org/math/cc-sixth-grade-math/cc-6th-negative-number-topic",
        estimatedMinutes: 45, difficultyLevel: 1, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: numOpTopic.id, name: "Fractions, Decimals & Percents",
        description: "Convert and compute with fractions, decimals, and percentages.",
        learningUrl: "https://www.khanacademy.org/math/pre-algebra/pre-algebra-fractions",
        estimatedMinutes: 60, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: ratioTopic.id, name: "Ratios & Rates",
        description: "Understand and apply ratios, unit rates, and proportional reasoning.",
        learningUrl: "https://www.khanacademy.org/math/cc-sixth-grade-math/cc-6th-ratios-prop",
        estimatedMinutes: 50, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: ratioTopic.id, name: "Percent Problems",
        description: "Solve percent change, percent of a number, and real-world percent applications.",
        learningUrl: "https://www.khanacademy.org/math/pre-algebra/pre-algebra-ratios-rates",
        estimatedMinutes: 45, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    // Expressions & Polynomials
    prisma.subtopic.create({
      data: {
        topicId: exprTopic.id, name: "Algebraic Expressions",
        description: "Write, simplify, and evaluate algebraic expressions.",
        learningUrl: "https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:foundation-algebra",
        estimatedMinutes: 55, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: exprTopic.id, name: "Polynomial Operations",
        description: "Add, subtract, multiply, and factor polynomials.",
        learningUrl: "https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:polynomial-arithmetic",
        estimatedMinutes: 70, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    // Equations & Inequalities
    prisma.subtopic.create({
      data: {
        topicId: eqTopic.id, name: "Linear Equations",
        description: "Solve one-variable and two-variable linear equations.",
        learningUrl: "https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:solve-equations-inequalities",
        estimatedMinutes: 60, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: eqTopic.id, name: "Inequalities & Systems",
        description: "Solve linear inequalities and systems of equations.",
        learningUrl: "https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:linear-equation-inequality",
        estimatedMinutes: 65, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    // Linear Functions
    prisma.subtopic.create({
      data: {
        topicId: linFuncTopic.id, name: "Slope & Linear Graphs",
        description: "Calculate slope, interpret graphs, and write linear equations.",
        learningUrl: "https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:linear-equations-graphs",
        estimatedMinutes: 60, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    // Quadratic & Other Functions
    prisma.subtopic.create({
      data: {
        topicId: quadFuncTopic.id, name: "Quadratic Functions",
        description: "Graph, solve, and interpret quadratic equations and parabolas.",
        learningUrl: "https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:quadratics-multiplying-factoring",
        estimatedMinutes: 75, difficultyLevel: 4, prerequisiteIds: [],
      },
    }),
    // Geometry
    prisma.subtopic.create({
      data: {
        topicId: geoTopic.id, name: "Area, Perimeter & Volume",
        description: "Calculate area, perimeter, surface area, and volume of 2D and 3D figures.",
        learningUrl: "https://www.khanacademy.org/math/geometry/hs-geo-foundations",
        estimatedMinutes: 70, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: geoTopic.id, name: "Pythagorean Theorem",
        description: "Apply the Pythagorean theorem and distance formula.",
        learningUrl: "https://www.khanacademy.org/math/basic-geo/basic-geo-pythagorean-topic",
        estimatedMinutes: 50, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: geoTopic.id, name: "Coordinate Geometry",
        description: "Work with the coordinate plane, midpoints, and transformations.",
        learningUrl: "https://www.khanacademy.org/math/geometry/hs-geo-analytic-geometry",
        estimatedMinutes: 55, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    // Statistics
    prisma.subtopic.create({
      data: {
        topicId: statTopic.id, name: "Data Analysis & Central Tendency",
        description: "Calculate mean, median, mode, and interpret data displays.",
        learningUrl: "https://www.khanacademy.org/math/statistics-probability/summarizing-quantitative-data",
        estimatedMinutes: 55, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: statTopic.id, name: "Probability",
        description: "Compute and interpret basic and compound probability.",
        learningUrl: "https://www.khanacademy.org/math/statistics-probability/probability-library",
        estimatedMinutes: 55, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
  ]);

  // ─── RLA Categories & Subtopics (14 total) ────────────────────────────────

  const rlaReadCat = await prisma.category.create({
    data: { subjectId: rla.id, name: "Reading for Meaning", weight: 45 },
  });
  const rlaWriteCat = await prisma.category.create({
    data: { subjectId: rla.id, name: "Extended Writing", weight: 35 },
  });
  const rlaLangCat = await prisma.category.create({
    data: { subjectId: rla.id, name: "Language & Grammar", weight: 20 },
  });

  const infoTopic = await prisma.topic.create({
    data: { categoryId: rlaReadCat.id, name: "Informational Text" },
  });
  const litTopic = await prisma.topic.create({
    data: { categoryId: rlaReadCat.id, name: "Literary Text" },
  });
  const argTopic = await prisma.topic.create({
    data: { categoryId: rlaWriteCat.id, name: "Argument & Evidence Writing" },
  });
  const grammarTopic = await prisma.topic.create({
    data: { categoryId: rlaLangCat.id, name: "Grammar & Usage" },
  });

  await Promise.all([
    prisma.subtopic.create({
      data: {
        topicId: infoTopic.id, name: "Main Idea & Supporting Details",
        description: "Identify the central idea and how details support it in informational texts.",
        learningUrl: "https://www.khanacademy.org/ela/cc-2nd-reading-informational/x3cdf5ef2:key-details",
        estimatedMinutes: 40, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: infoTopic.id, name: "Author's Purpose & Point of View",
        description: "Determine the author's purpose and analyze bias in non-fiction texts.",
        learningUrl: "https://www.khanacademy.org/ela/cc-4th-reading-informational/x3cdf5ef2:authors-purpose",
        estimatedMinutes: 45, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: infoTopic.id, name: "Text Structure & Features",
        description: "Analyze how authors use text structure (cause-effect, compare-contrast) to convey meaning.",
        learningUrl: "https://www.khanacademy.org/ela/cc-5th-reading-informational",
        estimatedMinutes: 40, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: infoTopic.id, name: "Argument Analysis",
        description: "Evaluate claims, evidence, and reasoning in argumentative texts.",
        learningUrl: "https://www.khanacademy.org/ela/cc-6th-reading-informational",
        estimatedMinutes: 50, difficultyLevel: 4, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: litTopic.id, name: "Reading Fiction",
        description: "Analyze plot, character, setting, and theme in literary texts.",
        learningUrl: "https://www.khanacademy.org/ela/cc-6th-reading-literature",
        estimatedMinutes: 45, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: litTopic.id, name: "Figurative Language & Tone",
        description: "Identify and interpret figurative language, mood, and tone in literature.",
        learningUrl: "https://www.khanacademy.org/ela/cc-8th-reading-literature",
        estimatedMinutes: 45, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: litTopic.id, name: "Comparing Texts",
        description: "Compare themes, arguments, and structures across multiple texts.",
        learningUrl: "https://www.khanacademy.org/ela/cc-9th-reading-literature",
        estimatedMinutes: 50, difficultyLevel: 4, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: argTopic.id, name: "Writing an Argument Essay",
        description: "Structure and write a persuasive extended response using evidence.",
        learningUrl: "https://www.khanacademy.org/college-careers-more/learnstorm-growth-mindset-activities-us",
        estimatedMinutes: 90, difficultyLevel: 4, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: argTopic.id, name: "Using Evidence & Citations",
        description: "Integrate and cite textual evidence effectively in written responses.",
        learningUrl: "https://www.khanacademy.org/writing",
        estimatedMinutes: 60, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: grammarTopic.id, name: "Sentence Structure",
        description: "Identify and correct run-ons, fragments, and complex sentence structures.",
        learningUrl: "https://www.khanacademy.org/humanities/grammar/syntax-sentences-and-clauses",
        estimatedMinutes: 45, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: grammarTopic.id, name: "Punctuation & Capitalization",
        description: "Apply correct punctuation (commas, semicolons, apostrophes) and capitalization rules.",
        learningUrl: "https://www.khanacademy.org/humanities/grammar/punctuation-the-colon-semicolon-and-more",
        estimatedMinutes: 40, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: grammarTopic.id, name: "Vocabulary in Context",
        description: "Use context clues and word parts to determine the meaning of unfamiliar words.",
        learningUrl: "https://www.khanacademy.org/ela/cc-2nd-reading-vocab",
        estimatedMinutes: 35, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: grammarTopic.id, name: "Subject-Verb Agreement",
        description: "Apply subject-verb and pronoun-antecedent agreement rules.",
        learningUrl: "https://www.khanacademy.org/humanities/grammar/parts-of-speech-the-verb",
        estimatedMinutes: 40, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: grammarTopic.id, name: "Verb Tense & Modifiers",
        description: "Use consistent verb tenses and correctly place modifiers in sentences.",
        learningUrl: "https://www.khanacademy.org/humanities/grammar/parts-of-speech-the-verb/modal-verbs",
        estimatedMinutes: 40, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
  ]);

  // ─── Social Studies (14 total) ────────────────────────────────────────────

  const ssCivCat = await prisma.category.create({
    data: { subjectId: ss.id, name: "Civics & Government", weight: 50 },
  });
  const ssUshCat = await prisma.category.create({
    data: { subjectId: ss.id, name: "United States History", weight: 20 },
  });
  const ssEconCat = await prisma.category.create({
    data: { subjectId: ss.id, name: "Economics", weight: 15 },
  });
  const ssGeoCat = await prisma.category.create({
    data: { subjectId: ss.id, name: "Geography & the World", weight: 15 },
  });

  const civTopic = await prisma.topic.create({
    data: { categoryId: ssCivCat.id, name: "Government & Citizenship" },
  });
  const ushTopic = await prisma.topic.create({
    data: { categoryId: ssUshCat.id, name: "American History" },
  });
  const econTopic = await prisma.topic.create({
    data: { categoryId: ssEconCat.id, name: "Economic Principles" },
  });
  const worldGeoTopic = await prisma.topic.create({
    data: { categoryId: ssGeoCat.id, name: "World Geography & Cultures" },
  });

  await Promise.all([
    prisma.subtopic.create({
      data: {
        topicId: civTopic.id, name: "US Constitution & Bill of Rights",
        description: "Understand the structure of the US Constitution and the rights it guarantees.",
        learningUrl: "https://www.khanacademy.org/humanities/us-government-and-civics/us-gov-foundations",
        estimatedMinutes: 60, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: civTopic.id, name: "Branches of Government",
        description: "Describe the powers and functions of the legislative, executive, and judicial branches.",
        learningUrl: "https://www.khanacademy.org/humanities/us-government-and-civics/us-gov-foundations/us-gov-structure-of-the-constitution",
        estimatedMinutes: 55, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: civTopic.id, name: "Elections & Political Participation",
        description: "Explain the electoral process, voting rights, and civic responsibility.",
        learningUrl: "https://www.khanacademy.org/humanities/us-government-and-civics/us-gov-political-participation",
        estimatedMinutes: 45, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: civTopic.id, name: "Civil Rights & Liberties",
        description: "Trace the civil rights movement and key legislation protecting individual rights.",
        learningUrl: "https://www.khanacademy.org/humanities/us-government-and-civics/us-gov-civil-liberties-civil-rights",
        estimatedMinutes: 55, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: ushTopic.id, name: "American Revolution & Founding",
        description: "Analyze causes and outcomes of the American Revolution and the founding documents.",
        learningUrl: "https://www.khanacademy.org/humanities/us-history/colonial-america/the-american-revolution",
        estimatedMinutes: 60, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: ushTopic.id, name: "Civil War & Reconstruction",
        description: "Examine causes, key events, and aftermath of the Civil War and Reconstruction era.",
        learningUrl: "https://www.khanacademy.org/humanities/us-history/civil-war-era",
        estimatedMinutes: 60, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: ushTopic.id, name: "World Wars & Modern America",
        description: "Evaluate America's role in WWI, WWII, and the Cold War era.",
        learningUrl: "https://www.khanacademy.org/humanities/us-history/rise-to-world-power",
        estimatedMinutes: 65, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: ushTopic.id, name: "Social Movements of the 20th Century",
        description: "Analyse the civil rights, women's rights, and labor movements.",
        learningUrl: "https://www.khanacademy.org/humanities/us-history/postwar-era",
        estimatedMinutes: 50, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: econTopic.id, name: "Supply, Demand & Markets",
        description: "Apply supply and demand principles to real-world economic scenarios.",
        learningUrl: "https://www.khanacademy.org/economics-finance-domain/microeconomics/supply-demand-equilibrium",
        estimatedMinutes: 55, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: econTopic.id, name: "Personal Finance",
        description: "Understand budgeting, credit, taxes, and basic personal financial planning.",
        learningUrl: "https://www.khanacademy.org/college-careers-more/personal-finance",
        estimatedMinutes: 50, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: econTopic.id, name: "Macro & Microeconomics",
        description: "Distinguish macro and microeconomic concepts including GDP, inflation, and competition.",
        learningUrl: "https://www.khanacademy.org/economics-finance-domain/macroeconomics",
        estimatedMinutes: 60, difficultyLevel: 4, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: worldGeoTopic.id, name: "Map Skills & Geographic Tools",
        description: "Read and interpret maps, charts, and geographic data.",
        learningUrl: "https://www.khanacademy.org/humanities/us-history/civil-war-era/slavery-in-the-antebellum-us",
        estimatedMinutes: 40, difficultyLevel: 1, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: worldGeoTopic.id, name: "Human Geography & Migration",
        description: "Examine how geography shapes human societies, culture, and migration patterns.",
        learningUrl: "https://www.khanacademy.org/humanities/world-history",
        estimatedMinutes: 50, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: worldGeoTopic.id, name: "Global Interdependence",
        description: "Analyze trade, environmental, and political connections between nations.",
        learningUrl: "https://www.khanacademy.org/humanities/world-history/euro-hist",
        estimatedMinutes: 45, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
  ]);

  // ─── Science (14 total) ───────────────────────────────────────────────────

  const sciLifeCat = await prisma.category.create({
    data: { subjectId: sci.id, name: "Life Science", weight: 40 },
  });
  const sciPhysCat = await prisma.category.create({
    data: { subjectId: sci.id, name: "Physical Science", weight: 40 },
  });
  const sciEarthCat = await prisma.category.create({
    data: { subjectId: sci.id, name: "Earth & Space Science", weight: 20 },
  });

  const bioTopic = await prisma.topic.create({
    data: { categoryId: sciLifeCat.id, name: "Biology & Ecology" },
  });
  const chemTopic = await prisma.topic.create({
    data: { categoryId: sciPhysCat.id, name: "Chemistry" },
  });
  const physTopic = await prisma.topic.create({
    data: { categoryId: sciPhysCat.id, name: "Physics" },
  });
  const earthTopic = await prisma.topic.create({
    data: { categoryId: sciEarthCat.id, name: "Earth & Space" },
  });

  await Promise.all([
    prisma.subtopic.create({
      data: {
        topicId: bioTopic.id, name: "Cell Biology",
        description: "Identify cell structures and explain cellular processes including mitosis.",
        learningUrl: "https://www.khanacademy.org/science/ap-biology/cell-structure-and-function",
        estimatedMinutes: 60, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: bioTopic.id, name: "Genetics & Heredity",
        description: "Explain DNA structure, inheritance, and how traits are passed to offspring.",
        learningUrl: "https://www.khanacademy.org/science/ap-biology/heredity",
        estimatedMinutes: 65, difficultyLevel: 4, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: bioTopic.id, name: "Evolution & Natural Selection",
        description: "Understand the mechanisms of evolution and how species adapt over time.",
        learningUrl: "https://www.khanacademy.org/science/ap-biology/natural-selection",
        estimatedMinutes: 55, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: bioTopic.id, name: "Ecosystems & Energy Flow",
        description: "Describe food webs, energy pyramids, and nutrient cycles in ecosystems.",
        learningUrl: "https://www.khanacademy.org/science/ap-biology/ecology-ap",
        estimatedMinutes: 55, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: bioTopic.id, name: "Human Body Systems",
        description: "Explain the major human body systems and how they interact.",
        learningUrl: "https://www.khanacademy.org/science/health-and-medicine",
        estimatedMinutes: 70, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: chemTopic.id, name: "Atomic Structure & Periodic Table",
        description: "Describe atomic structure and trends in the periodic table.",
        learningUrl: "https://www.khanacademy.org/science/ap-chemistry-beta/x2eef969c74e0d802:atomic-structure-and-properties",
        estimatedMinutes: 60, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: chemTopic.id, name: "Chemical Reactions & Bonding",
        description: "Identify types of chemical reactions and explain chemical bonding.",
        learningUrl: "https://www.khanacademy.org/science/ap-chemistry-beta/x2eef969c74e0d802:chemical-bonding",
        estimatedMinutes: 65, difficultyLevel: 4, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: chemTopic.id, name: "States of Matter & Solutions",
        description: "Explain properties of solids, liquids, gases, and solutions.",
        learningUrl: "https://www.khanacademy.org/science/ap-chemistry-beta/x2eef969c74e0d802:intermolecular-forces-and-properties",
        estimatedMinutes: 55, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: physTopic.id, name: "Motion & Forces",
        description: "Apply Newton's laws of motion and analyze forces in everyday situations.",
        learningUrl: "https://www.khanacademy.org/science/physics/forces-newtons-laws",
        estimatedMinutes: 60, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: physTopic.id, name: "Energy & Work",
        description: "Distinguish kinetic and potential energy and apply the law of conservation of energy.",
        learningUrl: "https://www.khanacademy.org/science/physics/work-and-energy",
        estimatedMinutes: 55, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: physTopic.id, name: "Waves, Light & Sound",
        description: "Describe wave properties, the electromagnetic spectrum, and sound.",
        learningUrl: "https://www.khanacademy.org/science/physics/mechanical-waves-and-sound",
        estimatedMinutes: 55, difficultyLevel: 3, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: earthTopic.id, name: "Earth's Structure & Plate Tectonics",
        description: "Describe Earth's layers and explain plate tectonic theory and its effects.",
        learningUrl: "https://www.khanacademy.org/science/cosmology-and-astronomy/earth-history-lesson",
        estimatedMinutes: 55, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: earthTopic.id, name: "Weather, Climate & Atmosphere",
        description: "Explain weather patterns, climate change, and atmospheric science.",
        learningUrl: "https://www.khanacademy.org/science/earth-and-space-science/earth-and-space-topic",
        estimatedMinutes: 50, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
    prisma.subtopic.create({
      data: {
        topicId: earthTopic.id, name: "Astronomy & the Universe",
        description: "Describe the solar system, stars, and the scale and origin of the universe.",
        learningUrl: "https://www.khanacademy.org/science/cosmology-and-astronomy",
        estimatedMinutes: 50, difficultyLevel: 2, prerequisiteIds: [],
      },
    }),
  ]);

  // ─── Seed assessments with sample questions ────────────────────────────────

  const allSubtopics = await prisma.subtopic.findMany({
    include: { topic: { include: { category: { include: { subject: true } } } } },
  });

  // Create pre-assessments for each subject (10 questions each)
  for (const subject of [math, rla, ss, sci]) {
    const subjectSubtopics = allSubtopics.filter(
      (s: typeof allSubtopics[0]) => s.topic.category.subjectId === subject.id
    );
    const selected = subjectSubtopics.slice(0, 10);

    const assessment = await prisma.assessment.create({
      data: {
        type: "PRE",
        subjectId: subject.id,
        title: `${subject.name} Pre-Assessment`,
        timeLimit: 30,
      },
    });

    for (let i = 0; i < selected.length; i++) {
      const subtopic = selected[i];
      await prisma.question.create({
        data: {
          assessmentId: assessment.id,
          subtopicId: subtopic.id,
          text: getSampleQuestion(subtopic.name),
          options: [
            { id: "A", text: getSampleOptionA(subtopic.name) },
            { id: "B", text: getSampleOptionB(subtopic.name) },
            { id: "C", text: getSampleOptionC(subtopic.name) },
            { id: "D", text: getSampleOptionD(subtopic.name) },
          ],
          correctOptionId: "A",
          explanation: `This tests your understanding of ${subtopic.name}.`,
          source: "AI_GENERATED",
          difficulty: subtopic.difficultyLevel,
        },
      });
    }
  }

  console.log("Seeding complete!");
  console.log(`Subjects: 4`);
  console.log(`Subtopics: ${allSubtopics.length}`);
}

function getSampleQuestion(topicName: string): string {
  return `Which of the following best describes the core concept of "${topicName}"?`;
}
function getSampleOptionA(topicName: string): string {
  return `The foundational principle of ${topicName} applied correctly`;
}
function getSampleOptionB(topicName: string): string {
  return `An incorrect application of ${topicName} principles`;
}
function getSampleOptionC(topicName: string): string {
  return `A common misconception about ${topicName}`;
}
function getSampleOptionD(topicName: string): string {
  return `An unrelated concept often confused with ${topicName}`;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

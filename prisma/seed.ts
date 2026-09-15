import { PrismaClient } from "@prisma/client";
import { CURRICULUM } from "./curriculum.data";

const prisma = new PrismaClient();

/**
 * Upserts for the curriculum tree.
 *
 * These take the same `{ data: … }` argument shape as `prisma.x.create`, so the
 * call sites below read unchanged — what differs is that a second run updates
 * the existing row instead of creating a duplicate.
 *
 * ── Why the seed no longer deletes the curriculum ─────────────────────────
 * It used to drop every category, topic and subtopic and build them again,
 * which handed each subtopic a fresh cuid on every run. Those IDs are what
 * learner progress, study plans and the Resource table all point at, so a
 * re-seed took every learner's watch history, proficiency and schedule with it
 * — and it did so quietly, as a side effect of editing a description.
 *
 * Matching on the natural key instead — a name within its parent — keeps IDs
 * stable across runs, so the curriculum can be reshaped without touching
 * anything hanging off it. A *rename* still reads as a different subtopic; that
 * is the case the old comment here called out as needing a real migration, and
 * it still does.
 */
// Everything this run touched, so what it did *not* touch can be reported.
const seen = { categories: new Set<string>(), topics: new Set<string>(), subtopics: new Set<string>() };

async function upsertCategory({ data }: { data: { subjectId: string; name: string; weight: number } }) {
  const row = await prisma.category.upsert({
    where: { subjectId_name: { subjectId: data.subjectId, name: data.name } },
    update: { weight: data.weight },
    create: data,
  });
  seen.categories.add(row.id);
  return row;
}

async function upsertTopic({
  data,
}: {
  data: { categoryId: string; name: string; description?: string };
}) {
  const row = await prisma.topic.upsert({
    where: { categoryId_name: { categoryId: data.categoryId, name: data.name } },
    update: { description: data.description },
    create: data,
  });
  seen.topics.add(row.id);
  return row;
}

async function upsertSubtopic({
  data,
}: {
  data: {
    topicId: string;
    name: string;
    description: string;
    learningUrl: string;
    estimatedMinutes: number;
    difficultyLevel: number;
  };
}) {
  const row = await prisma.subtopic.upsert({
    where: { topicId_name: { topicId: data.topicId, name: data.name } },
    update: {
      description: data.description,
      learningUrl: data.learningUrl,
      estimatedMinutes: data.estimatedMinutes,
      difficultyLevel: data.difficultyLevel,
    },
    create: data,
  });
  seen.subtopics.add(row.id);
  return row;
}

/**
 * Clears only what this seed rebuilds wholesale.
 *
 * Assessments and their questions are regenerated from scratch every run — the
 * seeded questions are placeholder text keyed to nothing — so they are dropped
 * along with the attempts and responses that reference them. That still costs a
 * learner their assessment history on a re-seed, which is worth fixing, but it
 * is a separate problem from the curriculum IDs.
 *
 * Prerequisites are re-derived below from names, so they are rebuilt too.
 *
 * Everything else now survives: proficiencies, study plans, study sessions,
 * resources and watch progress all hang off subtopic IDs that no longer change.
 */
async function resetGeneratedContent() {
  await prisma.userQuestionResponse.deleteMany();
  await prisma.userAssessmentAttempt.deleteMany();
  await prisma.question.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.subtopicPrerequisite.deleteMany();
  console.log("Cleared assessments and prerequisites (curriculum kept).");
}

async function main() {
  console.log("Seeding GED curriculum...");

  await resetGeneratedContent();

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

  const subjectByCode = new Map([math, rla, ss, sci].map((s) => [s.code, s]));

  // ─── Generated curriculum ──────────────────────────────────────────────────
  //
  // Subjects listed in prisma/curriculum.data.ts are seeded from there rather
  // than from a block in this file. That file is built by
  // scripts/import-curriculum.ts out of the CSVs in `curriculum/`, where the
  // clip lists are actually maintained, so hand-editing the structure here
  // would be overwritten on the next import.
  //
  // Subjects absent from it keep their hand-written block below, and move over
  // as their CSV arrives.

  for (const subject of CURRICULUM) {
    const row = subjectByCode.get(subject.code);
    if (!row) throw new Error(`curriculum.data.ts has ${subject.code}, which is not a seeded subject`);

    for (const cat of subject.categories) {
      const category = await upsertCategory({
        data: { subjectId: row.id, name: cat.name, weight: cat.weight },
      });
      for (const topic of cat.topics) {
        const topicRow = await upsertTopic({
          data: { categoryId: category.id, name: topic.name },
        });
        for (const st of topic.subtopics) {
          await upsertSubtopic({
            data: {
              topicId: topicRow.id,
              name: st.name,
              description: st.description,
              learningUrl: st.learningUrl,
              estimatedMinutes: st.estimatedMinutes,
              difficultyLevel: st.difficultyLevel,
            },
          });
        }
      }
    }

    const subtopicCount = subject.categories.reduce(
      (n, c) => n + c.topics.reduce((m, t) => m + t.subtopics.length, 0),
      0
    );
    console.log(`${subject.code}: ${subtopicCount} subtopics from curriculum.data.ts`);
  }

  // ─── RLA Categories & Subtopics (14 total) ────────────────────────────────

  const rlaReadCat = await upsertCategory({
    data: { subjectId: rla.id, name: "Reading for Meaning", weight: 45 },
  });
  const rlaWriteCat = await upsertCategory({
    data: { subjectId: rla.id, name: "Extended Writing", weight: 35 },
  });
  const rlaLangCat = await upsertCategory({
    data: { subjectId: rla.id, name: "Language & Grammar", weight: 20 },
  });

  const infoTopic = await upsertTopic({
    data: { categoryId: rlaReadCat.id, name: "Informational Text" },
  });
  const litTopic = await upsertTopic({
    data: { categoryId: rlaReadCat.id, name: "Literary Text" },
  });
  const argTopic = await upsertTopic({
    data: { categoryId: rlaWriteCat.id, name: "Argument & Evidence Writing" },
  });
  const grammarTopic = await upsertTopic({
    data: { categoryId: rlaLangCat.id, name: "Grammar & Usage" },
  });

  await Promise.all([
    upsertSubtopic({
      data: {
        topicId: infoTopic.id, name: "Main Idea & Supporting Details",
        description: "Identify the central idea and how details support it in informational texts.",
        learningUrl: "https://www.khanacademy.org/ela/cc-2nd-reading-informational/x3cdf5ef2:key-details",
        estimatedMinutes: 40, difficultyLevel: 2,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: infoTopic.id, name: "Author's Purpose & Point of View",
        description: "Determine the author's purpose and analyze bias in non-fiction texts.",
        learningUrl: "https://www.khanacademy.org/ela/cc-4th-reading-informational/x3cdf5ef2:authors-purpose",
        estimatedMinutes: 45, difficultyLevel: 3,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: infoTopic.id, name: "Text Structure & Features",
        description: "Analyze how authors use text structure (cause-effect, compare-contrast) to convey meaning.",
        learningUrl: "https://www.khanacademy.org/ela/cc-5th-reading-informational",
        estimatedMinutes: 40, difficultyLevel: 2,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: infoTopic.id, name: "Argument Analysis",
        description: "Evaluate claims, evidence, and reasoning in argumentative texts.",
        learningUrl: "https://www.khanacademy.org/ela/cc-6th-reading-informational",
        estimatedMinutes: 50, difficultyLevel: 4,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: litTopic.id, name: "Reading Fiction",
        description: "Analyze plot, character, setting, and theme in literary texts.",
        learningUrl: "https://www.khanacademy.org/ela/cc-6th-reading-literature",
        estimatedMinutes: 45, difficultyLevel: 2,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: litTopic.id, name: "Figurative Language & Tone",
        description: "Identify and interpret figurative language, mood, and tone in literature.",
        learningUrl: "https://www.khanacademy.org/ela/cc-8th-reading-literature",
        estimatedMinutes: 45, difficultyLevel: 3,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: litTopic.id, name: "Comparing Texts",
        description: "Compare themes, arguments, and structures across multiple texts.",
        learningUrl: "https://www.khanacademy.org/ela/cc-9th-reading-literature",
        estimatedMinutes: 50, difficultyLevel: 4,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: argTopic.id, name: "Writing an Argument Essay",
        description: "Structure and write a persuasive extended response using evidence.",
        learningUrl: "https://www.khanacademy.org/college-careers-more/learnstorm-growth-mindset-activities-us",
        estimatedMinutes: 90, difficultyLevel: 4,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: argTopic.id, name: "Using Evidence & Citations",
        description: "Integrate and cite textual evidence effectively in written responses.",
        learningUrl: "https://www.khanacademy.org/writing",
        estimatedMinutes: 60, difficultyLevel: 3,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: grammarTopic.id, name: "Sentence Structure",
        description: "Identify and correct run-ons, fragments, and complex sentence structures.",
        learningUrl: "https://www.khanacademy.org/humanities/grammar/syntax-sentences-and-clauses",
        estimatedMinutes: 45, difficultyLevel: 2,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: grammarTopic.id, name: "Punctuation & Capitalization",
        description: "Apply correct punctuation (commas, semicolons, apostrophes) and capitalization rules.",
        learningUrl: "https://www.khanacademy.org/humanities/grammar/punctuation-the-colon-semicolon-and-more",
        estimatedMinutes: 40, difficultyLevel: 2,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: grammarTopic.id, name: "Vocabulary in Context",
        description: "Use context clues and word parts to determine the meaning of unfamiliar words.",
        learningUrl: "https://www.khanacademy.org/ela/cc-2nd-reading-vocab",
        estimatedMinutes: 35, difficultyLevel: 2,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: grammarTopic.id, name: "Subject-Verb Agreement",
        description: "Apply subject-verb and pronoun-antecedent agreement rules.",
        learningUrl: "https://www.khanacademy.org/humanities/grammar/parts-of-speech-the-verb",
        estimatedMinutes: 40, difficultyLevel: 2,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: grammarTopic.id, name: "Verb Tense & Modifiers",
        description: "Use consistent verb tenses and correctly place modifiers in sentences.",
        learningUrl: "https://www.khanacademy.org/humanities/grammar/parts-of-speech-the-verb/modal-verbs",
        estimatedMinutes: 40, difficultyLevel: 3,
      },
    }),
  ]);

  // ─── Social Studies (14 total) ────────────────────────────────────────────

  const ssCivCat = await upsertCategory({
    data: { subjectId: ss.id, name: "Civics & Government", weight: 50 },
  });
  const ssUshCat = await upsertCategory({
    data: { subjectId: ss.id, name: "United States History", weight: 20 },
  });
  const ssEconCat = await upsertCategory({
    data: { subjectId: ss.id, name: "Economics", weight: 15 },
  });
  const ssGeoCat = await upsertCategory({
    data: { subjectId: ss.id, name: "Geography & the World", weight: 15 },
  });

  const civTopic = await upsertTopic({
    data: { categoryId: ssCivCat.id, name: "Government & Citizenship" },
  });
  const ushTopic = await upsertTopic({
    data: { categoryId: ssUshCat.id, name: "American History" },
  });
  const econTopic = await upsertTopic({
    data: { categoryId: ssEconCat.id, name: "Economic Principles" },
  });
  const worldGeoTopic = await upsertTopic({
    data: { categoryId: ssGeoCat.id, name: "World Geography & Cultures" },
  });

  await Promise.all([
    upsertSubtopic({
      data: {
        topicId: civTopic.id, name: "US Constitution & Bill of Rights",
        description: "Understand the structure of the US Constitution and the rights it guarantees.",
        learningUrl: "https://www.khanacademy.org/humanities/us-government-and-civics/us-gov-foundations",
        estimatedMinutes: 60, difficultyLevel: 3,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: civTopic.id, name: "Branches of Government",
        description: "Describe the powers and functions of the legislative, executive, and judicial branches.",
        learningUrl: "https://www.khanacademy.org/humanities/us-government-and-civics/us-gov-foundations/us-gov-structure-of-the-constitution",
        estimatedMinutes: 55, difficultyLevel: 2,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: civTopic.id, name: "Elections & Political Participation",
        description: "Explain the electoral process, voting rights, and civic responsibility.",
        learningUrl: "https://www.khanacademy.org/humanities/us-government-and-civics/us-gov-political-participation",
        estimatedMinutes: 45, difficultyLevel: 2,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: civTopic.id, name: "Civil Rights & Liberties",
        description: "Trace the civil rights movement and key legislation protecting individual rights.",
        learningUrl: "https://www.khanacademy.org/humanities/us-government-and-civics/us-gov-civil-liberties-civil-rights",
        estimatedMinutes: 55, difficultyLevel: 3,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: ushTopic.id, name: "American Revolution & Founding",
        description: "Analyze causes and outcomes of the American Revolution and the founding documents.",
        learningUrl: "https://www.khanacademy.org/humanities/us-history/colonial-america/the-american-revolution",
        estimatedMinutes: 60, difficultyLevel: 3,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: ushTopic.id, name: "Civil War & Reconstruction",
        description: "Examine causes, key events, and aftermath of the Civil War and Reconstruction era.",
        learningUrl: "https://www.khanacademy.org/humanities/us-history/civil-war-era",
        estimatedMinutes: 60, difficultyLevel: 3,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: ushTopic.id, name: "World Wars & Modern America",
        description: "Evaluate America's role in WWI, WWII, and the Cold War era.",
        learningUrl: "https://www.khanacademy.org/humanities/us-history/rise-to-world-power",
        estimatedMinutes: 65, difficultyLevel: 3,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: ushTopic.id, name: "Social Movements of the 20th Century",
        description: "Analyse the civil rights, women's rights, and labor movements.",
        learningUrl: "https://www.khanacademy.org/humanities/us-history/postwar-era",
        estimatedMinutes: 50, difficultyLevel: 3,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: econTopic.id, name: "Supply, Demand & Markets",
        description: "Apply supply and demand principles to real-world economic scenarios.",
        learningUrl: "https://www.khanacademy.org/economics-finance-domain/microeconomics/supply-demand-equilibrium",
        estimatedMinutes: 55, difficultyLevel: 3,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: econTopic.id, name: "Personal Finance",
        description: "Understand budgeting, credit, taxes, and basic personal financial planning.",
        learningUrl: "https://www.khanacademy.org/college-careers-more/personal-finance",
        estimatedMinutes: 50, difficultyLevel: 2,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: econTopic.id, name: "Macro & Microeconomics",
        description: "Distinguish macro and microeconomic concepts including GDP, inflation, and competition.",
        learningUrl: "https://www.khanacademy.org/economics-finance-domain/macroeconomics",
        estimatedMinutes: 60, difficultyLevel: 4,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: worldGeoTopic.id, name: "Map Skills & Geographic Tools",
        description: "Read and interpret maps, charts, and geographic data.",
        learningUrl: "https://www.khanacademy.org/humanities/us-history/civil-war-era/slavery-in-the-antebellum-us",
        estimatedMinutes: 40, difficultyLevel: 1,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: worldGeoTopic.id, name: "Human Geography & Migration",
        description: "Examine how geography shapes human societies, culture, and migration patterns.",
        learningUrl: "https://www.khanacademy.org/humanities/world-history",
        estimatedMinutes: 50, difficultyLevel: 2,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: worldGeoTopic.id, name: "Global Interdependence",
        description: "Analyze trade, environmental, and political connections between nations.",
        learningUrl: "https://www.khanacademy.org/humanities/world-history/euro-hist",
        estimatedMinutes: 45, difficultyLevel: 3,
      },
    }),
  ]);

  // ─── Science (14 total) ───────────────────────────────────────────────────

  const sciLifeCat = await upsertCategory({
    data: { subjectId: sci.id, name: "Life Science", weight: 40 },
  });
  const sciPhysCat = await upsertCategory({
    data: { subjectId: sci.id, name: "Physical Science", weight: 40 },
  });
  const sciEarthCat = await upsertCategory({
    data: { subjectId: sci.id, name: "Earth & Space Science", weight: 20 },
  });

  const bioTopic = await upsertTopic({
    data: { categoryId: sciLifeCat.id, name: "Biology & Ecology" },
  });
  const chemTopic = await upsertTopic({
    data: { categoryId: sciPhysCat.id, name: "Chemistry" },
  });
  const physTopic = await upsertTopic({
    data: { categoryId: sciPhysCat.id, name: "Physics" },
  });
  const earthTopic = await upsertTopic({
    data: { categoryId: sciEarthCat.id, name: "Earth & Space" },
  });

  await Promise.all([
    upsertSubtopic({
      data: {
        topicId: bioTopic.id, name: "Cell Biology",
        description: "Identify cell structures and explain cellular processes including mitosis.",
        learningUrl: "https://www.khanacademy.org/science/ap-biology/cell-structure-and-function",
        estimatedMinutes: 60, difficultyLevel: 3,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: bioTopic.id, name: "Genetics & Heredity",
        description: "Explain DNA structure, inheritance, and how traits are passed to offspring.",
        learningUrl: "https://www.khanacademy.org/science/ap-biology/heredity",
        estimatedMinutes: 65, difficultyLevel: 4,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: bioTopic.id, name: "Evolution & Natural Selection",
        description: "Understand the mechanisms of evolution and how species adapt over time.",
        learningUrl: "https://www.khanacademy.org/science/ap-biology/natural-selection",
        estimatedMinutes: 55, difficultyLevel: 3,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: bioTopic.id, name: "Ecosystems & Energy Flow",
        description: "Describe food webs, energy pyramids, and nutrient cycles in ecosystems.",
        learningUrl: "https://www.khanacademy.org/science/ap-biology/ecology-ap",
        estimatedMinutes: 55, difficultyLevel: 3,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: bioTopic.id, name: "Human Body Systems",
        description: "Explain the major human body systems and how they interact.",
        learningUrl: "https://www.khanacademy.org/science/health-and-medicine",
        estimatedMinutes: 70, difficultyLevel: 3,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: chemTopic.id, name: "Atomic Structure & Periodic Table",
        description: "Describe atomic structure and trends in the periodic table.",
        learningUrl: "https://www.khanacademy.org/science/ap-chemistry-beta/x2eef969c74e0d802:atomic-structure-and-properties",
        estimatedMinutes: 60, difficultyLevel: 3,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: chemTopic.id, name: "Chemical Reactions & Bonding",
        description: "Identify types of chemical reactions and explain chemical bonding.",
        learningUrl: "https://www.khanacademy.org/science/ap-chemistry-beta/x2eef969c74e0d802:chemical-bonding",
        estimatedMinutes: 65, difficultyLevel: 4,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: chemTopic.id, name: "States of Matter & Solutions",
        description: "Explain properties of solids, liquids, gases, and solutions.",
        learningUrl: "https://www.khanacademy.org/science/ap-chemistry-beta/x2eef969c74e0d802:intermolecular-forces-and-properties",
        estimatedMinutes: 55, difficultyLevel: 3,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: physTopic.id, name: "Motion & Forces",
        description: "Apply Newton's laws of motion and analyze forces in everyday situations.",
        learningUrl: "https://www.khanacademy.org/science/physics/forces-newtons-laws",
        estimatedMinutes: 60, difficultyLevel: 3,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: physTopic.id, name: "Energy & Work",
        description: "Distinguish kinetic and potential energy and apply the law of conservation of energy.",
        learningUrl: "https://www.khanacademy.org/science/physics/work-and-energy",
        estimatedMinutes: 55, difficultyLevel: 3,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: physTopic.id, name: "Waves, Light & Sound",
        description: "Describe wave properties, the electromagnetic spectrum, and sound.",
        learningUrl: "https://www.khanacademy.org/science/physics/mechanical-waves-and-sound",
        estimatedMinutes: 55, difficultyLevel: 3,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: earthTopic.id, name: "Earth's Structure & Plate Tectonics",
        description: "Describe Earth's layers and explain plate tectonic theory and its effects.",
        learningUrl: "https://www.khanacademy.org/science/cosmology-and-astronomy/earth-history-lesson",
        estimatedMinutes: 55, difficultyLevel: 2,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: earthTopic.id, name: "Weather, Climate & Atmosphere",
        description: "Explain weather patterns, climate change, and atmospheric science.",
        learningUrl: "https://www.khanacademy.org/science/earth-and-space-science/earth-and-space-topic",
        estimatedMinutes: 50, difficultyLevel: 2,
      },
    }),
    upsertSubtopic({
      data: {
        topicId: earthTopic.id, name: "Astronomy & the Universe",
        description: "Describe the solar system, stars, and the scale and origin of the universe.",
        learningUrl: "https://www.khanacademy.org/science/cosmology-and-astronomy",
        estimatedMinutes: 50, difficultyLevel: 2,
      },
    }),
  ]);

  // ─── Seed subtopic prerequisites ─────────────────────────────────────────

  const prereqPairs: Array<[string, string]> = [
    // MATH — names follow prisma/curriculum.data.ts.
    ["Decimals", "Fractions"],
    ["Ratios", "Fractions"],
    ["Percentages", "Ratios"],
    ["Proportions", "Ratios"],
    ["Exponents & roots", "Positive & negative numbers"],
    ["Scientific notation", "Exponents & roots"],
    ["Variables & expressions", "Positive & negative numbers"],
    ["Solving equations & inequalities", "Variables & expressions"],
    ["Systems of equations", "Solving equations & inequalities"],
    ["Slope & linear functions", "Solving equations & inequalities"],
    ["Quadratic functions", "Exponents & roots"],
    ["Surface area & volume", "Area & perimeter"],
    ["Circles", "Area & perimeter"],
    ["Pythagorean theorem", "Area & perimeter"],
    ["Dot plots, histograms & box plots", "Mean, median, mode, range"],
    ["Probability", "Mean, median, mode, range"],
    ["Scatter plots", "Slope & linear functions"],
    // RLA
    ["Author's Purpose & Point of View", "Main Idea & Supporting Details"],
    ["Argument Analysis", "Author's Purpose & Point of View"],
    ["Figurative Language & Tone", "Reading Fiction"],
    ["Comparing Texts", "Reading Fiction"],
    ["Writing an Argument Essay", "Argument Analysis"],
    ["Using Evidence & Citations", "Argument Analysis"],
    ["Verb Tense & Modifiers", "Subject-Verb Agreement"],
    // SS
    ["Branches of Government", "US Constitution & Bill of Rights"],
    ["Civil Rights & Liberties", "US Constitution & Bill of Rights"],
    ["Civil War & Reconstruction", "American Revolution & Founding"],
    ["World Wars & Modern America", "Civil War & Reconstruction"],
    ["Social Movements of the 20th Century", "World Wars & Modern America"],
    ["Macro & Microeconomics", "Supply, Demand & Markets"],
    // SCI
    ["Genetics & Heredity", "Cell Biology"],
    ["Evolution & Natural Selection", "Genetics & Heredity"],
    ["Ecosystems & Energy Flow", "Cell Biology"],
    ["Chemical Reactions & Bonding", "Atomic Structure & Periodic Table"],
    ["States of Matter & Solutions", "Atomic Structure & Periodic Table"],
    ["Energy & Work", "Motion & Forces"],
    ["Waves, Light & Sound", "Motion & Forces"],
    ["Weather, Climate & Atmosphere", "Earth's Structure & Plate Tectonics"],
  ];

  const prereqData: Array<{ dependentId: string; prerequisiteId: string }> = [];
  for (const [subtopicName, prereqName] of prereqPairs) {
    const subtopic = await prisma.subtopic.findFirst({ where: { name: subtopicName } });
    const prereq = await prisma.subtopic.findFirst({ where: { name: prereqName } });
    if (!subtopic) {
      console.warn(`Warning: subtopic "${subtopicName}" not found, skipping prerequisite pair.`);
      continue;
    }
    if (!prereq) {
      console.warn(`Warning: prerequisite subtopic "${prereqName}" not found, skipping prerequisite pair.`);
      continue;
    }
    prereqData.push({ dependentId: subtopic.id, prerequisiteId: prereq.id });
  }
  await prisma.subtopicPrerequisite.createMany({ data: prereqData, skipDuplicates: true });
  console.log(`Prerequisite pairs created: ${prereqData.length}`);

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
      },
    });

    for (let i = 0; i < selected.length; i++) {
      const subtopic = selected[i];
      const q = getSeedQuestion(subtopic.name, i);
      await prisma.question.create({
        data: {
          assessmentId: assessment.id,
          subtopicId: subtopic.id,
          ...q,
          explanation: `This tests your understanding of ${subtopic.name}.`,
          source: "AI_GENERATED",
          difficulty: subtopic.difficultyLevel,
        },
      });
    }
  }

  // ─── Seed MOCK assessments (separate from PRE) ─────────────────────────────
  console.log("Seeding MOCK assessments...");

  for (const subject of [math, rla, ss, sci]) {
    const subjectSubtopics = allSubtopics.filter(
      (s: typeof allSubtopics[0]) => s.topic.category.subjectId === subject.id
    );
    const mockSubtopics = subjectSubtopics.length >= 10
      ? subjectSubtopics.slice(Math.min(5, subjectSubtopics.length - 10), Math.min(15, subjectSubtopics.length))
      : subjectSubtopics;

    const mockAssessment = await prisma.assessment.create({
      data: {
        type: "MOCK",
        subjectId: subject.id,
        title: `${subject.name} Mock Test`,
      },
    });

    for (let i = 0; i < Math.min(10, mockSubtopics.length); i++) {
      const subtopic = mockSubtopics[i];
      const q = getSeedQuestion(subtopic.name, i + 10);
      await prisma.question.create({
        data: {
          assessmentId: mockAssessment.id,
          subtopicId: subtopic.id,
          ...q,
          explanation: `This tests your understanding of ${subtopic.name}.`,
          source: "AI_GENERATED",
          difficulty: subtopic.difficultyLevel,
        },
      });
    }
  }

  await reportOrphans();

  console.log("Seeding complete!");
  console.log(`Subjects: 4`);
  console.log(`Subtopics: ${allSubtopics.length}`);
}

/**
 * Names what the seed no longer describes, without deleting it.
 *
 * A subtopic dropped from the curriculum — or renamed, which looks the same
 * from here — still has learner progress, study sessions and resources attached.
 * Removing it is a decision about someone's data, so the seed reports it and
 * leaves it alone rather than cascading through it at 2am.
 */
async function reportOrphans() {
  const stale = await prisma.subtopic.findMany({
    where: { id: { notIn: [...seen.subtopics] } },
    select: { name: true, topic: { select: { name: true } } },
  });
  if (!stale.length) return;

  console.log(`
${stale.length} subtopic(s) in the database are no longer in the seed:`);
  for (const s of stale) console.log(`  - ${s.topic.name} / ${s.name}`);
  console.log("  Left in place — they may still hold learner progress. Remove them deliberately.");
}

const OPTION_IDS = ["A", "B", "C", "D"] as const;

function getSeedQuestion(topicName: string, questionIndex: number) {
  const correctIndex = questionIndex % 4;
  const correctOptionId = OPTION_IDS[correctIndex];
  const distractors = [
    `An incorrect application of ${topicName} principles`,
    `A common misconception about ${topicName}`,
    `An unrelated concept often confused with ${topicName}`,
  ];
  let distractorIdx = 0;
  const options = OPTION_IDS.map((id, i) => ({
    id,
    text: i === correctIndex
      ? `The foundational principle of ${topicName} applied correctly`
      : distractors[distractorIdx++],
  }));
  return {
    text: `Which of the following best describes the core concept of "${topicName}"?`,
    options,
    correctOptionId,
  };
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

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
 * Clears only what this seed rebuilds wholesale: the prerequisite pairs, which
 * are re-derived below from subtopic names and carry no learner data.
 *
 * Assessments are deliberately NOT cleared any more. Deleting them took every
 * attempt and response with them, and since sign-in routing sends anyone with
 * no PRE attempt for a selected subject back to /pre-assessment, a single seed
 * run pushed every existing user back through it. Assessments are now created
 * only when a subject has none — see ensureAssessment().
 */
async function resetGeneratedContent() {
  await prisma.subtopicPrerequisite.deleteMany();
  console.log("Cleared prerequisites (curriculum and assessments kept).");
}

/**
 * Creates a subject's PRE or MOCK assessment only if it does not have one yet.
 *
 * Never rewrites an existing one: its questions are what learners' attempts and
 * responses point at, so replacing them would orphan that history. Changing the
 * question content is a migration, not a re-seed.
 */
async function ensureAssessment(
  type: "PRE" | "MOCK",
  subject: { id: string; name: string },
  title: string,
  questions: Array<{ subtopic: { id: string; name: string; difficultyLevel: number }; index: number }>
) {
  const existing = await prisma.assessment.findFirst({
    where: { type, subjectId: subject.id },
    select: { id: true },
  });
  if (existing) {
    console.log(`  ${type} ${subject.name}: exists, left untouched`);
    return;
  }

  const assessment = await prisma.assessment.create({
    data: { type, subjectId: subject.id, title },
  });
  for (const { subtopic, index } of questions) {
    const q = getSeedQuestion(subtopic.name, index);
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
  console.log(`  ${type} ${subject.name}: created with ${questions.length} question(s)`);
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
  // as their sheet arrives. MATH, SS and SCI have; RLA hasn't yet.

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
    // SS and SCI — names follow scripts/curriculum/plan.ts. DRAFT pairs written
    // by Claude on 2026-09-27 for the team to review.
    // SS
    ["Branches of government", "Types of Government & Constitutional Principles"],
    ["Bill of Rights & amendments", "Founding Documents"],
    ["Civil War & Reconstruction", "Colonial America + Revolutionary Era"],
    ["World Wars I & II", "Civil War & Reconstruction"],
    ["Cold War", "World Wars I & II"],
    ["Foreign Policy after 9/11", "Cold War"],
    ["Fiscal policy & government spending", "GDP/inflation/unemployment"],
    // SCI
    ["Cellular Respiration", "Cell Parts and Their Functions"],
    ["Photosynthesis", "Cell Parts and Their Functions"],
    ["Mitosis & Meiosis", "Cell Theory"],
    ["DNA & Heredity", "Mitosis & Meiosis"],
    ["Evolution & Natural Selection", "DNA & Heredity"],
    ["Homeostasis", "Human Body Systems"],
    ["Carrying Capacity", "Food Webs & Energy Flow"],
    ["Human Impact on the Environment", "Food Webs & Energy Flow"],
    ["Chemical Equations & Energy Changes", "Atomic Structure & Properties of Matter"],
    ["Solutions & Solubility", "States of Matter"],
    ["Work & Simple Machines", "Motion & Newton's Laws"],
    ["Types & Transformations of Energy", "Motion & Newton's Laws"],
    ["Energy Sources", "Types & Transformations of Energy"],
    ["Heat & Heat Transfer", "Types & Transformations of Energy"],
    ["Light", "Waves & Sound"],
    ["Natural Hazards", "Plate Tectonics, Volcanoes & Earthquakes"],
  ];

  const prereqData: Array<{ dependentId: string; prerequisiteId: string }> = [];
  for (const [subtopicName, prereqName] of prereqPairs) {
    // Only among subtopics this run wrote: a retired subtopic can share a name
    // with its replacement ("Civil War & Reconstruction" is both an old SS row
    // and a new one) until it is removed, and must not collect new pairs.
    const current = { id: { in: [...seen.subtopics] } };
    const subtopic = await prisma.subtopic.findFirst({ where: { name: subtopicName, ...current } });
    const prereq = await prisma.subtopic.findFirst({ where: { name: prereqName, ...current } });
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

  // PRE: 10 questions per subject, from its first ten subtopics.
  for (const subject of [math, rla, ss, sci]) {
    const subjectSubtopics = allSubtopics.filter(
      (s: typeof allSubtopics[0]) => s.topic.category.subjectId === subject.id
    );
    await ensureAssessment(
      "PRE",
      subject,
      `${subject.name} Pre-Assessment`,
      subjectSubtopics.slice(0, 10).map((subtopic, index) => ({ subtopic, index }))
    );
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

    await ensureAssessment(
      "MOCK",
      subject,
      `${subject.name} Mock Test`,
      mockSubtopics.slice(0, 10).map((subtopic, i) => ({ subtopic, index: i + 10 }))
    );
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

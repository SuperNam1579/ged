/**
 * Removes subtopics that the curriculum sheets no longer describe, with
 * everything that points at them.
 *
 *   npx tsx scripts/db/retire-subtopics.ts            # dry run: counts only
 *   npx tsx scripts/db/retire-subtopics.ts --apply    # delete
 *
 * Only subjects present in prisma/curriculum.data.ts are touched (today MATH,
 * SS, SCI); RLA's hand-written subtopics are left alone. A subtopic is "current"
 * when its full path — subject › category › topic › name — is in that file, so a
 * retired row that shares a name with its replacement is still told apart.
 *
 * The seed only reports these rows; it never deletes them, because a subtopic
 * can carry learner progress and removing it is a decision about someone's
 * data. This script is that decision, made explicitly. It also removes the
 * subject's PRE and MOCK assessments when their questions point at retired
 * subtopics, so that the next `npx tsx prisma/seed.ts` rebuilds them against the
 * current ones — run the seed afterwards.
 */

import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { assertDatabaseWriteAllowed } from "./guard";

const db = new PrismaClient();

type Data = {
  code: string;
  categories: { name: string; topics: { name: string; subtopics: { name: string }[] }[] }[];
}[];

async function main() {
  const apply = process.argv.includes("--apply");
  const { CURRICULUM } = (await import(pathToFileURL(resolve("prisma/curriculum.data.ts")).href)) as {
    CURRICULUM: Data;
  };
  const codes = CURRICULUM.map((s) => s.code);
  const key = (...parts: string[]) => parts.join("\u0000");

  const current = new Set<string>();
  for (const s of CURRICULUM)
    for (const c of s.categories)
      for (const t of c.topics) for (const st of t.subtopics) current.add(key(s.code, c.name, t.name, st.name));

  const rows = await db.subtopic.findMany({
    where: { topic: { category: { subject: { code: { in: codes } } } } },
    select: {
      id: true,
      name: true,
      topic: { select: { name: true, category: { select: { name: true, subject: { select: { code: true } } } } } },
    },
  });
  const retired = rows.filter(
    (s) => !current.has(key(s.topic.category.subject.code, s.topic.category.name, s.topic.name, s.name))
  );
  const ids = retired.map((s) => s.id);

  // A missing current subtopic means the seed hasn't run since the sheets
  // changed; deleting now would leave the subject with nothing.
  const liveCount = rows.length - retired.length;
  if (liveCount !== current.size) {
    throw new Error(`Expected ${current.size} current subtopics in the database, found ${liveCount}. Run prisma/seed.ts first.`);
  }

  // Assessments built on retired subtopics: every QUIZ for one, and a
  // subject's PRE/MOCK if any of its questions points at one.
  const assessments = await db.assessment.findMany({
    where: {
      OR: [
        { type: "QUIZ", subtopicId: { in: ids } },
        { type: { in: ["PRE", "MOCK"] }, questions: { some: { subtopicId: { in: ids } } } },
      ],
    },
    select: { id: true },
  });
  const aIds = assessments.map((a) => a.id);
  const attempts = await db.userAssessmentAttempt.findMany({ where: { assessmentId: { in: aIds } }, select: { id: true } });
  const tIds = attempts.map((a) => a.id);

  const counts = {
    subtopics: ids.length,
    assessments: aIds.length,
    attempts: tIds.length,
    questions: await db.question.count({ where: { assessmentId: { in: aIds } } }),
    otherQuestions: await db.question.count({ where: { subtopicId: { in: ids }, assessmentId: { notIn: aIds } } }),
    studySessions: await db.studySession.count({ where: { subtopicId: { in: ids } } }),
    proficiencies: await db.userSubtopicProficiency.count({ where: { subtopicId: { in: ids } } }),
  };

  for (const s of retired) console.log(`  - [${s.topic.category.subject.code}] ${s.topic.name} / ${s.name}`);
  console.log(JSON.stringify(counts));
  if (counts.otherQuestions) throw new Error("Questions outside these assessments point at retired subtopics — look before deleting.");
  if (!ids.length) return console.log("Nothing to retire.");
  if (!apply) return console.log("Dry run. Re-run with --apply to delete, then run prisma/seed.ts.");
  assertDatabaseWriteAllowed("retire subtopics");

  await db.$transaction([
    db.userQuestionResponse.deleteMany({ where: { attemptId: { in: tIds } } }),
    db.userAssessmentAttempt.deleteMany({ where: { id: { in: tIds } } }),
    db.question.deleteMany({ where: { assessmentId: { in: aIds } } }),
    db.assessment.deleteMany({ where: { id: { in: aIds } } }),
    db.studySession.deleteMany({ where: { subtopicId: { in: ids } } }),
    db.userSubtopicProficiency.deleteMany({ where: { subtopicId: { in: ids } } }),
    // Resources, units, lessons, prerequisites and watch progress cascade.
    db.subtopic.deleteMany({ where: { id: { in: ids } } }),
    db.topic.deleteMany({ where: { category: { subject: { code: { in: codes } } }, subtopics: { none: {} } } }),
    db.category.deleteMany({ where: { subject: { code: { in: codes } }, topics: { none: {} } } }),
  ]);
  console.log(`Retired ${ids.length} subtopic(s). Now run: npx tsx prisma/seed.ts`);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

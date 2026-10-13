/**
 * Moves subtopics into the category and topic the curriculum now puts them in,
 * keeping their rows — and with them every session, quiz attempt, proficiency
 * and watch-progress row that points at them.
 *
 *   npx tsx scripts/db/regroup-subtopics.ts            # dry run: what would happen
 *   npx tsx scripts/db/regroup-subtopics.ts --apply    # do it
 *
 * Why: the seed finds a subtopic by its parent topic and name, so when the
 * sheets move a subtopic to another topic it creates a new, empty row there and
 * leaves the old one, with all the learner data, where it was. Retiring the old
 * one then deletes that data (plans lose their sessions). Run this BEFORE
 * `prisma/seed.ts` after regrouping plan.ts: the seed then finds every subtopic
 * already in place and creates nothing.
 *
 * Run after the seed already made duplicates, it settles them: of the rows
 * sharing a subject and name, the one holding learner data is kept and moved to
 * the planned place; the others are deleted, but only when they hold no learner
 * data. Two rows that both hold data are reported and left alone.
 *
 * Topics and categories left empty are removed. Then run, in order:
 *   npx tsx prisma/seed.ts
 *   npx tsx scripts/import-curriculum.ts --resources
 */

import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { assertDatabaseWriteAllowed } from "./guard";

const db = new PrismaClient();

type Data = {
  code: string;
  categories: { name: string; weight: number; topics: { name: string; subtopics: { name: string }[] }[] }[];
}[];

type Row = { id: string; name: string; topicName: string; categoryName: string };

/** How much learner data points at a subtopic. 0 = safe to delete. */
async function learnerData(subtopicId: string): Promise<number> {
  const [sessions, proficiencies, attempts, progress] = await Promise.all([
    db.studySession.count({ where: { subtopicId } }),
    db.userSubtopicProficiency.count({ where: { subtopicId } }),
    db.userAssessmentAttempt.count({ where: { assessment: { type: "QUIZ", subtopicId } } }),
    db.userResourceProgress.count({ where: { resource: { subtopicId } } }),
  ]);
  return sessions + proficiencies + attempts + progress;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { CURRICULUM } = (await import(pathToFileURL(resolve("prisma/curriculum.data.ts")).href)) as {
    CURRICULUM: Data;
  };

  const moves: { row: Row; to: { category: string; weight: number; topic: string }; code: string }[] = [];
  const deletes: { row: Row; code: string }[] = [];
  const conflicts: string[] = [];

  for (const subject of CURRICULUM) {
    const rows: Row[] = (
      await db.subtopic.findMany({
        where: { topic: { category: { subject: { code: subject.code } } } },
        select: { id: true, name: true, topic: { select: { name: true, category: { select: { name: true } } } } },
      })
    ).map((r) => ({ id: r.id, name: r.name, topicName: r.topic.name, categoryName: r.topic.category.name }));

    for (const c of subject.categories)
      for (const t of c.topics)
        for (const st of t.subtopics) {
          const same = rows.filter((r) => r.name === st.name);
          const placed = (r: Row) => r.categoryName === c.name && r.topicName === t.name;
          if (same.length === 0 || (same.length === 1 && placed(same[0]))) continue;

          const withData = await Promise.all(same.map(async (r) => ({ r, data: await learnerData(r.id) })));
          const holders = withData.filter((x) => x.data > 0);
          if (holders.length > 1) {
            conflicts.push(`[${subject.code}] ${st.name}: ${holders.length} rows hold learner data — merge by hand`);
            continue;
          }
          // Keep the row with learner data; with none, the one already in place.
          const keep = holders[0]?.r ?? same.find(placed) ?? same[0];
          for (const { r } of withData) if (r.id !== keep.id) deletes.push({ row: r, code: subject.code });
          if (!placed(keep)) moves.push({ row: keep, to: { category: c.name, weight: c.weight, topic: t.name }, code: subject.code });
        }
  }

  for (const m of moves)
    console.log(`  move   [${m.code}] ${m.row.categoryName} / ${m.row.topicName} / ${m.row.name}  →  ${m.to.category} / ${m.to.topic}`);
  for (const d of deletes)
    console.log(`  delete [${d.code}] ${d.row.categoryName} / ${d.row.topicName} / ${d.row.name}  (empty duplicate)`);
  for (const c of conflicts) console.log(`  !! ${c}`);
  console.log(JSON.stringify({ moves: moves.length, deletes: deletes.length, conflicts: conflicts.length }));

  if (!moves.length && !deletes.length) return console.log("Nothing to regroup.");
  if (!apply) return console.log("Dry run. Re-run with --apply, then run prisma/seed.ts and import-curriculum.ts --resources.");
  assertDatabaseWriteAllowed("regroup subtopics");

  // Duplicates first, so a moved row never meets one with its name in its new topic.
  const dupIds = deletes.map((d) => d.row.id);
  if (dupIds.length) {
    const quizzes = (await db.assessment.findMany({ where: { type: "QUIZ", subtopicId: { in: dupIds } }, select: { id: true } })).map((a) => a.id);
    await db.$transaction([
      db.question.deleteMany({ where: { assessmentId: { in: quizzes } } }),
      db.assessment.deleteMany({ where: { id: { in: quizzes } } }),
      // A PRE/MOCK question about the duplicate asks about the kept row instead.
      ...deletes.map((d) => {
        const kept = moves.find((m) => m.row.name === d.row.name && m.code === d.code)?.row.id;
        return kept
          ? db.question.updateMany({ where: { subtopicId: d.row.id }, data: { subtopicId: kept } })
          : db.question.updateMany({ where: { subtopicId: d.row.id }, data: { subtopicId: null } });
      }),
      // Resources, units, lessons and prerequisites cascade.
      db.subtopic.deleteMany({ where: { id: { in: dupIds } } }),
    ]);
  }

  for (const m of moves) {
    const subject = await db.subject.findUniqueOrThrow({ where: { code: m.code }, select: { id: true } });
    const category = await db.category.upsert({
      where: { subjectId_name: { subjectId: subject.id, name: m.to.category } },
      create: { subjectId: subject.id, name: m.to.category, weight: m.to.weight },
      update: {},
      select: { id: true },
    });
    const topic = await db.topic.upsert({
      where: { categoryId_name: { categoryId: category.id, name: m.to.topic } },
      create: { categoryId: category.id, name: m.to.topic },
      update: {},
      select: { id: true },
    });
    await db.subtopic.update({ where: { id: m.row.id }, data: { topicId: topic.id } });
  }

  const codes = CURRICULUM.map((s) => s.code);
  await db.topic.deleteMany({ where: { category: { subject: { code: { in: codes } } }, subtopics: { none: {} } } });
  await db.category.deleteMany({ where: { subject: { code: { in: codes } }, topics: { none: {} } } });
  console.log(`Moved ${moves.length}, deleted ${deletes.length} empty duplicate(s). Now run prisma/seed.ts, then import-curriculum.ts --resources.`);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

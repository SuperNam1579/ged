/**
 * Prints every covered subtopic next to the clips assigned to it.
 *
 *   npx tsx scripts/audit-resources.ts             # everything
 *   npx tsx scripts/audit-resources.ts --full      # every clip, not just the first five
 *   npx tsx scripts/audit-resources.ts --subject MATH
 *   npx tsx scripts/audit-resources.ts "Ratios"    # one subtopic, in full
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * Matching a Khan playlist to a subtopic gets the subject right and the scope
 * wrong. "Descriptive statistics" is the correct unit for Data Analysis &
 * Central Tendency and still arrives carrying variance, standard deviation and
 * sampling theory; "Finance and Capital Markets" is where Khan files personal
 * finance and it opens with discounted cash flow. Neither mistake is visible
 * from the playlist title, only from reading what came back.
 *
 * The `description` column is the authority on scope — it is a sentence written
 * for this curriculum, e.g. "Calculate mean, median, mode, and interpret data
 * displays" — so it is printed directly above the clips. Anything in the list
 * that the sentence does not cover is a TOPIC_FILTERS entry waiting to be
 * written in scripts/fetch-resources.ts, after which `--refilter` applies it
 * without spending any API quota.
 */

import { PrismaClient } from "@prisma/client";
import { RESOURCES } from "../src/lib/resources/fixture.data";

const db = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const subject = arg("subject");
  const full = process.argv.includes("--full");
  const search = process.argv.slice(2).find((a) => !a.startsWith("--") && a !== subject);

  const subs = await db.subtopic.findMany({
    where: {
      ...(subject ? { topic: { category: { subject: { code: subject } } } } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      estimatedMinutes: true,
      topic: { select: { category: { select: { subject: { select: { code: true } } } } } },
    },
    orderBy: [{ topic: { category: { subject: { code: "asc" } } } }, { name: "asc" }],
  });

  const byId = new Map<string, typeof RESOURCES>();
  for (const r of RESOURCES) {
    const list = byId.get(r.subtopicId) ?? [];
    list.push(r);
    byId.set(r.subtopicId, list);
  }

  // A single named subtopic is always shown in full — that is the point of
  // asking for one.
  const showAll = full || Boolean(search);
  let covered = 0;
  const empty: string[] = [];

  for (const s of subs) {
    const rows = (byId.get(s.id) ?? []).sort((a, b) => a.order - b.order);
    const code = s.topic.category.subject.code;

    if (!rows.length) {
      empty.push(`[${code}] ${s.name}`);
      continue;
    }
    covered++;

    const mins = Math.round(rows.reduce((t, r) => t + r.durationSec, 0) / 60);
    console.log(
      `\n[${code}] ${s.name} — ${rows.length} clips, ${mins} min (planner says ${s.estimatedMinutes})`
    );
    console.log(`   scope: ${s.description}`);

    const shown = showAll ? rows : rows.slice(0, 5);
    for (const r of shown) {
      const m = `${Math.floor(r.durationSec / 60)}:${String(r.durationSec % 60).padStart(2, "0")}`;
      console.log(`     [${m.padStart(5)}] ${r.title.split("|")[0].trim()}`);
    }
    if (!showAll && rows.length > 5) console.log(`     … +${rows.length - 5} more`);
  }

  console.log(`\n${"─".repeat(70)}`);
  console.log(`${covered} subtopic(s) covered, ${empty.length} empty`);
  if (empty.length) {
    console.log("\nEMPTY");
    empty.forEach((e) => console.log(`  ${e}`));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

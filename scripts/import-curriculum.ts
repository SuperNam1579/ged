/**
 * Turns the hand-built curriculum CSVs into seedable curriculum data.
 *
 *   npx tsx scripts/import-curriculum.ts             # all subjects in the plan
 *   npx tsx scripts/import-curriculum.ts --subject MATH
 *   npx tsx scripts/import-curriculum.ts --dry-run   # validate only, no network
 *   npx tsx scripts/import-curriculum.ts --resources # step 3, after seeding
 *
 * ── The three steps ───────────────────────────────────────────────────────
 * Subtopic IDs are cuids minted by the database and resource IDs are derived
 * from them, so the clips cannot be written until the subtopic rows exist:
 *
 *   1. this script              curriculum/*.csv  →  prisma/curriculum.data.ts
 *   2. npx tsx prisma/seed.ts   prisma/curriculum.data.ts  →  Subject/…/Subtopic
 *   3. this script --resources  database + (1)   →  Resource
 *
 * Step 1 is where every YouTube call happens. Steps 2 and 3 are offline, so
 * re-seeding a wiped database costs no quota.
 *
 * ── What it checks, and why ───────────────────────────────────────────────
 * A clip can look perfect in the spreadsheet and still be useless to us. It may
 * have embedding disabled, be private or region-locked, or have been taken down
 * since the row was written — all of which play fine on youtube.com and fail
 * with player error 101/150 inside our iframe, where the learner sees a black
 * box and assumes the site is broken. `status.embeddable` is the only way to
 * know in advance, so every ID is verified before it is written down.
 *
 * The plan in scripts/curriculum/plan.ts is checked just as strictly: a
 * `dropClips` entry that matches nothing is a typo, and a typo in a cut list is
 * invisible — the clip simply stays in the curriculum and nobody notices. Every
 * rule must earn its keep by matching at least one row, or the run fails.
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseIsoDuration } from "../src/lib/youtube/duration";
import { PLANS, type SubjectPlan, type SubtopicPlan } from "./curriculum/plan";
import { saveSubtopicResources } from "./lib/resources";

process.loadEnvFile(resolve(process.cwd(), ".env"));

const API_KEY = process.env.YOUTUBE_API_KEY;
const CURRICULUM_DIR = resolve(process.cwd(), "curriculum");
const DATA_PATH = resolve(process.cwd(), "prisma/curriculum.data.ts");

const db = new PrismaClient();

// ─── CSV ────────────────────────────────────────────────────────────────────

/**
 * Minimal RFC-4180 reader.
 *
 * The files come out of Google Sheets, so quoted fields containing commas,
 * newlines and doubled quotes all occur; anything simpler than this mangles the
 * `หมายเหตุ` column, which is full of commas.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;

  const src = text.replace(/^﻿/, "").replace(/\r\n/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += c;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

interface CsvRow {
  line: number;
  subtopic: string;
  unit: string;
  lesson: string;
  clip: string;
  url: string;
  note: string;
}

/**
 * Reads one subject's CSV into flat rows.
 *
 * The sheet is written the way a person reads it: the subtopic, unit and lesson
 * cells are filled in on the first row of each run and left blank underneath.
 * Blank therefore means "same as above", not "missing", and is carried down.
 */
function readSubjectCsv(code: string): CsvRow[] {
  const path = resolve(CURRICULUM_DIR, `${code}.csv`);
  if (!existsSync(path)) {
    throw new Error(`No CSV for ${code} — expected ${path}`);
  }

  const rows = parseCsv(readFileSync(path, "utf8"));
  // Row 0 is a human title banner, row 1 is the header.
  const body = rows.slice(2);

  const out: CsvRow[] = [];
  let subtopic = "";
  let unit = "";
  let lesson = "";

  for (const [i, r] of body.entries()) {
    const [s, u, l, clip, url, note] = r.map((x) => (x ?? "").trim());
    if (s) subtopic = s;
    if (u) unit = u;
    if (l) lesson = l;
    // Spacer rows between units carry nothing but the inherited values.
    if (!clip && !url) continue;
    out.push({ line: i + 3, subtopic, unit, lesson, clip, url, note });
  }
  return out;
}

/** The 11-character video ID, from any of the URL shapes people paste. */
function videoId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ─── Plan application ───────────────────────────────────────────────────────

interface PlannedClip {
  youtubeId: string;
  /** Title as written in the sheet. Replaced by the real one after hydration. */
  csvTitle: string;
  unit: string;
  lesson: string;
  line: number;
}

interface PlannedSubtopic {
  name: string;
  description: string;
  difficulty: number;
  learningUrl: string;
  clips: PlannedClip[];
}

interface Problem {
  kind: string;
  detail: string;
}

/**
 * Khan does not publish a stable per-unit URL we can derive from a name, and
 * the sheet does not carry one. A search landing page is honest about that: it
 * puts the learner on Khan with the right query rather than guessing a slug
 * that 404s.
 */
function khanSearchUrl(name: string): string {
  return `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(name)}`;
}

function applyPlan(
  plan: SubjectPlan,
  rows: CsvRow[],
  problems: Problem[]
): Map<string, PlannedSubtopic> {
  const bySubtopic = new Map<string, CsvRow[]>();
  for (const r of rows) {
    if (!bySubtopic.has(r.subtopic)) bySubtopic.set(r.subtopic, []);
    bySubtopic.get(r.subtopic)!.push(r);
  }

  const planned = new Map<string, PlannedSubtopic>();
  const claimed = new Set<string>();

  for (const cat of plan.categories) {
    for (const topic of cat.topics) {
      for (const sp of topic.subtopics) {
        const sources = [sp.csv, ...(sp.merge ?? [])];
        const raw: CsvRow[] = [];

        for (const src of sources) {
          const found = bySubtopic.get(src);
          if (!found) {
            problems.push({
              kind: "plan",
              detail: `subtopic "${src}" is in the plan but not in ${plan.code}.csv`,
            });
            continue;
          }
          claimed.add(src);
          raw.push(...found);
        }

        planned.set(sp.csv, {
          name: sp.name ?? sp.csv,
          description: sp.description,
          difficulty: sp.difficulty,
          learningUrl: khanSearchUrl(sp.name ?? sp.csv),
          clips: cut(sp, raw, plan.code, problems),
        });
      }
    }
  }

  // A subtopic in the sheet that no plan entry claims would silently vanish
  // from the curriculum. Louder to fail than to quietly drop 91 clips.
  for (const name of bySubtopic.keys()) {
    if (!claimed.has(name)) {
      problems.push({
        kind: "plan",
        detail: `subtopic "${name}" is in ${plan.code}.csv but no plan entry claims it`,
      });
    }
  }

  return planned;
}

/** Applies the cut rules, then drops unusable and repeated rows. */
function cut(
  sp: SubtopicPlan,
  raw: CsvRow[],
  code: string,
  problems: Problem[]
): PlannedClip[] {
  const dropLessons = new Set(sp.dropLessons ?? []);
  const dropClips = new Set(sp.dropClips ?? []);
  const keepClips = new Set(sp.keepClips ?? []);

  const usedLesson = new Set<string>();
  const usedClip = new Set<string>();
  const usedKeep = new Set<string>();

  const out: PlannedClip[] = [];
  const seen = new Set<string>();

  for (const r of raw) {
    if (dropLessons.has(r.lesson)) {
      usedLesson.add(r.lesson);
      if (!keepClips.has(r.clip)) continue;
      usedKeep.add(r.clip);
    }
    if (dropClips.has(r.clip)) {
      usedClip.add(r.clip);
      continue;
    }

    const id = videoId(r.url);
    if (!id) {
      // Khan files some exercises as downloadable worksheets or articles. They
      // are real material and simply not videos, so there is nothing for the
      // player to load — recorded, then skipped.
      problems.push({
        kind: "no-video",
        detail: `${code} L${r.line} [${sp.csv}] ${r.clip} — ${JSON.stringify(r.url)}`,
      });
      continue;
    }

    // The same clip listed twice inside one subtopic is a copy-paste artefact.
    // Across subtopics it is deliberate (exponent rules genuinely serve both
    // "Exponents & roots" and "Quadratic functions") and is left alone.
    if (seen.has(id)) continue;
    seen.add(id);

    out.push({ youtubeId: id, csvTitle: r.clip, unit: r.unit, lesson: r.lesson, line: r.line });
  }

  // A cut rule matching nothing is a typo, and a typo here is invisible: the
  // clip stays in the curriculum and the run still looks like it worked.
  for (const l of dropLessons) {
    if (!usedLesson.has(l)) {
      problems.push({ kind: "plan", detail: `${code} [${sp.csv}] dropLessons "${l}" matched no row` });
    }
  }
  for (const c of dropClips) {
    if (!usedClip.has(c)) {
      problems.push({ kind: "plan", detail: `${code} [${sp.csv}] dropClips "${c}" matched no row` });
    }
  }
  for (const c of keepClips) {
    if (!usedKeep.has(c)) {
      problems.push({ kind: "plan", detail: `${code} [${sp.csv}] keepClips "${c}" matched no dropped row` });
    }
  }

  return out;
}

// ─── YouTube ────────────────────────────────────────────────────────────────

interface YtVideoItem {
  id: string;
  snippet: { title: string; channelTitle: string };
  contentDetails: { duration: string };
  status: { embeddable: boolean; privacyStatus: string };
}

/**
 * videos.list costs 1 quota unit per call and takes 50 IDs at a time, so the
 * whole curriculum costs roughly a tenth of a percent of the daily allowance.
 * Discovery — search.list, at 100 units a query — is not needed at all here:
 * every ID was chosen by a person and written down.
 */
async function hydrate(ids: string[]): Promise<Map<string, YtVideoItem>> {
  const out = new Map<string, YtVideoItem>();

  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,contentDetails,status");
    url.searchParams.set("id", batch.join(","));
    url.searchParams.set("key", API_KEY!);

    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      if ((res.status === 429 || res.status === 403) && body.includes("uota")) {
        throw new Error(
          "YouTube API daily quota exhausted. It resets at midnight Pacific; " +
            "nothing on disk was touched, so re-running then is safe."
        );
      }
      throw new Error(`videos.list ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as { items: YtVideoItem[] };
    for (const item of json.items) out.set(item.id, item);
    process.stdout.write(`\r  hydrated ${Math.min(i + 50, ids.length)}/${ids.length}`);
  }
  process.stdout.write("\n");

  return out;
}

// ─── Output ─────────────────────────────────────────────────────────────────

interface OutClip {
  youtubeId: string;
  title: string;
  channelTitle: string;
  durationSec: number;
  /**
   * The sheet's "หัวข้อหลัก (Lesson)" value — the Khan lesson this clip sits
   * in. Carried all the way to the UI: a subtopic like Fractions is 91 clips
   * across 32 lessons, and an undivided list of 91 rows is unreadable.
   */
  lesson: string;
  /**
   * The sheet's "Unit (Khan)" value. With `lesson` it becomes the Unit → Lesson
   * rows the scheduler cuts long subtopics along — a session starts and ends on
   * a unit boundary where it can, and on a lesson boundary where it can't.
   */
  unit: string;
}

interface OutSubtopic {
  name: string;
  description: string;
  learningUrl: string;
  estimatedMinutes: number;
  difficultyLevel: number;
  clips: OutClip[];
}

interface OutSubject {
  code: string;
  name: string;
  categories: Array<{
    name: string;
    weight: number;
    topics: Array<{ name: string; subtopics: OutSubtopic[] }>;
  }>;
}

function writeCurriculumData(subjects: OutSubject[]) {
  writeFileSync(
    DATA_PATH,
    `// AUTO-GENERATED by scripts/import-curriculum.ts — do not edit by hand.\n` +
      `//\n` +
      `// Source: curriculum/*.csv (the clip lists) and scripts/curriculum/plan.ts\n` +
      `// (the structure, scope sentences, and cut rules). Every video below was\n` +
      `// confirmed embeddable against the YouTube Data API at generation time.\n` +
      `//\n` +
      `// Generated: ${new Date().toISOString()}\n\n` +
      `export interface CurriculumClip {\n` +
      `  youtubeId: string;\n  title: string;\n  channelTitle: string;\n  durationSec: number;\n  lesson: string;\n  unit: string;\n}\n\n` +
      `export interface CurriculumSubtopic {\n` +
      `  name: string;\n  description: string;\n  learningUrl: string;\n` +
      `  estimatedMinutes: number;\n  difficultyLevel: number;\n  clips: CurriculumClip[];\n}\n\n` +
      `export interface CurriculumSubject {\n` +
      `  code: string;\n  name: string;\n` +
      `  categories: Array<{\n` +
      `    name: string;\n    weight: number;\n` +
      `    topics: Array<{ name: string; subtopics: CurriculumSubtopic[] }>;\n` +
      `  }>;\n}\n\n` +
      `export const CURRICULUM: CurriculumSubject[] = ${JSON.stringify(subjects, null, 2)};\n`,
    "utf8"
  );
}

// ─── Step 3: the resource rows ──────────────────────────────────────────────

/**
 * Writes the generated curriculum's clips into the Resource table.
 *
 * Runs offline: by this point every title and duration is already on disk, and
 * the only thing missing is the database's own subtopic IDs.
 *
 * The write itself — match by ID, update in place, delete only what the
 * curriculum dropped — lives in scripts/lib/resources.ts, shared with
 * fetch-resources.ts so both importers treat learner progress the same way.
 */
async function writeResources() {
  if (!existsSync(DATA_PATH)) {
    throw new Error("prisma/curriculum.data.ts is missing — run this script without --resources first.");
  }
  // pathToFileURL, not the bare path: a Windows path starts "C:\\", and the ESM
  // loader reads that leading "C:" as an unknown URL scheme.
  const { CURRICULUM } = (await import(pathToFileURL(DATA_PATH).href)) as {
    CURRICULUM: OutSubject[];
  };

  const subtopics = await db.subtopic.findMany({
    select: {
      id: true,
      name: true,
      topic: { select: { category: { select: { subject: { select: { code: true } } } } } },
    },
  });

  const idByKey = new Map(
    subtopics.map((s) => [`${s.topic.category.subject.code}::${s.name}`, s.id])
  );

  let written = 0;
  let removed = 0;
  let updated = 0;
  let missing = 0;

  for (const subject of CURRICULUM) {
    for (const cat of subject.categories) {
      for (const topic of cat.topics) {
        for (const st of topic.subtopics) {
          const subtopicId = idByKey.get(`${subject.code}::${st.name}`);
          if (!subtopicId) {
            console.warn(`  ! not seeded: [${subject.code}] ${st.name}`);
            missing++;
            continue;
          }

          const saved = await saveSubtopicResources(db, subtopicId, st.clips);

          removed += saved.removed;
          updated += saved.updated;
          written += st.clips.length;
        }
      }
    }
  }

  console.log(`
${written} resource row(s) in the database (${updated} updated this run).`);
  if (removed) {
    console.log(
      `Removed ${removed} row(s) no longer in the curriculum — any watch progress on them went too.`
    );
  }
  if (missing) console.log(`${missing} subtopic(s) had no seeded row — re-run prisma/seed.ts.`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  // The old name for step 3. Falling through would silently start step 1 and
  // spend YouTube quota on a run the caller did not ask for.
  if (process.argv.includes("--fixture")) {
    throw new Error("--fixture is now --resources: the clips go to the database, not to a file.");
  }

  if (process.argv.includes("--resources")) {
    await writeResources();
    return;
  }

  const only = arg("subject");
  const dryRun = process.argv.includes("--dry-run");
  const plans = only ? PLANS.filter((p) => p.code === only) : PLANS;

  if (!plans.length) throw new Error(`No plan for subject ${only}. Known: ${PLANS.map((p) => p.code).join(", ")}`);
  if (!dryRun && !API_KEY) throw new Error("YOUTUBE_API_KEY is not set. Add it to .env.");

  const problems: Problem[] = [];
  const staged = new Map<string, Map<string, PlannedSubtopic>>();

  for (const plan of plans) {
    const total = plan.categories.reduce((n, c) => n + c.weight, 0);
    if (total !== 100) {
      problems.push({ kind: "plan", detail: `${plan.code} category weights total ${total}, not 100` });
    }
    const rows = readSubjectCsv(plan.code);
    const planned = applyPlan(plan, rows, problems);
    staged.set(plan.code, planned);

    const kept = [...planned.values()].reduce((n, s) => n + s.clips.length, 0);
    console.log(`${plan.code}: ${rows.length} row(s) in the sheet → ${kept} clip(s) across ${planned.size} subtopic(s)`);
  }

  const planProblems = problems.filter((p) => p.kind === "plan");
  if (planProblems.length) {
    console.error("\nPlan does not match the sheet:");
    for (const p of planProblems) console.error(`  - ${p.detail}`);
    throw new Error("Refusing to continue with a plan that does not match the CSV.");
  }

  const noVideo = problems.filter((p) => p.kind === "no-video");
  if (noVideo.length) {
    console.log(`\nSkipped ${noVideo.length} row(s) with no video URL:`);
    for (const p of noVideo) console.log(`  - ${p.detail}`);
  }

  if (dryRun) {
    console.log("\n--dry-run: stopping before any YouTube call.");
    return;
  }

  const allIds = [
    ...new Set(
      [...staged.values()].flatMap((m) => [...m.values()].flatMap((s) => s.clips.map((c) => c.youtubeId)))
    ),
  ];
  console.log(`\nVerifying ${allIds.length} unique video(s) — ${Math.ceil(allIds.length / 50)} quota unit(s):`);
  const meta = await hydrate(allIds);

  const rejected: string[] = [];
  const out: OutSubject[] = [];

  for (const plan of plans) {
    const planned = staged.get(plan.code)!;
    out.push({
      code: plan.code,
      name: plan.name,
      categories: plan.categories.map((cat) => ({
        name: cat.name,
        weight: cat.weight,
        topics: cat.topics.map((topic) => ({
          name: topic.name,
          subtopics: topic.subtopics.map((sp) => {
            const p = planned.get(sp.csv)!;
            const clips: OutClip[] = [];

            for (const c of p.clips) {
              const v = meta.get(c.youtubeId);
              if (!v) {
                rejected.push(`[${plan.code}/${p.name}] ${c.csvTitle} — gone from YouTube (${c.youtubeId}, sheet L${c.line})`);
                continue;
              }
              if (!v.status.embeddable) {
                rejected.push(`[${plan.code}/${p.name}] ${v.snippet.title} — embedding disabled (${c.youtubeId}, sheet L${c.line})`);
                continue;
              }
              if (v.status.privacyStatus !== "public") {
                rejected.push(`[${plan.code}/${p.name}] ${v.snippet.title} — ${v.status.privacyStatus} (${c.youtubeId}, sheet L${c.line})`);
                continue;
              }
              clips.push({
                youtubeId: c.youtubeId,
                title: v.snippet.title,
                channelTitle: v.snippet.channelTitle,
                durationSec: parseIsoDuration(v.contentDetails.duration),
                lesson: c.lesson,
                unit: c.unit,
              });
            }

            const seconds = clips.reduce((n, c) => n + c.durationSec, 0);
            return {
              name: p.name,
              description: p.description,
              learningUrl: p.learningUrl,
              // Study time follows the clips rather than a number guessed in
              // advance: watching is the session, so a planner estimate that
              // disagrees with the runtime is just wrong on the learner's
              // calendar. The 1.3 allows for pausing, rewinding and notes.
              estimatedMinutes: Math.max(15, Math.round((seconds / 60) * 1.3)),
              difficultyLevel: p.difficulty,
              clips,
            };
          }),
        })),
      })),
    });
  }

  if (rejected.length) {
    console.log(`\n${rejected.length} clip(s) rejected — these need replacing in the sheet:`);
    for (const r of rejected) console.log(`  - ${r}`);
  }

  writeCurriculumData(out);

  const totals = out.map((s) => {
    const subs = s.categories.flatMap((c) => c.topics.flatMap((t) => t.subtopics));
    const clips = subs.reduce((n, x) => n + x.clips.length, 0);
    const mins = subs.reduce((n, x) => n + x.estimatedMinutes, 0);
    return `${s.code}: ${subs.length} subtopics, ${clips} clips, ${Math.round(mins / 60)}h of study`;
  });
  console.log(`\nWrote prisma/curriculum.data.ts\n  ${totals.join("\n  ")}`);
  // Not "run the seed": it still clears assessment history, so it is only
  // needed when the subtopic list itself changed.
  console.log("\nNext: this script with --resources (after prisma/seed.ts only if subtopics were added or renamed).");
}

main()
  .catch((e) => {
    console.error(`\n${e.message}`);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

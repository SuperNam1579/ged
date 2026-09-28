/**
 * Turns the hand-built curriculum sheets into seedable curriculum data.
 *
 * MATH comes from `curriculum/MATH.csv`. SS and SCI come from the `_wordcount`
 * workbooks, read as .xlsx because an article's address only exists as the
 * hyperlink under its title — a CSV export drops all of them. See SHEETS.
 *
 *   npx tsx scripts/import-curriculum.ts             # all subjects in the plan
 *   npx tsx scripts/import-curriculum.ts --subject MATH
 *   npx tsx scripts/import-curriculum.ts --dry-run   # validate only, no network
 *   npx tsx scripts/import-curriculum.ts --resources # step 3, after seeding
 *   npx tsx scripts/import-curriculum.ts --landing   # public-page summary only, offline
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
 *
 * ── The link decides what a row is ───────────────────────────────────────
 * A YouTube link is a video; any other web address is an article, read on the
 * site it points at. The sheet's "ประเภท" column is only checked against that,
 * and every row where the two disagree is printed. When the same video or page
 * turns up twice in one subtopic, the row whose "ประเภท" agrees with its link
 * wins — so a clip keeps its own title and position, not those of an article
 * row that was given the clip's link by mistake.
 */

import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseIsoDuration } from "../src/lib/youtube/duration";
import { PLANS, type SubjectPlan, type SubtopicPlan } from "./curriculum/plan";
import { normalizeUrl, saveSubtopicResources, type ResourceInput } from "./lib/resources";
import { assertDatabaseWriteAllowed } from "./db/guard";
import { READING_TIME_FACTOR, readingSec } from "../src/lib/resources/types";
import { STUDY_TIME_FACTOR } from "../src/lib/schedule/parts";

process.loadEnvFile(resolve(process.cwd(), ".env"));

const API_KEY = process.env.YOUTUBE_API_KEY;
const CURRICULUM_DIR = resolve(process.cwd(), "curriculum");
const DATA_PATH = resolve(process.cwd(), "prisma/curriculum.data.ts");
const LANDING_PATH = resolve(process.cwd(), "src/components/landing/curriculum.generated.ts");

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
  /** What the sheet's "ประเภท" column says. "" where the sheet has no such column. */
  declared: "video" | "article" | "reference" | "";
  /** The sheet's word count for an article. Null where absent or not a number. */
  words: number | null;
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
    out.push({ line: i + 3, subtopic, unit, lesson, clip, url, note, declared: "", words: null });
  }
  return out;
}

// ─── Workbooks ──────────────────────────────────────────────────────────────

interface SheetSource {
  file: string;
  sheet: string;
  /** First data row, 1-based. */
  firstRow: number;
  /** 1-based column numbers. The two workbooks don't agree on the order. */
  cols: { subtopic: number; unit: number; lesson: number; type: number; title: number; url: number; note: number; words: number };
}

/** Subjects read from a workbook rather than a CSV. */
const SHEETS: Record<string, SheetSource> = {
  SS: {
    file: "Social Studies_wordcount.xlsx",
    sheet: "SS Videos (All)",
    firstRow: 3,
    cols: { subtopic: 1, unit: 2, lesson: 3, type: 4, title: 5, url: 6, note: 7, words: 10 },
  },
  SCI: {
    file: "Science_wordcount.xlsx",
    sheet: "Science",
    firstRow: 2,
    cols: { subtopic: 1, unit: 2, lesson: 3, title: 4, type: 5, url: 6, note: 7, words: 9 },
  },
};

function declaredKind(type: string): CsvRow["declared"] {
  const t = type.trim().toLowerCase();
  if (t === "video") return "video";
  if (t === "บทความ" || t === "article") return "article";
  if (t === "อ้างอิง") return "reference";
  return "";
}

/**
 * Reads one subject's workbook into the same flat rows the CSV reader makes.
 *
 * Each URL cell carries two addresses: the text a person typed, and a hyperlink
 * under it. For video rows the typed URL is the one that was checked by eye
 * (the hyperlinks drifted a row or two in places), so it wins. An article's
 * cell text is just the page title, so its hyperlink is the only address there
 * is.
 */
async function readSubjectSheet(code: string, src: SheetSource): Promise<CsvRow[]> {
  const path = resolve(CURRICULUM_DIR, src.file);
  if (!existsSync(path)) throw new Error(`No workbook for ${code} — expected ${path}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.getWorksheet(src.sheet);
  if (!ws) throw new Error(`${src.file} has no sheet "${src.sheet}"`);

  const out: CsvRow[] = [];
  let subtopic = "";
  let unit = "";
  let lesson = "";
  const c = src.cols;

  for (let n = src.firstRow; n <= ws.rowCount; n++) {
    const row = ws.getRow(n);
    const text = (col: number) => row.getCell(col).text.trim();

    if (text(c.subtopic)) subtopic = text(c.subtopic);
    if (text(c.unit)) unit = text(c.unit);
    if (text(c.lesson)) lesson = text(c.lesson);

    const clip = text(c.title);
    const urlCell = row.getCell(c.url);
    const typed = urlCell.text.trim();
    const link = (urlCell.hyperlink ?? "").trim();
    if (!clip && !typed && !link) continue;

    const declared = declaredKind(text(c.type));
    const typedIsUrl = /^https?:\/\//i.test(typed);
    const url =
      declared === "article" ? link || (typedIsUrl ? typed : "") : typedIsUrl ? typed : link;

    const rawWords = text(c.words).replace(/,/g, "");
    const words = /^\d+$/.test(rawWords) ? Number(rawWords) : null;

    out.push({ line: n, subtopic, unit, lesson, clip, url, note: text(c.note), declared, words });
  }
  return out;
}

function readSubjectRows(code: string): Promise<CsvRow[]> {
  const sheet = SHEETS[code];
  return sheet ? readSubjectSheet(code, sheet) : Promise.resolve(readSubjectCsv(code));
}

/** The 11-character video ID, from any of the URL shapes people paste. */
function videoId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ─── Plan application ───────────────────────────────────────────────────────

/**
 * A row that survived the plan's cut rules. Videos are verified against
 * YouTube before they are written down; articles are taken as the sheet has
 * them, with reading time from their word count.
 */
type PlannedClip = {
  /** Title as written in the sheet. A video's is replaced by YouTube's after hydration. */
  csvTitle: string;
  unit: string;
  lesson: string;
  line: number;
} & ({ kind: "VIDEO"; youtubeId: string } | { kind: "ARTICLE"; url: string; wordCount: number });

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

/** Drops the bookkeeping cut() uses to pick between duplicate rows. */
function stripSelection(c: PlannedClip & { key: string; agrees: boolean }): PlannedClip {
  const item: PlannedClip & { key?: string; agrees?: boolean } = { ...c };
  delete item.key;
  delete item.agrees;
  return item;
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

  const candidates: Array<PlannedClip & { key: string; agrees: boolean }> = [];
  const where = (r: CsvRow) => `${code} L${r.line} [${sp.csv}] ${r.clip}`;

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

    // "See item 9" rows point at material filed under another subtopic. It is
    // already in the curriculum there, and a second copy here would have to be
    // watched twice to finish both.
    if (r.declared === "reference") {
      problems.push({ kind: "skipped", detail: `${where(r)} — cross-reference to another subtopic` });
      continue;
    }

    const base = { csvTitle: r.clip, unit: r.unit, lesson: r.lesson, line: r.line };
    const id = videoId(r.url);
    if (id) {
      if (r.declared === "article") {
        problems.push({ kind: "switched", detail: `${where(r)} — marked บทความ, link is a YouTube clip → video` });
      }
      candidates.push({ ...base, kind: "VIDEO", youtubeId: id, key: `v:${id}`, agrees: r.declared !== "article" });
      continue;
    }

    if (!/^https?:\/\//i.test(r.url)) {
      // Khan files some exercises as downloadable worksheets; MATH's sheet notes
      // them as "มีแค่ให้โหลด" in the URL column. Real material, nothing to link.
      problems.push({ kind: "skipped", detail: `${where(r)} — no link (${JSON.stringify(r.url.slice(0, 40))})` });
      continue;
    }

    if (r.declared === "video") {
      problems.push({ kind: "switched", detail: `${where(r)} — marked Video, link is a web page → article` });
    }
    // Reading time comes from the word count and nothing else; an article
    // without one can't be scheduled or timed, so it waits for its count.
    if (r.words === null) {
      problems.push({ kind: "skipped", detail: `${where(r)} — article has no word count` });
      continue;
    }
    candidates.push({
      ...base,
      kind: "ARTICLE",
      url: r.url,
      wordCount: r.words,
      key: `a:${normalizeUrl(r.url)}`,
      agrees: r.declared !== "video",
    });
  }

  // The same video or page twice in one subtopic is a copy-paste artefact.
  // Across subtopics it is deliberate (exponent rules genuinely serve both
  // "Exponents & roots" and "Quadratic functions") and is left alone. Within
  // one, the row whose "ประเภท" matches its link is the real one; the other is
  // usually an article row that was handed the clip's link.
  const chosen = new Map<string, number>();
  candidates.forEach((c, i) => {
    const prev = chosen.get(c.key);
    if (prev === undefined || (!candidates[prev].agrees && c.agrees)) chosen.set(c.key, i);
  });
  const keep = new Set(chosen.values());
  const out: PlannedClip[] = [];
  candidates.forEach((c, i) => {
    if (!keep.has(i)) {
      problems.push({ kind: "duplicate", detail: `${code} L${c.line} [${sp.csv}] ${c.csvTitle} — same ${c.kind === "VIDEO" ? "clip" : "page"} as another row in this subtopic` });
      return;
    }
    out.push(stripSelection(c));
  });

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

/**
 * One item as written to curriculum.data.ts, in the shape the Resource writer
 * takes. `lesson` and `unit` are the sheet's "หัวข้อหลัก (Lesson)" and
 * "Unit (Khan)": they become the Unit → Lesson rows the study page groups by
 * and the scheduler cuts long subtopics along.
 */
type OutClip = ResourceInput;

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
      `  kind: "VIDEO" | "ARTICLE";\n  youtubeId: string | null;\n  url: string | null;\n  wordCount: number | null;\n` +
      `  title: string;\n  channelTitle: string;\n  durationSec: number;\n  lesson: string;\n  unit: string;\n}\n\n` +
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

/**
 * Keeps the subjects this run didn't touch.
 *
 * curriculum.data.ts is written whole, so `--subject SS` used to write a file
 * holding SS alone — and the next seed or `--resources` run would find no MATH
 * in it. Subjects from the existing file are carried over unless this run
 * rebuilt them, in the plan's subject order.
 */
async function withOtherSubjects(fresh: OutSubject[]): Promise<OutSubject[]> {
  if (!existsSync(DATA_PATH)) return fresh;
  const { CURRICULUM } = (await import(pathToFileURL(DATA_PATH).href)) as { CURRICULUM: OutSubject[] };
  const byCode = new Map(CURRICULUM.map((s) => [s.code, s]));
  for (const s of fresh) byCode.set(s.code, s);
  const order = PLANS.map((p) => p.code);
  return [...byCode.values()].sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
}

/**
 * Writes the summary the public subject pages read.
 *
 * Those pages used to carry a hand-written copy of the curriculum, which fell
 * behind as soon as the sheets changed — MATH still listed "Integer Operations"
 * months after it had been rebuilt. They are also imported by client components
 * (the navbar, onboarding), so they can't take curriculum.data.ts itself: that
 * would ship every clip title to the browser. This is the same tree with only
 * what the pages show — names, scope sentence, study time, level, item counts.
 */
function writeLandingSummary(subjects: OutSubject[]) {
  const summary = Object.fromEntries(
    subjects.map((s) => [
      s.code,
      s.categories.map((c) => ({
        name: c.name,
        weight: c.weight,
        topics: c.topics.map((t) => ({
          name: t.name,
          subtopics: t.subtopics.map((st) => ({
            name: st.name,
            description: st.description,
            minutes: st.estimatedMinutes,
            // The pages label four levels; the plan's 5 is folded into the top one.
            level: Math.min(4, st.difficultyLevel),
            videos: st.clips.filter((c) => (c.kind ?? "VIDEO") === "VIDEO").length,
            articles: st.clips.filter((c) => c.kind === "ARTICLE").length,
          })),
        })),
      })),
    ])
  );
  writeFileSync(
    LANDING_PATH,
    `// AUTO-GENERATED by scripts/import-curriculum.ts — do not edit by hand.
` +
      `//
` +
      `// What the public subject pages show for each subject that comes from the
` +
      `// curriculum sheets, summarised from prisma/curriculum.data.ts. Regenerate
` +
      `// with \`npx tsx scripts/import-curriculum.ts --landing\`.

` +
      `import type { LandingCategory } from "./subjects";

` +
      `export const GENERATED_CURRICULUM: Record<string, LandingCategory[]> = ${JSON.stringify(summary, null, 2)};
`,
    "utf8"
  );
  console.log(`Wrote src/components/landing/curriculum.generated.ts (${Object.keys(summary).join(", ")})`);
}

async function writeLandingFromData() {
  if (!existsSync(DATA_PATH)) throw new Error("prisma/curriculum.data.ts is missing — run this script without flags first.");
  const { CURRICULUM } = (await import(pathToFileURL(DATA_PATH).href)) as { CURRICULUM: OutSubject[] };
  writeLandingSummary(CURRICULUM);
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
  assertDatabaseWriteAllowed("write resources");
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
      topic: {
        select: { name: true, category: { select: { name: true, subject: { select: { code: true } } } } },
      },
    },
  });

  // The full path, not subject + name. A replaced subtopic can share its name
  // with the one replacing it until it is removed — "Civil War & Reconstruction"
  // was both an old SS row and a new one — and matching on the name alone wrote
  // the new clips onto the old row, where they were deleted along with it.
  const pathKey = (code: string, category: string, topic: string, name: string) =>
    [code, category, topic, name].join("\u0000");
  const idByKey = new Map(
    subtopics.map((s) => [
      pathKey(s.topic.category.subject.code, s.topic.category.name, s.topic.name, s.name),
      s.id,
    ])
  );

  let written = 0;
  let removed = 0;
  let updated = 0;
  let missing = 0;

  for (const subject of CURRICULUM) {
    for (const cat of subject.categories) {
      for (const topic of cat.topics) {
        for (const st of topic.subtopics) {
          const subtopicId = idByKey.get(pathKey(subject.code, cat.name, topic.name, st.name));
          if (!subtopicId) {
            console.warn(`  ! not seeded: [${subject.code}] ${st.name}`);
            missing++;
            continue;
          }

          // Data generated before articles existed has no kind/url/wordCount;
          // every item in it is a video.
          const items: ResourceInput[] = st.clips.map((c) => ({
            ...c,
            kind: c.kind ?? "VIDEO",
            url: c.url ?? null,
            wordCount: c.wordCount ?? null,
          }));
          const saved = await saveSubtopicResources(db, subtopicId, items);

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

  if (process.argv.includes("--landing")) {
    await writeLandingFromData();
    return;
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
    const rows = await readSubjectRows(plan.code);
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

  // Everything the run left out or changed its mind about, grouped so a long
  // list stays readable. None of these stop the run — the plan checks above do.
  const REPORTS: Array<[string, string]> = [
    ["switched", "row(s) whose link disagrees with its ประเภท — the link decided"],
    ["duplicate", "duplicate row(s) dropped"],
    ["skipped", "row(s) skipped"],
  ];
  for (const [kind, label] of REPORTS) {
    const list = problems.filter((p) => p.kind === kind);
    if (!list.length) continue;
    console.log(`\n${list.length} ${label}:`);
    for (const p of list) console.log(`  - ${p.detail}`);
  }

  if (dryRun) {
    console.log("\n--dry-run: stopping before any YouTube call.");
    return;
  }

  const allIds = [
    ...new Set(
      [...staged.values()].flatMap((m) =>
        [...m.values()].flatMap((s) => s.clips.flatMap((c) => (c.kind === "VIDEO" ? [c.youtubeId] : [])))
      )
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
              if (c.kind === "ARTICLE") {
                const host = new URL(c.url).host.replace(/^www\./, "");
                clips.push({
                  kind: "ARTICLE",
                  youtubeId: null,
                  url: c.url,
                  wordCount: c.wordCount,
                  title: c.csvTitle,
                  channelTitle: host === "khanacademy.org" ? "Khan Academy" : host,
                  durationSec: readingSec(c.wordCount),
                  lesson: c.lesson,
                  unit: c.unit,
                });
                continue;
              }

              const v = meta.get(c.youtubeId);
              if (!v) {
                rejected.push(`[${plan.code}/${p.name}] ${c.csvTitle} — gone from YouTube (${c.youtubeId}, sheet L${c.line})`);
                continue;
              }
              if (!v.status.embeddable) {
                rejected.push(`[${plan.code}/${p.name}] ${v.snippet.title} — embedding disabled (${c.youtubeId}, sheet L${c.line})`);
                continue;
              }
              // Unlisted plays in an embed exactly like public; only private
              // (and anything YouTube adds later) is refused.
              if (v.status.privacyStatus !== "public" && v.status.privacyStatus !== "unlisted") {
                rejected.push(`[${plan.code}/${p.name}] ${v.snippet.title} — ${v.status.privacyStatus} (${c.youtubeId}, sheet L${c.line})`);
                continue;
              }
              clips.push({
                kind: "VIDEO",
                youtubeId: c.youtubeId,
                url: null,
                wordCount: null,
                title: v.snippet.title,
                channelTitle: v.snippet.channelTitle,
                durationSec: parseIsoDuration(v.contentDetails.duration),
                lesson: c.lesson,
                unit: c.unit,
              });
            }

            const minutes = clips.reduce(
              (n, c) => n + (c.durationSec / 60) * (c.kind === "ARTICLE" ? READING_TIME_FACTOR : STUDY_TIME_FACTOR),
              0
            );
            return {
              name: p.name,
              description: p.description,
              learningUrl: p.learningUrl,
              // Study time follows the content rather than a number guessed in
              // advance: working through it is the session, so a planner
              // estimate that disagrees with it is just wrong on the learner's
              // calendar. Each kind carries its own slack — see the factors.
              estimatedMinutes: Math.max(15, Math.round(minutes)),
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

  const merged = await withOtherSubjects(out);
  writeCurriculumData(merged);
  writeLandingSummary(merged);

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

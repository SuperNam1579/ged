// Names from the curriculum sheets, as learners should read them.
//
// The sheets' unit and lesson names are the team's working notes as much as
// names: Khan's numbering ("Unit 15:", "HS Physics · U8:"), which grade's
// course a unit came from ("(G9 + G10)", "(Pre-algebra)"), Thai notes on what
// was kept or cut ("(เฉพาะ lesson …)", "— เฉพาะส่วน …"), several units run
// together ("Unit 1 → Unit 2 → …"). The database keeps them as written — the
// importer matches on them — and these turn them into plain names where they
// leave the API. Clip titles are shown as YouTube and Khan give them.

const THAI = /[฀-๿]/;

/** Drops "(…)" groups, then any "— note" tail, and tidies the spaces. */
function stripNotes(s: string, keepParens: (inside: string) => boolean = () => false): string {
  let out = s;
  // Innermost first, so a note with parentheses inside goes in one piece.
  for (let prev = ""; prev !== out; ) {
    prev = out;
    out = out.replace(/\s*\(([^()]*)\)/g, (m, inside: string) => (keepParens(inside) ? m : ""));
  }
  return out.replace(/\s+[—–]\s.*$/, "").replace(/\s+/g, " ").trim();
}

/**
 * "Unit 15: Grammar: Word study (G9)" → "Grammar: Word study"
 * "HS Physics · U8: Nuclear physics" → "Nuclear physics"
 * "Unit 1: Worlds collide (1491-1607)  →  Unit 2: Colonial America (1607-1754)" → "Worlds collide, Colonial America"
 */
export function displayUnitName(raw: string): string {
  if (UNIT_NAMES[raw]) return UNIT_NAMES[raw];
  // Parentheses go before the split: "(G9 + G10)" isn't two units.
  const parts = stripNotes(raw)
    .split(/\s*(?:→|\s\+\s)\s*/)
    .map((p) =>
      stripNotes(p)
        .replace(/^[^·:]*·\s*U\d+:\s*/, "") // "HS Biology · U1: "
        .replace(/^Unit\s+\d+:\s*/i, "") // "Unit 4: "
        .trim()
    )
    // A bare "Unit 3" is a reference to another unit's lessons, not a name.
    .filter((p) => p && !/^Unit\s+\d+$/i.test(p) && !THAI.test(p));
  return [...new Set(parts)].join(", ");
}

/** Units whose whole name is a Thai note, in English. */
const UNIT_NAMES: Record<string, string> = {
  "ไม่มีใน Khan — GED Testing Service (ged.com) + แหล่งเสริม": "GED Testing Service",
};

/** Lessons whose whole name is a Thai note, in English. */
const LESSON_NAMES: Record<string, string> = {
  "ทางเลือกเสริม": "Optional extras",
};

/**
 * "1960s America (บางส่วน — สิทธิพลเมือง…)" → "1960s America"
 * "The executive branch | Unit overview" → "The executive branch: overview"
 * Parentheses that are part of the name stay: "Interquartile range (IQR)".
 */
export function displayLessonName(raw: string): string {
  const name = stripNotes(raw, (inside) => !THAI.test(inside) && !/GED_Dataset|clips?\b/i.test(inside));
  if (LESSON_NAMES[name]) return LESSON_NAMES[name];
  const overview = name.match(/^(.+?)\s*\|\s*Unit overview$/i);
  if (overview) return `${overview[1]}: overview`;
  return name;
}

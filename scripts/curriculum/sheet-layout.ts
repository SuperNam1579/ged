/**
 * Finds a curriculum workbook's columns by their headers.
 *
 * SS and SCI were given fixed column numbers in import-curriculum.ts, because
 * their sheets were known — and they don't agree on the order (one puts the
 * type column before the title, the other after). A sheet that arrives later
 * (RLA) shouldn't need its columns counted by hand first, so this reads the
 * header row instead: the first row, within the top few, with a "Subtopic"
 * cell. Each column is recognised by the words the existing sheets use.
 */

import type ExcelJS from "exceljs";

export interface SheetLayout {
  sheet: string;
  /** First data row, 1-based. */
  firstRow: number;
  /** 1-based column numbers; 0 = the sheet has no such column. */
  cols: { subtopic: number; unit: number; lesson: number; type: number; title: number; url: number; note: number; words: number };
}

type Col = keyof SheetLayout["cols"];

/** Checked in this order; each header goes to the first that matches. */
const HEADERS: [Col, RegExp][] = [
  ["subtopic", /subtopic/i],
  ["unit", /^unit\b/i],
  ["lesson", /lesson/i],
  // Not \b: JavaScript word boundaries only know ASCII, so one never follows Thai.
  ["type", /^(ประเภท|type)(?![a-z])/i],
  ["words", /จำนวนคำ|word\s*count|^words?$/i],
  ["url", /^(youtube\s*)?(url|link|ลิงก์)$/i],
  ["note", /^(หมายเหตุ|notes?)$/i],
  ["title", /clip|คลิป|หัวข้อย่อย|บทความ|title/i],
];

/** How many rows from the top a header row may sit (a title banner comes first in some sheets). */
const HEADER_SEARCH_ROWS = 6;

function layoutOf(ws: ExcelJS.Worksheet): SheetLayout | null {
  for (let n = 1; n <= Math.min(HEADER_SEARCH_ROWS, ws.rowCount); n++) {
    const row = ws.getRow(n);
    const cols: SheetLayout["cols"] = { subtopic: 0, unit: 0, lesson: 0, type: 0, title: 0, url: 0, note: 0, words: 0 };
    row.eachCell((cell, col) => {
      const text = cell.text.trim();
      const match = HEADERS.find(([key, re]) => cols[key] === 0 && re.test(text));
      if (match) cols[match[0]] = col;
    });
    if (cols.subtopic && cols.title && cols.url) return { sheet: ws.name, firstRow: n + 1, cols };
  }
  return null;
}

/**
 * The worksheet whose header row names the most columns — a workbook can hold
 * a summary sheet with a few of the same headers (SS and SCI keep a per-article
 * word count sheet before the clip list). Throws, naming what is missing, when
 * no sheet has one: a sheet the importer can't read must stop the import, not
 * import nothing.
 */
export function detectSheetLayout(wb: ExcelJS.Workbook, file: string): SheetLayout {
  const found = (l: SheetLayout) => Object.values(l.cols).filter((c) => c > 0).length;
  let best: SheetLayout | null = null;
  for (const ws of wb.worksheets) {
    const layout = layoutOf(ws);
    if (layout && (!best || found(layout) > found(best))) best = layout;
  }
  if (best) return best;
  throw new Error(
    `${file}: no sheet has a header row with Subtopic, clip/title and URL columns in its first ${HEADER_SEARCH_ROWS} rows`
  );
}

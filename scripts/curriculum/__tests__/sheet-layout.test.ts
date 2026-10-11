import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { resolve } from "node:path";
import { detectSheetLayout } from "../sheet-layout";

const dir = resolve(__dirname, "../../../curriculum");

async function open(file: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(resolve(dir, file));
  return wb;
}

describe("detectSheetLayout", () => {
  // The real workbooks, whose columns were counted by hand in import-curriculum.ts.
  it("finds the SS workbook's columns, past its title banner", async () => {
    const layout = detectSheetLayout(await open("Social Studies_wordcount.xlsx"), "SS");
    expect(layout).toEqual({
      sheet: "SS Videos (All)",
      firstRow: 3,
      cols: { subtopic: 1, unit: 2, lesson: 3, type: 4, title: 5, url: 6, note: 7, words: 10 },
    });
  });

  it("finds the SCI workbook's columns, in its different order", async () => {
    const layout = detectSheetLayout(await open("Science_wordcount.xlsx"), "SCI");
    expect(layout).toEqual({
      sheet: "Science",
      firstRow: 2,
      cols: { subtopic: 1, unit: 2, lesson: 3, title: 4, type: 5, url: 6, note: 7, words: 9 },
    });
  });

  it("reads a sheet in an order neither of them uses, skipping a cover sheet", () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("คำอธิบาย").addRow(["This workbook lists RLA lessons"]);
    const ws = wb.addWorksheet("RLA");
    ws.addRow(["GED RLA — Khan"]);
    ws.addRow(["URL", "Subtopic (GED)", "ประเภท", "Lesson", "Unit (Khan)", "หัวข้อย่อย (Clip/บทความ)", "จำนวนคำ", "หมายเหตุ"]);
    const layout = detectSheetLayout(wb, "RLA.xlsx");
    expect(layout).toEqual({
      sheet: "RLA",
      firstRow: 3,
      cols: { url: 1, subtopic: 2, type: 3, lesson: 4, unit: 5, title: 6, words: 7, note: 8 },
    });
  });

  it("refuses a workbook it can't read rather than importing nothing", () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Sheet1").addRow(["Name", "Link"]);
    expect(() => detectSheetLayout(wb, "RLA.xlsx")).toThrow(/no sheet has a header row/);
  });
});

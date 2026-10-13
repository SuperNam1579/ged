import { describe, expect, it } from "vitest";
import { displayLessonName, displayUnitName } from "../display-names";

// Real values from prisma/curriculum.data.ts.
describe("displayUnitName", () => {
  it.each([
    ["Unit 4: Understand fractions", "Understand fractions"],
    ["Unit 15: Grammar: Word study (G9)", "Grammar: Word study"],
    ["Unit 2: Reading: Key ideas and details (G9 + G10)", "Reading: Key ideas and details"],
    ["HS Physics · U8: Nuclear physics", "Nuclear physics"],
    ["MS Earth & Space · U4: The geosphere", "The geosphere"],
    ["Khan partner (AMNH) · U4: Earthquakes and Volcanoes", "Earthquakes and Volcanoes"],
    ["Crash Course Geography (external — ไม่มีคอร์สตรงใน Khan)", "Crash Course Geography"],
    ["ไม่มีใน Khan — GED Testing Service (ged.com) + แหล่งเสริม", "GED Testing Service"],
    ["Unit 17: Exponents and powers of ten (Arithmetic)", "Exponents and powers of ten"],
    ["Unit 11: Roots, exponents, & scientific notation (Pre-algebra) — เฉพาะส่วน roots/exponents", "Roots, exponents, & scientific notation"],
    [
      "Unit 10: Circles, cylinders, cones, and spheres (ไม่รวม lesson 'Volume of cylinders, spheres, and cones' — ย้ายไปอยู่ subtopic 'Surface area & volume' แล้ว)",
      "Circles, cylinders, cones, and spheres",
    ],
    [
      "Unit 1: Worlds collide (1491-1607)  →  Unit 2: Colonial America (1607-1754)  →  Unit 3: The Revolutionary Era (1754-1800)",
      "Worlds collide, Colonial America, The Revolutionary Era",
    ],
    ["Unit 2: Displaying and comparing quantitative data + Unit 3 (บางส่วน)", "Displaying and comparing quantitative data"],
    [
      "Unit 1: Basic economic concepts  +  Unit 7: Forms of competition (เฉพาะ lesson Monopoly ตาม target E.c)",
      "Basic economic concepts, Forms of competition",
    ],
    [
      "Unit 5: Protection of civil rights and liberties  +  Crash Course Government and Politics #25, #26 (freedom of speech/press)",
      "Protection of civil rights and liberties, Crash Course Government and Politics #25, #26",
    ],
  ])("%s", (raw, want) => expect(displayUnitName(raw)).toBe(want));
});

describe("displayLessonName", () => {
  it.each([
    ["1960s America (บางส่วน — สิทธิพลเมือง/ขบวนการทางสังคม)", "1960s America"],
    ["How to write a great GED extended response (GED official, 9 คลิป)", "How to write a great GED extended response"],
    ["ทางเลือกเสริม (จาก GED_Dataset_v5)", "Optional extras"],
    ["The executive branch | Unit overview", "The executive branch: overview"],
    ["Interquartile range (IQR)", "Interquartile range (IQR)"],
    ["Adding decimals (tenths and hundredths)", "Adding decimals (tenths and hundredths)"],
    ["Unit 1 overview", "Unit 1 overview"],
  ])("%s", (raw, want) => expect(displayLessonName(raw)).toBe(want));
});

/**
 * How much free time each combination of subjects needs, from the real fit
 * check (lib/schedule/feasibility.ts) on the current curriculum. READ-ONLY.
 *
 *   npx tsx scripts/dev/min-time.ts
 *
 * For every subject combination and exam 8/12/16/24 weeks away, prints the
 * fewest minutes a day — studying every day — at which the plan can be made,
 * and at which it isn't "tight". Re-run after importing content: the numbers
 * follow the clips and articles in the database.
 */
import { db } from "@/lib/db";
import { loadSubtopics } from "@/lib/schedule/create-plan";
import { loadWorkItems } from "@/lib/schedule/work-items";
import { assessFeasibility } from "@/lib/schedule/feasibility";
import { addDaysStr, bangkokDateStr, dayOfWeekOf } from "@/lib/schedule/calendar";
import { remainingMinutes } from "@/lib/schedule/parts";

const SUBJECTS = ["MATH", "RLA", "SCI", "SS"];
const WEEKS = [8, 12, 16, 24];

function combos<T>(xs: T[]): T[][] {
  const out: T[][] = [];
  for (let m = 1; m < 1 << xs.length; m++) out.push(xs.filter((_, i) => m & (1 << i)));
  return out.sort((a, b) => a.length - b.length);
}

(async () => {
  const from = bangkokDateStr();
  const all = await loadSubtopics(SUBJECTS);
  // A user id with no history: everything is still to study.
  const items = await loadWorkItems("no-such-user", all, "regenerate");
  const subjectOf = new Map(all.map((s) => [s.id, s.subjectCode]));

  const mondayOf = (d: string) => addDaysStr(d, -((dayOfWeekOf(d) + 6) % 7));
  const calendar = (weeks: number, perDay: number) => {
    const exam = addDaysStr(from, weeks * 7);
    const days = [];
    for (let d = from; d < exam; d = addDaysStr(d, 1)) {
      days.push({ date: d, dayOfWeek: dayOfWeekOf(d), weekStartDate: mondayOf(d), capacity: perDay });
    }
    return { days, exam };
  };

  const rows: string[] = [];
  for (const combo of combos(SUBJECTS)) {
    const subs = all.filter((s) => combo.includes(s.subjectCode));
    const its = items.filter((i) => combo.includes(subjectOf.get(i.subtopicId) ?? ""));
    const need = its.reduce((a, i) => a + remainingMinutes(i), 0);
    const cells: string[] = [];
    for (const weeks of WEEKS) {
      const check = (perDay: number) => {
        const { days, exam } = calendar(weeks, perDay);
        return assessFeasibility({ calendarDays: days, from, examDate: exam, items: its, subtopics: subs, proficiencies: {}, subjectCodes: combo });
      };
      // Smallest minutes a day, every day, at which it fits / fits with room (not "tight").
      const search = (ok: (perDay: number) => boolean) => {
        let lo = 5, hi = 960;
        if (!ok(hi)) return null;
        while (hi - lo > 5) {
          const mid = Math.round((lo + hi) / 2 / 5) * 5;
          if (ok(mid)) hi = mid; else lo = mid;
        }
        return hi;
      };
      const min = search((m) => check(m).canPlan);
      const good = search((m) => { const f = check(m); return f.canPlan && f.status !== "tight"; });
      cells.push(min === null ? "—" : `${min}/${good ?? "—"}`);
    }
    rows.push(`| ${combo.join("+").padEnd(16)} | ${(need / 60).toFixed(0).padStart(4)} h | ${cells.map((c) => c.padStart(9)).join(" | ")} |`);
  }
  console.log(`From ${from}. Cells: minimum / recommended minutes a day, studying every day.`);
  console.log(`| subjects         | content | ${WEEKS.map((w) => `${w} weeks`.padStart(9)).join(" | ")} |`);
  for (const r of rows) console.log(r);
  await db.$disconnect();
})();

"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import MethodWeek from "./MethodWeek";
import { BLUE, GOALS, INK, LINE, MUTED } from "./methodData";
import { POP, runDemo, type DemoPlan, type DemoRun } from "./demoRun";

/** A fixed seed, so the comparison doesn't change between visits. */
const SEED = 7;

function Panel({
  kicker,
  note,
  plan,
  other,
  accent,
  highlight,
}: {
  kicker: string;
  note: string;
  plan: DemoPlan;
  /** The other plan, to mark which goals this one does better on. */
  other: DemoPlan;
  accent: string;
  highlight: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-5 min-w-0"
      style={{ background: "white", border: `1px solid ${highlight ? "#bcdcfa" : LINE}`, boxShadow: highlight ? "0 4px 0 #cfe6fb" : "0 4px 0 #e8eef6" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: MUTED }}>{kicker}</p>
          <p style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{note}</p>
        </div>
        <span className="tabular-nums shrink-0" style={{ fontFamily: "var(--font-feather)", fontSize: 30, fontWeight: 700, color: accent, lineHeight: 1 }}>
          {plan.score}
        </span>
      </div>

      <div className="mt-4">
        <MethodWeek week={plan.week} minColumnHeight={104} />
      </div>

      {/* The six goals, each as scored for this plan. */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        {GOALS.map((g) => {
          const v = Math.round(plan.goals[g.key] * 100);
          const better = v > Math.round(other.goals[g.key] * 100);
          return (
            <div key={g.key} className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate" style={{ fontSize: 11, color: MUTED }}>{g.name}</span>
                <span className="tabular-nums shrink-0" style={{ fontSize: 11.5, fontWeight: 700, color: better ? accent : INK }}>{v}</span>
              </div>
              <div className="rounded-full overflow-hidden mt-0.5" style={{ height: 4, background: "#e2edfa" }}>
                <div className="h-full rounded-full" style={{ width: `${v}%`, background: better ? accent : "#a9c8e6" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MethodComparison() {
  // Computed in the browser only, after the first paint: the GA's random
  // choices go through Array.sort, which a server's JavaScript engine and a
  // browser's may order differently, so a server render wouldn't match.
  const [run, setRun] = useState<DemoRun | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRun(runDemo(SEED)));
    return () => cancelAnimationFrame(id);
  }, []);
  if (!run) {
    return <div className="rounded-2xl" style={{ minHeight: 420, background: "white", border: `1px solid ${LINE}` }} />;
  }
  const gain = run.result.score - run.baseline.score;
  const improved = GOALS.filter((g) => Math.round(run.result.goals[g.key] * 100) > Math.round(run.baseline.goals[g.key] * 100)).map((g) => g.name.toLowerCase());

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.5 }}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          kicker="A simple rule"
          note="Weakest topics first, basics before — no evolution"
          plan={run.baseline}
          other={run.result}
          accent="#c2553f"
          highlight={false}
        />
        <Panel
          kicker="The algorithm"
          note={`${run.generationsRun} rounds of ${POP} competing drafts`}
          plan={run.result}
          other={run.baseline}
          accent={BLUE}
          highlight
        />
      </div>

      <p className="rounded-xl mt-4" style={{ fontSize: 13.5, color: INK, lineHeight: 1.6, background: "#f4f8ff", border: `1px solid ${LINE}`, padding: "14px 16px" }}>
        <strong style={{ fontWeight: 700 }}>{gain >= 0 ? `+${gain}` : gain} points</strong>
        {improved.length > 0
          ? ` — the algorithm does better on ${improved.join(", ")}. Both plans are scored by the same function that makes every learner's plan, on the same week and the same topics.`
          : " — both plans are scored by the same function that makes every learner's plan, on the same week and the same topics."}
      </p>
    </motion.div>
  );
}

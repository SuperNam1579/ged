"use client";

import { motion } from "motion/react";
import { WEIGHTS } from "@/lib/ga/fitness";
import { BLUE, GOALS, INK, LINE, MUTED, TOP_WEIGHT, type GoalKey } from "./methodData";

/**
 * The six goals, each with the reason its weight sits where it does.
 *
 * Percentages come from WEIGHTS in the fitness function rather than being
 * retyped, so the page can't quietly disagree with the engine.
 */
export default function MethodGoals() {
  return (
    <div className="flex flex-col">
      {GOALS.map((goal, i) => {
        const weight = WEIGHTS[goal.key as GoalKey];

        return (
          <motion.div
            key={goal.key}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="py-5"
            style={{ borderTop: `1px solid ${LINE}` }}
          >
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <p style={{ fontSize: 15.5, fontWeight: 700, color: INK, lineHeight: 1.3 }}>
                  {goal.name}
                </p>
                <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.5, marginTop: 2 }}>
                  {goal.hint}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-3" style={{ paddingTop: 2 }}>
                <span
                  className="hidden sm:block h-1.5 rounded-full overflow-hidden"
                  style={{ width: 84, background: "#e2edfa" }}
                >
                  <motion.span
                    className="block h-full rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${(weight / TOP_WEIGHT) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.15 + i * 0.05, ease: "easeOut" }}
                    style={{ background: BLUE }}
                  />
                </span>
                <span
                  className="tabular-nums text-right"
                  style={{ fontSize: 15, fontWeight: 700, color: BLUE, width: 40 }}
                >
                  {Math.round(weight * 100)}%
                </span>
              </div>
            </div>

            {/* The rationale is the part a committee reads — why this number. */}
            <p
              className="mt-2.5 rounded-lg"
              style={{
                fontSize: 13,
                color: MUTED,
                lineHeight: 1.6,
                background: "#f4f8ff",
                padding: "10px 12px",
              }}
            >
              {goal.why}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}

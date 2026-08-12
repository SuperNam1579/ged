"use client";

import { motion } from "motion/react";
import { Check, X } from "lucide-react";
import MethodWeek from "./MethodWeek";
import {
  BLUE,
  FINAL_STAGE,
  HAND_MADE_SCORE,
  HAND_MADE_WEEK,
  INK,
  LINE,
  MUTED,
} from "./methodData";

const HAND_FAULTS = [
  { ok: false, text: "Two subjects never appear at all" },
  { ok: false, text: "Books Wednesday and Saturday, both marked busy" },
  { ok: false, text: "Quadratics lands before Expressions" },
  { ok: false, text: "Four Math sessions in the first three days" },
];

const GA_WINS = [
  { ok: true, text: "All four subjects covered" },
  { ok: true, text: "Nothing booked on a busy day" },
  { ok: true, text: "Expressions comes before Quadratics" },
  { ok: true, text: "Heavy days separated, subjects rotating" },
];

function Panel({
  kicker,
  score,
  week,
  points,
  accent,
  highlight,
}: {
  kicker: string;
  score: number;
  week: typeof HAND_MADE_WEEK;
  points: { ok: boolean; text: string }[];
  accent: string;
  highlight: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-5 min-w-0"
      style={{
        background: "white",
        border: `1px solid ${highlight ? "#bcdcfa" : LINE}`,
        boxShadow: highlight ? "0 4px 0 #cfe6fb" : "0 4px 0 #e8eef6",
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          {kicker}
        </p>
        <span
          className="tabular-nums"
          style={{
            fontFamily: "var(--font-feather)",
            fontSize: 30,
            fontWeight: 700,
            color: accent,
            lineHeight: 1,
          }}
        >
          {score}
        </span>
      </div>

      <div className="mt-4">
        <MethodWeek week={week} minColumnHeight={104} />
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {points.map((p) => (
          <li key={p.text} className="flex items-start gap-2">
            <span
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: p.ok ? "#e3f6ec" : "#fdecea",
                marginTop: 1,
              }}
            >
              {p.ok ? (
                <Check className="w-2.5 h-2.5" style={{ color: "#17a673" }} strokeWidth={3.5} />
              ) : (
                <X className="w-2.5 h-2.5" style={{ color: "#c2553f" }} strokeWidth={3.5} />
              )}
            </span>
            <span style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>{p.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MethodComparison() {
  const gain = FINAL_STAGE.score - HAND_MADE_SCORE;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5 }}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          kicker="Planned by hand"
          score={HAND_MADE_SCORE}
          week={HAND_MADE_WEEK}
          points={HAND_FAULTS}
          accent="#c2553f"
          highlight={false}
        />
        <Panel
          kicker="Planned by the algorithm"
          score={FINAL_STAGE.score}
          week={FINAL_STAGE.week}
          points={GA_WINS}
          accent={BLUE}
          highlight
        />
      </div>

      <p
        className="rounded-xl mt-4"
        style={{
          fontSize: 13.5,
          color: INK,
          lineHeight: 1.6,
          background: "#f4f8ff",
          border: `1px solid ${LINE}`,
          padding: "14px 16px",
        }}
      >
        <strong style={{ fontWeight: 700 }}>
          {"+"}
          {gain}
          {" points"}
        </strong>
        {" — and the gap isn't a matter of taste. Every point of it is one of the six goals below "}
        {"being met or missed, counted the same way for both timetables."}
      </p>
    </motion.div>
  );
}

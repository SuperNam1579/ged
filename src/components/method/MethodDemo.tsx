"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { WEIGHTS } from "@/lib/ga/fitness";
import MethodWeek from "./MethodWeek";
import {
  BLUE,
  GENS,
  GOALS,
  HAND_MADE_SCORE,
  INK,
  LINE,
  MUTED,
  STAGES,
  type GoalKey,
} from "./methodData";

/** How long each generation is shown for while running. */
const STEP_MS = 2200;

/** Score axis. Fixed so the baseline sits in the same place at every stage. */
const AXIS_MIN = 30;
const AXIS_MAX = 100;
const toPct = (score: number) => ((score - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * 100;

export default function MethodDemo() {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stage = STAGES[index];
  const atEnd = index === STAGES.length - 1;

  const step = useCallback(() => {
    setIndex((i) => Math.min(i + 1, STAGES.length - 1));
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    setIndex(0);
  }, []);

  // Auto-play advances one stage at a time and stops at the winner rather than
  // looping — the last generation is the point, so it shouldn't scroll past it.
  useEffect(() => {
    if (!running) return;
    timer.current = setInterval(() => {
      setIndex((i) => {
        if (i >= STAGES.length - 1) {
          setRunning(false);
          return i;
        }
        return i + 1;
      });
    }, STEP_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [running]);

  const scoreDelta = index === 0 ? 0 : stage.score - STAGES[index - 1].score;

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{ background: "white", boxShadow: "0 4px 0 #dceaf9", border: `1px solid ${LINE}` }}
    >
      {/* ── Controls ── */}
      <div
        className="flex flex-wrap items-center gap-3 px-5 py-4"
        style={{ borderBottom: `1px solid ${LINE}`, background: "#fbfdff" }}
      >
        <button
          type="button"
          onClick={() => (atEnd ? reset() : setRunning((r) => !r))}
          className="inline-flex items-center gap-2 transition-transform hover:scale-[1.04] active:scale-[0.97]"
          style={{
            padding: "9px 16px",
            background: BLUE,
            color: "white",
            borderRadius: 10,
            fontSize: 13.5,
            fontWeight: 700,
            boxShadow: "0 3px 0 #1670be",
          }}
        >
          {atEnd ? (
            <>
              <RotateCcw className="w-4 h-4" />
              Run again
            </>
          ) : running ? (
            <>
              <Pause className="w-4 h-4" />
              Pause
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run
            </>
          )}
        </button>

        <button
          type="button"
          onClick={step}
          disabled={atEnd}
          className="inline-flex items-center gap-2 transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-40 disabled:hover:scale-100"
          style={{
            padding: "9px 16px",
            background: "white",
            color: INK,
            border: `1.5px solid ${LINE}`,
            borderRadius: 10,
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          <SkipForward className="w-4 h-4" />
          Step
        </button>

        <span
          className="tabular-nums ml-auto"
          style={{ fontSize: 13, fontWeight: 700, color: MUTED }}
        >
          Generation {stage.gen}
          {" / "}
          {GENS}
        </span>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[1fr_260px]">
        {/* ── The week ── */}
        <div className="min-w-0">
          <MethodWeek week={stage.week} animate={!reduceMotion} />

          <motion.p
            key={stage.gen}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginTop: 14 }}
          >
            {stage.note}
          </motion.p>
        </div>

        {/* ── Score + goal bars ── */}
        <div className="min-w-0">
          {/* Score, as a decorative figure with the hand-made line to beat. */}
          <div
            className="rounded-2xl p-4"
            style={{ background: "#f4f8ff", border: `1px solid ${LINE}` }}
          >
            <div className="flex items-baseline gap-2">
              <motion.span
                key={stage.score}
                initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="tabular-nums"
                style={{
                  fontFamily: "var(--font-feather)",
                  fontSize: 44,
                  fontWeight: 700,
                  color: stage.score >= HAND_MADE_SCORE ? BLUE : "#c2553f",
                  lineHeight: 1,
                }}
              >
                {stage.score}
              </motion.span>
              {scoreDelta !== 0 && (
                <span
                  className="tabular-nums"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: scoreDelta > 0 ? "#17a673" : "#c2553f",
                  }}
                >
                  {scoreDelta > 0 ? "+" : ""}
                  {scoreDelta}
                </span>
              )}
            </div>

            {/* Track with a fixed baseline marker at the hand-made score. */}
            <div className="relative mt-3" style={{ height: 8 }}>
              <div
                className="absolute inset-0 rounded-full overflow-hidden"
                style={{ background: "#e2edfa" }}
              >
                <motion.div
                  className="h-full rounded-full"
                  animate={{ width: `${toPct(stage.score)}%` }}
                  transition={{ duration: reduceMotion ? 0 : 0.55, ease: "easeOut" }}
                  style={{ background: BLUE }}
                />
              </div>
              <span
                aria-hidden="true"
                className="absolute"
                style={{
                  left: `${toPct(HAND_MADE_SCORE)}%`,
                  top: -4,
                  bottom: -4,
                  width: 2,
                  background: "#0f2748",
                  borderRadius: 1,
                }}
              />
            </div>
            <p style={{ fontSize: 11, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>
              Planned by hand
              {" = "}
              {HAND_MADE_SCORE}
              {" — the black line."}
            </p>
          </div>

          {/* Goal bars, filling as the score rises. */}
          <p
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: MUTED,
              margin: "18px 0 10px",
            }}
          >
            Six goals
          </p>
          <div className="flex flex-col gap-2.5">
            {GOALS.map((goal) => (
              <div key={goal.key}>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="truncate"
                    style={{ fontSize: 11.5, fontWeight: 600, color: INK }}
                  >
                    {goal.name}
                  </span>
                  <span
                    className="tabular-nums shrink-0"
                    style={{ fontSize: 10.5, fontWeight: 700, color: MUTED }}
                  >
                    {Math.round(WEIGHTS[goal.key as GoalKey] * 100)}%
                  </span>
                </div>
                <div
                  className="rounded-full overflow-hidden mt-1"
                  style={{ height: 5, background: "#e2edfa" }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    animate={{ width: `${stage.goals[goal.key as GoalKey] * 100}%` }}
                    transition={{ duration: reduceMotion ? 0 : 0.55, ease: "easeOut" }}
                    style={{ background: BLUE }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

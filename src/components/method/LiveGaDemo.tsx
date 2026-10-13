"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { DEFAULT_CONFIG } from "@/lib/ga/constants";
import MethodWeek from "./MethodWeek";
import { BLUE, GOALS, INK, LINE, MUTED } from "./methodData";
import { GENS, POP, runDemo, type DemoRun } from "./demoRun";

/** Playback speed once a run has been computed. */
const FRAME_MS = 320;

/** Scores sit in the 60s–80s, so the bars are zoomed to that range; from 0 the run would barely move. */
const AXIS_MIN = 55;
const AXIS_MAX = 90;
const toPct = (v: number) => Math.max(0, Math.min(100, ((v - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * 100));

/**
 * The real planner, run in the browser: planDays() evolves an order of topics
 * and packs it onto the example learner's free days. See ./demoRun.
 */
export default function LiveGaDemo({ showGoals = false, moreLink = true }: { showGoals?: boolean; moreLink?: boolean }) {
  const reduceMotion = useReducedMotion();
  const [run, setRun] = useState<DemoRun | null>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const last = run ? run.frames.length - 1 : 0;
  const atEnd = run !== null && frame >= last;
  const shot = run?.frames[frame] ?? null;

  useEffect(() => {
    if (!playing || !run) return;
    timer.current = setInterval(() => {
      setFrame((f) => {
        if (f >= run.frames.length - 1) {
          setPlaying(false);
          return f;
        }
        return f + 1;
      });
    }, FRAME_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, run]);

  const start = () => {
    const r = runDemo(undefined, 1);
    setRun(r);
    setFrame(reduceMotion ? r.frames.length - 1 : 0);
    setPlaying(!reduceMotion);
  };

  const handleRun = () => {
    if (!run || atEnd) return start();
    setPlaying((p) => !p);
  };

  const button = "inline-flex items-center gap-2 transition-transform hover:scale-[1.04] active:scale-[0.97]";

  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: "white", border: `1px solid ${LINE}`, boxShadow: "0 4px 0 #dceaf9" }}>
      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${LINE}`, background: "#fbfdff" }}>
        <button
          type="button"
          onClick={handleRun}
          className={button}
          style={{ padding: "9px 18px", background: BLUE, color: "white", borderRadius: 10, fontSize: 13.5, fontWeight: 700, boxShadow: "0 3px 0 #1670be" }}
        >
          {!run ? (
            <><Play className="w-4 h-4" />Run it</>
          ) : atEnd ? (
            <><RotateCcw className="w-4 h-4" />Run again</>
          ) : playing ? (
            <><Pause className="w-4 h-4" />Pause</>
          ) : (
            <><Play className="w-4 h-4" />Resume</>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setFrame((f) => Math.min(f + 1, last));
          }}
          disabled={!run || atEnd}
          className={`${button} disabled:opacity-40 disabled:hover:scale-100`}
          style={{ padding: "9px 16px", background: "white", color: INK, border: `1.5px solid ${LINE}`, borderRadius: 10, fontSize: 13.5, fontWeight: 700 }}
        >
          <SkipForward className="w-4 h-4" />
          Step
        </button>
        <span className="tabular-nums ml-auto" style={{ fontSize: 13, fontWeight: 700, color: MUTED }}>
          {shot ? `Round ${shot.generation} of up to ${GENS}` : `${POP} drafts, up to ${GENS} rounds`}
        </span>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_240px]">
        {/* ── The best draft's week ── */}
        <div className="min-w-0">
          <MethodWeek week={shot?.week ?? {}} animate={!reduceMotion} />
          <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6, marginTop: 12 }}>
            {!run
              ? `Press Run it. The planner's own code runs in your browser: ${POP} draft orders of topics, each laid onto this learner's free days, scored and bred round after round.`
              : atEnd
                ? `Stopped after ${run.generationsRun} rounds — ${DEFAULT_CONFIG.convergencePatience} rounds in a row found nothing better. The whole population has caught up with the best draft.`
                : "The best draft's week. Watch the average and the worst climb towards the best as weak drafts are bred out."}
          </p>
        </div>

        {/* ── Scores ── */}
        <div className="min-w-0 flex flex-col gap-4">
          <div className="rounded-2xl p-4" style={{ background: "#f4f8ff", border: `1px solid ${LINE}` }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: MUTED }}>Best draft</p>
            <motion.span
              key={shot?.best ?? "idle"}
              initial={reduceMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="tabular-nums block"
              style={{ fontFamily: "var(--font-feather)", fontSize: 42, fontWeight: 700, color: BLUE, lineHeight: 1.05 }}
            >
              {shot ? shot.best : "—"}
            </motion.span>
            <div className="mt-3 flex flex-col gap-2.5">
              {(
                [
                  ["Best", shot?.best, BLUE],
                  ["Average", shot?.average, "#5fa8e8"],
                  ["Worst", shot?.worst, "#a9c8e6"],
                ] as const
              ).map(([label, value, color]) => (
                <div key={label}>
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>{label}</span>
                    <span className="tabular-nums" style={{ fontSize: 11.5, fontWeight: 700, color: INK }}>{value ?? "—"}</span>
                  </div>
                  <div className="relative rounded-full mt-1" style={{ height: 6, background: "#e2edfa" }}>
                    <motion.div
                      className="h-full rounded-full"
                      animate={{ width: value ? `${toPct(value)}%` : "0%" }}
                      transition={{ duration: reduceMotion ? 0 : 0.3, ease: "easeOut" }}
                      style={{ background: color }}
                    />
                    {/* The simple rule the GA is measured against. */}
                    {run && (
                      <span
                        aria-hidden="true"
                        className="absolute"
                        style={{ left: `${toPct(run.baseline.score)}%`, top: -3, height: 12, width: 2, background: INK, borderRadius: 1 }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.45, marginTop: 10 }}>
              {run ? (
                <>
                  Dark tick: <b style={{ color: INK }}>{run.baseline.score}</b>, the plan from a simple rule (weakest topics first,
                  basics before) with no evolution.
                </>
              ) : (
                "Scored by the same function that makes every learner's plan."
              )}
            </p>
          </div>

          {showGoals && (
            <div className="rounded-2xl p-4" style={{ background: "#f4f8ff", border: `1px solid ${LINE}` }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: MUTED }}>Six goals, best draft</p>
              <div className="mt-2.5 flex flex-col gap-2">
                {GOALS.map((g) => {
                  const v = shot?.goals[g.key];
                  return (
                    <div key={g.key}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate" style={{ fontSize: 10.5, fontWeight: 600, color: MUTED }}>{g.name}</span>
                        <span className="tabular-nums" style={{ fontSize: 10.5, fontWeight: 700, color: INK }}>{v === undefined ? "—" : Math.round(v * 100)}</span>
                      </div>
                      <div className="rounded-full overflow-hidden mt-0.5" style={{ height: 4, background: "#e2edfa" }}>
                        <motion.div
                          className="h-full rounded-full"
                          animate={{ width: v === undefined ? "0%" : `${Math.round(v * 100)}%` }}
                          transition={{ duration: reduceMotion ? 0 : 0.3 }}
                          style={{ background: BLUE }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {moreLink && (
            <Link
              href="/ga"
              className={`${button} w-full justify-center`}
              style={{ padding: "11px 16px", background: "white", color: INK, border: `1.5px solid ${LINE}`, borderRadius: 11, fontSize: 13.5, fontWeight: 700, textDecoration: "none" }}
            >
              More about GA
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

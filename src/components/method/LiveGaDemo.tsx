"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { BLUE, INK, LINE, MUTED, SUBJECT_COLORS } from "./methodData";
import { DAY_LABELS, GENS, POP, useLiveGa } from "./useLiveGa";

/** Playback speed once a run has been computed. */
const FRAME_MS = 260;

/** The interesting range is roughly 55–95, so the axis is zoomed to it.
 *  Drawn from 0 the whole run would be a barely-moving sliver. */
const AXIS_MIN = 50;
const AXIS_MAX = 95;
const toPct = (v: number) =>
  Math.max(0, Math.min(100, ((v - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * 100));

/** Wed and Sat, matching FREE_DAYS in useLiveGa. */
const BUSY = new Set([3, 6]);

export default function LiveGaDemo() {
  const reduceMotion = useReducedMotion();
  const { snapshots, frame, setFrame, start } = useLiveGa();
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const last = snapshots ? snapshots.length - 1 : 0;
  const atEnd = snapshots !== null && frame >= last;
  const shot = snapshots?.[frame] ?? null;

  useEffect(() => {
    if (!playing || !snapshots) return;
    timer.current = setInterval(() => {
      setFrame((f) => {
        if (f >= snapshots.length - 1) {
          setPlaying(false);
          return f;
        }
        return f + 1;
      });
    }, FRAME_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, snapshots, setFrame]);

  const handleRun = () => {
    if (!snapshots || atEnd) {
      start();
      setPlaying(!reduceMotion);
      return;
    }
    setPlaying((p) => !p);
  };

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{ background: "white", border: `1px solid ${LINE}`, boxShadow: "0 4px 0 #dceaf9" }}
    >
      {/* ── Controls ── */}
      <div
        className="flex flex-wrap items-center gap-3 px-5 py-4"
        style={{ borderBottom: `1px solid ${LINE}`, background: "#fbfdff" }}
      >
        <button
          type="button"
          onClick={handleRun}
          className="inline-flex items-center gap-2 transition-transform hover:scale-[1.04] active:scale-[0.97]"
          style={{
            padding: "9px 18px",
            background: BLUE,
            color: "white",
            borderRadius: 10,
            fontSize: 13.5,
            fontWeight: 700,
            boxShadow: "0 3px 0 #1670be",
          }}
        >
          {!snapshots ? (
            <>
              <Play className="w-4 h-4" />
              Run it
            </>
          ) : atEnd ? (
            <>
              <RotateCcw className="w-4 h-4" />
              Run again
            </>
          ) : playing ? (
            <>
              <Pause className="w-4 h-4" />
              Pause
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Resume
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setFrame((f) => Math.min(f + 1, last));
          }}
          disabled={!snapshots || atEnd}
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

        <span className="tabular-nums ml-auto" style={{ fontSize: 13, fontWeight: 700, color: MUTED }}>
          {shot ? (
            <>
              Generation {shot.generation}
              {" / "}
              {GENS}
            </>
          ) : (
            <>
              {POP}
              {" drafts, "}
              {GENS}
              {" generations"}
            </>
          )}
        </span>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[1fr_230px]">
        {/* ── The week ── */}
        <div className="min-w-0">
          <div className="overflow-x-auto">
            <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(7,minmax(72px,1fr))" }}>
              {DAY_LABELS.map((label, dayIndex) => {
                const busy = BUSY.has(dayIndex);
                const sessions = shot?.week[dayIndex] ?? [];

                return (
                  <div key={label} className="min-w-0">
                    <div
                      className="flex flex-col items-center rounded-t-lg"
                      style={{
                        padding: "6px 2px",
                        background: busy ? "#eef2f7" : "#e8f1fd",
                        borderBottom: `1px solid ${LINE}`,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: busy ? MUTED : INK }}>
                        {label}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          letterSpacing: ".04em",
                          textTransform: "uppercase",
                          color: busy ? "#93a7c0" : "transparent",
                        }}
                      >
                        Busy
                      </span>
                    </div>
                    <div
                      className="flex flex-col gap-1.5 rounded-b-lg p-1.5"
                      style={{
                        minHeight: 150,
                        background: busy
                          ? "repeating-linear-gradient(45deg,#f7f9fc,#f7f9fc 5px,#eef2f7 5px,#eef2f7 10px)"
                          : "#fbfdff",
                        border: `1px solid ${LINE}`,
                        borderTop: "none",
                      }}
                    >
                      <AnimatePresence mode="popLayout" initial={false}>
                        {sessions.map((s) => {
                          const c = SUBJECT_COLORS[s.subject] ?? SUBJECT_COLORS.MATH;
                          return (
                            <motion.div
                              key={`${s.subject}-${s.lesson}`}
                              layout={!reduceMotion}
                              initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.85 }}
                              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                              className="min-w-0"
                              style={{
                                background: c.bg,
                                color: c.fg,
                                borderRadius: 7,
                                padding: "5px 6px",
                              }}
                            >
                              <span
                                className="block"
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  letterSpacing: ".05em",
                                  textTransform: "uppercase",
                                  opacity: 0.75,
                                }}
                              >
                                {c.label}
                              </span>
                              <span
                                className="block"
                                style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.25 }}
                              >
                                {s.lesson}
                              </span>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>

                      {!shot && !busy ? (
                        <div className="flex-1 flex items-center justify-center">
                          <span style={{ fontSize: 10.5, color: "#b9c9dd" }}>—</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6, marginTop: 12 }}>
            {shot
              ? "The whole population improves, not just the winner — the gap between the worst draft and the best one closes as the weak ones are bred out."
              : "Press Run it. Fifty timetables are drafted at random, then scored and bred for a hundred rounds — in your browser, right now."}
          </p>
        </div>

        {/* ── Scores ── */}
        <div className="min-w-0">
          <div
            className="rounded-2xl p-4"
            style={{ background: "#f4f8ff", border: `1px solid ${LINE}` }}
          >
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: MUTED,
              }}
            >
              Best draft
            </p>
            <motion.span
              key={shot?.best ?? "idle"}
              initial={reduceMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="tabular-nums block"
              style={{
                fontFamily: "var(--font-feather)",
                fontSize: 42,
                fontWeight: 700,
                color: BLUE,
                lineHeight: 1.05,
              }}
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
                    <span
                      className="tabular-nums"
                      style={{ fontSize: 11.5, fontWeight: 700, color: INK }}
                    >
                      {value ?? "—"}
                    </span>
                  </div>
                  <div
                    className="rounded-full overflow-hidden mt-1"
                    style={{ height: 6, background: "#e2edfa" }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      animate={{ width: value ? `${toPct(value)}%` : "0%" }}
                      transition={{ duration: reduceMotion ? 0 : 0.3, ease: "easeOut" }}
                      style={{ background: color }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.45, marginTop: 10 }}>
              Scale
              {" "}
              {AXIS_MIN}
              {"–"}
              {AXIS_MAX}
              {", scored by the same function the real planner uses."}
            </p>
          </div>

          <Link
            href="/ga"
            className="inline-flex items-center gap-2 mt-4 w-full justify-center transition-transform hover:scale-[1.03] active:scale-[0.97]"
            style={{
              padding: "11px 16px",
              background: "white",
              color: INK,
              border: `1.5px solid ${LINE}`,
              borderRadius: 11,
              fontSize: 13.5,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            More about GA
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "motion/react";
import { BUSY_DAYS, DAYS, INK, LINE, MUTED, SUBJECT_COLORS, type Week } from "./methodData";

/**
 * One week of study sessions, laid out Mon–Sun.
 *
 * Shared by the evolution demo and the side-by-side comparison so both read as
 * the same object — the comparison is only convincing if the two timetables are
 * drawn identically.
 */
export default function MethodWeek({
  week,
  animate = false,
  minColumnHeight = 132,
}: {
  week: Week;
  /** Animate chips in and out as the week changes between generations. */
  animate?: boolean;
  minColumnHeight?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(7,minmax(74px,1fr))" }}>
        {DAYS.map((day) => {
          const busy = BUSY_DAYS.has(day);
          const sessions = week[day] ?? [];

          return (
            <div key={day} className="min-w-0">
              <div
                className="flex flex-col items-center justify-center rounded-t-lg"
                style={{
                  padding: "6px 2px",
                  background: busy ? "#eef2f7" : "#e8f1fd",
                  borderBottom: `1px solid ${LINE}`,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: busy ? MUTED : INK }}>
                  {day}
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
                  minHeight: minColumnHeight,
                  background: busy
                    ? "repeating-linear-gradient(45deg,#f7f9fc,#f7f9fc 5px,#eef2f7 5px,#eef2f7 10px)"
                    : "#fbfdff",
                  border: `1px solid ${LINE}`,
                  borderTop: "none",
                }}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  {sessions.map((s, i) => {
                    const c = SUBJECT_COLORS[s.subject];
                    const chip = (
                      <>
                        <span
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
                          className="block truncate"
                          style={{ fontSize: 10.5, fontWeight: 600, marginTop: 1 }}
                        >
                          {s.lesson}
                        </span>
                      </>
                    );

                    const style = {
                      background: c.bg,
                      color: c.fg,
                      borderRadius: 7,
                      padding: "5px 6px",
                      // A session on a day the learner isn't free is the clearest
                      // single defect to see, so it is outlined rather than just
                      // sitting on the hatched background.
                      outline: busy ? "1.5px solid #e0645c" : "none",
                    };

                    if (!animate) {
                      return (
                        <div key={`${s.subject}-${s.lesson}-${i}`} className="min-w-0" style={style}>
                          {chip}
                        </div>
                      );
                    }

                    return (
                      <motion.div
                        key={`${s.subject}-${s.lesson}`}
                        layout
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="min-w-0"
                        style={style}
                      >
                        {chip}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

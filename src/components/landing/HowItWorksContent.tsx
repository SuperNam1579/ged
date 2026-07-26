"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Check, RefreshCw, TrendingDown } from "lucide-react";
import LandingNavbar from "@/components/layout/LandingNavbar";
import LandingFooter from "@/components/layout/LandingFooter";
import { LANDING_SUBJECTS, TOTAL_TOPICS } from "@/components/landing/subjects";
import { DEFAULT_CONFIG } from "@/lib/ga/constants";
import { WEIGHTS } from "@/lib/ga/fitness";

const INK = "#0f2748";
const MUTED = "#5b769a";
const RULE = "#dceaf9";

/** Fade-and-lift once, when the card first scrolls into view. */
const inView = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

function Card({
  num,
  eyebrow,
  title,
  body,
  color,
  visual,
  last,
}: {
  num: string;
  eyebrow: string;
  title: string;
  body: string;
  color: string;
  visual: ReactNode;
  last?: boolean;
}) {
  return (
    <motion.div {...inView} className="relative flex gap-4 md:gap-6 pb-6">
      {/* Trail connecting the steps, stopping at the last one */}
      {!last && (
        <span
          aria-hidden="true"
          className="absolute"
          style={{ left: 25, top: 62, bottom: 0, width: 4, background: RULE, borderRadius: 2 }}
        />
      )}

      <span
        className="relative shrink-0 flex items-center justify-center tabular-nums"
        style={{
          width: 54,
          height: 54,
          borderRadius: "50%",
          background: "white",
          border: `4px solid ${color}`,
          boxShadow: `0 4px 0 ${color}33`,
          color,
          fontFamily: "var(--font-feather)",
          fontWeight: 700,
          fontSize: 17,
        }}
      >
        {num}
      </span>

      <div
        className="flex-1 min-w-0 rounded-2xl overflow-hidden"
        style={{ background: "white", boxShadow: "0 4px 0 " + RULE }}
      >
        <div className="px-5 pt-4 pb-3">
          <p
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color,
              marginBottom: 4,
            }}
          >
            {eyebrow}
          </p>
          <h2
            className="text-[19px] md:text-[22px]"
            style={{ fontFamily: "var(--font-feather)", fontWeight: 700, color: INK, lineHeight: 1.2 }}
          >
            {title}
          </h2>
          <p
            className="text-[14px] md:text-[14.5px]"
            style={{ color: MUTED, lineHeight: 1.65, marginTop: 6 }}
          >
            {body}
          </p>
        </div>
        {/* Every step carries a small mock-up of the screen it describes, so the
            page shows the product rather than only narrating it. */}
        <div className="px-5 pb-5">{visual}</div>
      </div>
    </motion.div>
  );
}

/** Shared shell for the little UI mock-ups inside each card. */
function Mock({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-xl p-3.5"
      style={{ background: "#f8fbff", border: `1px solid ${RULE}` }}
    >
      {children}
    </div>
  );
}


/** The six scoring goals, quoted from the fitness function itself. */
const OBJECTIVES = [
  { key: "coverage", name: "Reaches your weak spots", hint: "Anything scoring under 60" },
  { key: "weaknessFocus", name: "More time where you're weakest", hint: "The lower the score, the more time" },
  { key: "timeFeasibility", name: "Fits the hours you have", hint: "No day packed past your free time" },
  { key: "prerequisiteOrder", name: "Basics before the hard stuff", hint: "No quadratics before expressions" },
  { key: "variety", name: "Mixes your subjects", hint: "Not one subject for a whole week" },
  { key: "balance", name: "Spreads out the hard days", hint: "No two heavy days back to back" },
] as const;

/**
 * The algorithm gets a card of its own: it's the part that turns a diagnostic
 * into a timetable, and the only part a visitor can't guess at.
 */
function GaCard() {
  const weights = WEIGHTS;
  const top = Math.max(...OBJECTIVES.map((o) => weights[o.key]));

  return (
    <motion.div {...inView} className="relative flex gap-4 md:gap-6 pb-6">
      <span
        aria-hidden="true"
        className="absolute"
        style={{ left: 25, top: 62, bottom: 0, width: 4, background: RULE, borderRadius: 2 }}
      />
      <span
        className="relative shrink-0 flex items-center justify-center tabular-nums"
        style={{
          width: 54,
          height: 54,
          borderRadius: "50%",
          background: "#0f2748",
          border: "4px solid #0f2748",
          boxShadow: "0 4px 0 rgba(15,39,72,.25)",
          color: "white",
          fontFamily: "var(--font-feather)",
          fontWeight: 700,
          fontSize: 17,
        }}
      >
        04
      </span>

      <div
        className="flex-1 min-w-0 rounded-2xl overflow-hidden"
        style={{ background: "#0f2748", boxShadow: "0 4px 0 rgba(15,39,72,.25)" }}
      >
        <div className="px-5 pt-4 pb-4">
          <p
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "#7fb6e8",
              marginBottom: 4,
            }}
          >
            The planner
          </p>
          <h2
            className="text-[19px] md:text-[24px]"
            style={{ fontFamily: "var(--font-feather)", fontWeight: 700, color: "white", lineHeight: 1.2 }}
          >
            {DEFAULT_CONFIG.populationSize} draft timetables compete
          </h2>
          <p
            className="text-[14px] md:text-[14.5px]"
            style={{ color: "rgba(255,255,255,.62)", lineHeight: 1.65, marginTop: 6 }}
          >
            They run against each other for {DEFAULT_CONFIG.generations} rounds. Each round keeps the
            best ones, mixes them, and throws the rest away. Every draft is judged on six things at
            the same time — the bars show how much each one counts.
          </p>

          <div className="flex flex-col gap-2.5 mt-5">
            {OBJECTIVES.map((o, i) => (
              <motion.div
                key={o.key}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 + i * 0.07, duration: 0.35 }}
                className="grid gap-x-3 items-center"
                style={{ gridTemplateColumns: "1fr 78px 34px" }}
              >
                <div className="min-w-0">
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: "white", lineHeight: 1.3 }}>
                    {o.name}
                  </p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,.45)", lineHeight: 1.35 }}>
                    {o.hint}
                  </p>
                </div>
                <span
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,.14)" }}
                >
                  <motion.span
                    className="block h-full rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${(weights[o.key] / top) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.25 + i * 0.07, duration: 0.6, ease: "easeOut" }}
                    style={{ background: "#4aa8f0" }}
                  />
                </span>
                <span
                  className="tabular-nums text-right"
                  style={{ fontSize: 12, fontWeight: 700, color: "#4aa8f0" }}
                >
                  {Math.round(weights[o.key] * 100)}%
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function HowItWorksContent() {
  const [math, rla, science, social] = LANDING_SUBJECTS;
  const sampleLesson = math.categories[0].topics[0].subtopics[1];

  return (
    <>
      <LandingNavbar />

      {/* ── Masthead ── */}
      <header
        className="px-5 md:px-10"
        style={{
          background: "linear-gradient(160deg,#e8f2ff 0%,#f4f8ff 70%)",
          paddingTop: 64 + 52,
          paddingBottom: 40,
        }}
      >
        <div className="max-w-[880px] mx-auto">
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: "#1e90e8",
              marginBottom: 12,
            }}
          >
            How it works
          </p>
          <h1
            className="text-[36px] md:text-[52px]"
            style={{
              fontFamily: "var(--font-feather)",
              fontWeight: 700,
              color: INK,
              lineHeight: 1.05,
            }}
          >
            From first click to exam day.
          </h1>
          <p
            className="text-[15px] md:text-[16px]"
            style={{ color: MUTED, lineHeight: 1.65, marginTop: 16, maxWidth: 540 }}
          >
            Seven steps. You do six of them — step four is the part we handle.
          </p>
        </div>
      </header>

      <main className="px-5 md:px-10 py-12" style={{ background: "#f4f8ff" }}>
        <div className="max-w-[880px] mx-auto">
          {/* 01 — subjects */}
          <Card
            num="01"
            eyebrow="Setup"
            color={math.color}
            title="Pick your subjects"
            body="Take all four, or just the ones you still need. Your test, your schedule, everything after this follows what you pick here."
            visual={
              <Mock>
                <div className="flex flex-col gap-2">
                  {LANDING_SUBJECTS.map((s, i) => {
                    const picked = i === 0 || i === 3;
                    return (
                      <motion.div
                        key={s.slug}
                        initial={{ opacity: 0, x: -8 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 + i * 0.07, duration: 0.3 }}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2"
                        style={{
                          background: picked ? s.iconBg : "white",
                          border: `1px solid ${picked ? s.color : RULE}`,
                        }}
                      >
                        <span
                          className="shrink-0 flex items-center justify-center"
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 4,
                            background: picked ? s.color : "white",
                            border: `1.5px solid ${picked ? s.color : "#c9d9ee"}`,
                          }}
                        >
                          {picked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />}
                        </span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>
                          {s.shortName}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </Mock>
            }
          />

          {/* 02 — exam date + availability */}
          <Card
            num="02"
            eyebrow="Setup"
            color={rla.color}
            title="Exam date and free hours"
            body="Tell us your exam date and which hours you are free each week. Your plan only uses those hours, so it fits your real life."
            visual={
              <Mock>
                <div
                  className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 mb-3"
                  style={{ background: "white", border: `1px solid ${RULE}` }}
                >
                  <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>Exam</span>
                  <span style={{ fontSize: 12, color: INK, fontWeight: 700 }}>18 Oct</span>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => {
                    const free = [0, 2, 4, 5].includes(i);
                    return (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <span style={{ fontSize: 9.5, color: MUTED, fontWeight: 700 }}>{d}</span>
                        <motion.span
                          initial={{ scaleY: 0 }}
                          whileInView={{ scaleY: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.15 + i * 0.05, duration: 0.35 }}
                          className="w-full rounded"
                          style={{
                            height: free ? 30 : 12,
                            background: free ? rla.color : "#e6eefa",
                            transformOrigin: "bottom",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </Mock>
            }
          />

          {/* 03 — diagnostic */}
          <Card
            num="03"
            eyebrow="Diagnostic"
            color={science.color}
            title="A short test to see where you are"
            body={`Ten questions for each subject you picked. Every question belongs to one lesson, so you get a score for each of the ${TOTAL_TOPICS} lessons — not just one score per subject.`}
            visual={
              <Mock>
                <div className="flex flex-col gap-2">
                  {[
                    { name: "Integer Operations", score: 82 },
                    { name: sampleLesson.name, score: 41 },
                    { name: "Ratios & Rates", score: 58 },
                  ].map((row, i) => (
                    <div key={row.name} className="flex items-center gap-2.5">
                      <span
                        className="truncate"
                        style={{ fontSize: 11.5, color: INK, fontWeight: 600, width: 150 }}
                      >
                        {row.name}
                      </span>
                      <span
                        className="flex-1 h-2 rounded-full overflow-hidden"
                        style={{ background: "#e6eefa" }}
                      >
                        <motion.span
                          className="block h-full rounded-full"
                          initial={{ width: 0 }}
                          whileInView={{ width: `${row.score}%` }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.2 + i * 0.1, duration: 0.6, ease: "easeOut" }}
                          style={{ background: row.score < 60 ? "#EF4444" : science.color }}
                        />
                      </span>
                      <span
                        className="tabular-nums shrink-0"
                        style={{ fontSize: 11, fontWeight: 700, color: MUTED, width: 24 }}
                      >
                        {row.score}
                      </span>
                    </div>
                  ))}
                </div>
              </Mock>
            }
          />

          {/* 04 — the algorithm, given its own treatment */}
          <GaCard />

          {/* 05 — study + quiz */}
          <Card
            num="05"
            eyebrow="Study"
            color={social.color}
            title="Work the plan, take the quiz"
            body="One session a day, then a quiz on that lesson. Your score updates each time: 70% from the new result, 30% from before. It moves quickly, but one bad day will not wreck it."
            visual={
              <Mock>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>Today</p>
                    <p style={{ fontSize: 13, color: INK, fontWeight: 700 }}>{sampleLesson.name}</p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1"
                    style={{ background: social.iconBg, color: social.color, fontSize: 11, fontWeight: 700 }}
                  >
                    {sampleLesson.minutes} min
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>41</span>
                  <span className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#e6eefa" }}>
                    <motion.span
                      className="block h-full rounded-full"
                      initial={{ width: "41%" }}
                      whileInView={{ width: "68%" }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.35, duration: 0.8, ease: "easeOut" }}
                      style={{ background: social.color }}
                    />
                  </span>
                  <span style={{ fontSize: 11, color: social.color, fontWeight: 700 }}>68</span>
                </div>
              </Mock>
            }
          />

          {/* 06 — rebuild */}
          <Card
            num="06"
            eyebrow="Adjust"
            color="#DB2777"
            title="Change your week, or rebuild"
            body="Change your free hours any time and the schedule refits itself. And if lessons you have quizzed on are still scoring low, your dashboard tells you and offers to rebuild the plan."
            visual={
              <Mock>
                <div className="flex items-center gap-3">
                  <TrendingDown className="w-4 h-4 shrink-0" style={{ color: "#1e90e8" }} />
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#1e90e8" }}>
                      2 topics haven&apos;t stuck yet
                    </p>
                  </div>
                  <span
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                    style={{ background: "#1e90e8", color: "white", fontSize: 11, fontWeight: 700 }}
                  >
                    <RefreshCw className="w-3 h-3" />
                    Rebuild
                  </span>
                </div>
              </Mock>
            }
          />

          {/* 07 — mock test */}
          <Card
            num="07"
            eyebrow="Measure"
            color="#0891B2"
            title="Take a full practice exam"
            body="A quiz checks one lesson. A practice exam checks everything together. The results feed the same scores your planner reads."
            last
            visual={
              <Mock>
                <div className="flex items-end gap-2">
                  {[52, 61, 58, 74, 81].map((v, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <motion.span
                        className="w-full rounded"
                        initial={{ scaleY: 0 }}
                        whileInView={{ scaleY: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
                        style={{
                          height: v * 0.6,
                          background: i === 4 ? "#0891B2" : "#bcd7ee",
                          transformOrigin: "bottom",
                        }}
                      />
                      <span style={{ fontSize: 9.5, color: MUTED, fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </Mock>
            }
          />
        </div>
      </main>

      {/* ── CTA ── */}
      <section className="px-5 md:px-10 pb-14 md:pb-20" style={{ background: "#f4f8ff" }}>
        <motion.div
          {...inView}
          className="max-w-[880px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-5 rounded-2xl px-6 py-6"
          style={{ background: "white", boxShadow: "0 4px 0 " + RULE }}
        >
          <p
            className="text-[19px] md:text-[24px]"
            style={{
              fontFamily: "var(--font-feather)",
              fontWeight: 700,
              color: INK,
              lineHeight: 1.25,
              maxWidth: 440,
            }}
          >
            Step one takes about a minute.
          </p>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link
              href="/subjects"
              className="inline-flex items-center gap-2 transition-transform hover:scale-[1.03] active:scale-[0.97]"
              style={{
                padding: "13px 22px",
                background: "white",
                color: "#1e90e8",
                border: "2px solid #1e90e8",
                borderRadius: 14,
                fontSize: 15,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              See the syllabus
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 transition-transform hover:scale-[1.03] active:scale-[0.97]"
              style={{
                padding: "13px 26px",
                background: "#1e90e8",
                color: "white",
                borderRadius: 14,
                fontSize: 15,
                fontWeight: 700,
                boxShadow: "0 4px 0 #1670be",
                textDecoration: "none",
              }}
            >
              Start free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </section>

      <LandingFooter />
    </>
  );
}

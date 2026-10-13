"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Check, Flag, Lock, MoreHorizontal, Plus, RotateCcw, Trash2, ArrowLeftRight, CalendarClock, Replace } from "lucide-react";
import LandingNavbar from "@/components/layout/LandingNavbar";
import LandingFooter from "@/components/layout/LandingFooter";
import { LANDING_SUBJECTS, subtopicCount, type LandingSubject } from "@/components/landing/subjects";
import { DEFAULT_CONFIG, WEAKNESS_THRESHOLD } from "@/lib/ga/constants";
import { MAX_PART_MINUTES } from "@/lib/schedule/parts";
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

/** Hours of study a subject's content takes, from the curriculum data. */
function subjectHours(s: LandingSubject): number {
  const mins = s.categories.flatMap((c) => c.topics.flatMap((t) => t.subtopics)).reduce((n, st) => n + st.minutes, 0);
  return Math.round(mins / 60);
}

// ─── Step card ───────────────────────────────────────────────────────────────

function Step({
  num,
  eyebrow,
  title,
  body,
  color,
  visual,
  dark,
  last,
}: {
  num: string;
  eyebrow: string;
  title: string;
  body: ReactNode;
  color: string;
  visual: ReactNode;
  /** The planner's step: the part we do, set apart from the learner's. */
  dark?: boolean;
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
          background: dark ? INK : "white",
          border: `4px solid ${dark ? INK : color}`,
          boxShadow: `0 4px 0 ${dark ? "rgba(15,39,72,.25)" : color + "33"}`,
          color: dark ? "white" : color,
          fontFamily: "var(--font-feather)",
          fontWeight: 700,
          fontSize: 17,
        }}
      >
        {num}
      </span>

      <div
        className="flex-1 min-w-0 rounded-2xl overflow-hidden"
        style={{ background: dark ? INK : "white", boxShadow: `0 4px 0 ${dark ? "rgba(15,39,72,.25)" : RULE}` }}
      >
        {/* Words on the left, the picture on the right; stacked on a phone. */}
        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-5 p-5">
          <div className="min-w-0">
            <p
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: dark ? "#7fb6e8" : color,
                marginBottom: 4,
              }}
            >
              {eyebrow}
            </p>
            <h2
              className="text-[19px] md:text-[22px]"
              style={{ fontFamily: "var(--font-feather)", fontWeight: 700, color: dark ? "white" : INK, lineHeight: 1.2 }}
            >
              {title}
            </h2>
            <div
              className="text-[14px] md:text-[14.5px] space-y-2"
              style={{ color: dark ? "rgba(255,255,255,.66)" : MUTED, lineHeight: 1.65, marginTop: 8 }}
            >
              {body}
            </div>
          </div>
          <div className="min-w-0 self-center">{visual}</div>
        </div>
      </div>
    </motion.div>
  );
}

/** The frame the pictures sit in. */
function Frame({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: dark ? "rgba(255,255,255,.06)" : "#f8fbff", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : RULE}` }}
    >
      {children}
    </div>
  );
}

// ─── Pictures ────────────────────────────────────────────────────────────────

/** 1 — the four subjects, two picked. */
function SubjectsPicture({ picked }: { picked: string[] }) {
  return (
    <Frame>
      <div className="grid grid-cols-2 gap-2">
        {LANDING_SUBJECTS.map((s, i) => {
          const on = picked.includes(s.code);
          return (
            <motion.div
              key={s.slug}
              initial={{ opacity: 0, scale: 0.94 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.3 }}
              className="relative rounded-xl px-3 py-2.5"
              style={{ background: on ? s.iconBg : "white", border: `1.5px solid ${on ? s.color : RULE}` }}
            >
              {on && (
                <span
                  className="absolute top-2 right-2 flex items-center justify-center rounded-full"
                  style={{ width: 16, height: 16, background: s.color }}
                >
                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />
                </span>
              )}
              <p style={{ fontSize: 12.5, fontWeight: 700, color: on ? INK : MUTED }}>{s.shortName}</p>
              <p className="tabular-nums" style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                {subtopicCount(s)} topics · {subjectHours(s)} h
              </p>
            </motion.div>
          );
        })}
      </div>
    </Frame>
  );
}

/** 2 — a usual week, and the fit check's answer. */
function FreeTimePicture({ need, have }: { need: number; have: number }) {
  const week = [2, 2, 2, 2, 2, 4, 4]; // hours free each day, Mon–Sun
  return (
    <Frame>
      <div className="grid grid-cols-7 gap-1.5 items-end" style={{ height: 78 }}>
        {week.map((h, i) => (
          <div key={i} className="flex flex-col items-center justify-end gap-1 h-full">
            <motion.span
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.35 }}
              className="w-full rounded-md"
              style={{ height: h * 14, background: "#16A34A", opacity: 0.85, transformOrigin: "bottom" }}
            />
            <span style={{ fontSize: 9.5, color: MUTED, fontWeight: 700 }}>{"MTWTFSS"[i]}</span>
          </div>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.55, duration: 0.35 }}
        className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2"
        style={{ background: "#ecfdf3", border: "1px solid #bbf0cf" }}
      >
        <span className="flex items-center justify-center rounded-full shrink-0" style={{ width: 18, height: 18, background: "#16A34A" }}>
          <Check className="w-3 h-3 text-white" strokeWidth={4} />
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#166534" }}>Fits</span>
        <span className="ml-auto tabular-nums" style={{ fontSize: 11.5, color: "#166534" }}>
          {need} h needed · {have} h free
        </span>
      </motion.div>
    </Frame>
  );
}

/** 3 — a score for every topic. */
function ScoresPicture({ rows }: { rows: { name: string; score: number }[] }) {
  return (
    <Frame>
      <div className="flex flex-col gap-2.5">
        {rows.map((row, i) => {
          const tone = row.score < 60 ? "#EF4444" : row.score < 75 ? "#F59E0B" : "#16A34A";
          return (
            <div key={row.name} className="flex items-center gap-2.5">
              <span className="truncate" style={{ fontSize: 11.5, color: INK, fontWeight: 600, width: 128 }}>
                {row.name}
              </span>
              <span className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "#e6eefa" }}>
                <motion.span
                  className="block h-full rounded-full"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${row.score}%` }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 + i * 0.1, duration: 0.6, ease: "easeOut" }}
                  style={{ background: tone }}
                />
              </span>
              <span className="tabular-nums shrink-0 text-right" style={{ fontSize: 11, fontWeight: 700, color: tone, width: 22 }}>
                {row.score}
              </span>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

/** 4 — the plan filling every day up to the exam, review at the end. */
function PlanPicture({ colors }: { colors: [string, string] }) {
  const days = 35;
  return (
    <Frame dark>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: days }, (_, i) => {
          const exam = i === days - 1;
          const review = i >= days - 3 && !exam;
          const weekend = i % 7 >= 5;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.6 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 + i * 0.025, duration: 0.25 }}
              className="flex items-center justify-center gap-0.5 rounded-md"
              style={{
                height: 26,
                background: exam ? "#EF4444" : "rgba(255,255,255,.08)",
              }}
            >
              {exam ? (
                <Flag className="w-3 h-3 text-white" />
              ) : review ? (
                <RotateCcw className="w-3 h-3" style={{ color: "#5eead4" }} />
              ) : (
                <>
                  <span className="rounded-full" style={{ width: 6, height: 6, background: colors[i % 2] }} />
                  {weekend && <span className="rounded-full" style={{ width: 6, height: 6, background: colors[(i + 1) % 2] }} />}
                </>
              )}
            </motion.div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3" style={{ fontSize: 10.5, color: "rgba(255,255,255,.55)" }}>
        <span className="inline-flex items-center gap-1"><span className="rounded-full" style={{ width: 6, height: 6, background: colors[0] }} />Math</span>
        <span className="inline-flex items-center gap-1"><span className="rounded-full" style={{ width: 6, height: 6, background: colors[1] }} />Science</span>
        <span className="inline-flex items-center gap-1"><RotateCcw className="w-2.5 h-2.5" style={{ color: "#5eead4" }} />Review</span>
        <span className="inline-flex items-center gap-1"><Flag className="w-2.5 h-2.5" style={{ color: "#f87171" }} />Exam</span>
      </div>
    </Frame>
  );
}

/** The six things every draft timetable is scored on, with their weights from the code. */
const OBJECTIVES = [
  { key: "coverage", name: "Reaches your weak topics" },
  { key: "weaknessFocus", name: "More time where you're weakest" },
  { key: "timeFeasibility", name: "Fits the hours you have" },
  { key: "prerequisiteOrder", name: "Basics before harder topics" },
  { key: "variety", name: "Mixes your subjects" },
  { key: "balance", name: "Spreads out the hard days" },
] as const;

function Objectives() {
  const top = Math.max(...OBJECTIVES.map((o) => WEIGHTS[o.key]));
  return (
    <div className="flex flex-col gap-1.5 mt-4">
      {OBJECTIVES.map((o, i) => (
        <div key={o.key} className="grid items-center gap-x-2" style={{ gridTemplateColumns: "1fr 64px" }}>
          <span style={{ fontSize: 11.5, color: "rgba(255,255,255,.8)", fontWeight: 600 }}>{o.name}</span>
          <span className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.14)" }}>
            <motion.span
              className="block h-full rounded-full"
              initial={{ width: 0 }}
              whileInView={{ width: `${(WEIGHTS[o.key] / top) * 100}%` }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.07, duration: 0.6, ease: "easeOut" }}
              style={{ background: "#4aa8f0" }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

/** 5 — watch the videos, part 2 opens, then the quiz. */
function StudyPicture({ color }: { color: string }) {
  const R = 20;
  const C = 2 * Math.PI * R;
  const box = "flex-1 min-w-0 flex flex-col items-center gap-1.5 rounded-xl px-2 py-3";
  return (
    <Frame>
      <div className="flex items-stretch gap-1.5">
        <div className={box} style={{ background: "white", border: `1px solid ${RULE}` }}>
          <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
            <circle cx="24" cy="24" r={R} fill="none" stroke="#e6eefa" strokeWidth="5" />
            <motion.circle
              cx="24" cy="24" r={R} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={C}
              initial={{ strokeDashoffset: C }}
              whileInView={{ strokeDashoffset: C * 0.2 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.9, ease: "easeOut" }}
            />
          </svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: INK }}>Part 1</span>
          <span style={{ fontSize: 10, color: MUTED }}>80% watched</span>
        </div>
        <ArrowRight className="w-4 h-4 self-center shrink-0" style={{ color: "#b6c8de" }} />
        <div className={box} style={{ background: "white", border: `1px solid ${RULE}` }}>
          <motion.span
            className="flex items-center justify-center rounded-full"
            style={{ width: 48, height: 48 }}
            initial={{ background: "#e6eefa" }}
            whileInView={{ background: color + "22" }}
            viewport={{ once: true }}
            transition={{ delay: 1.1, duration: 0.3 }}
          >
            <motion.span initial={{ opacity: 1 }} whileInView={{ opacity: 0 }} viewport={{ once: true }} transition={{ delay: 1.1, duration: 0.2 }} className="absolute">
              <Lock className="w-5 h-5" style={{ color: "#9fb3cc" }} />
            </motion.span>
            <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 1.25, duration: 0.25 }}>
              <Check className="w-5 h-5" style={{ color }} strokeWidth={3} />
            </motion.span>
          </motion.span>
          <span style={{ fontSize: 11, fontWeight: 700, color: INK }}>Part 2</span>
          <span style={{ fontSize: 10, color: MUTED }}>opens next</span>
        </div>
        <ArrowRight className="w-4 h-4 self-center shrink-0" style={{ color: "#b6c8de" }} />
        <motion.div
          className={box}
          style={{ border: "1px solid #bbf0cf" }}
          initial={{ background: "#ffffff" }}
          whileInView={{ background: "#ecfdf3" }}
          viewport={{ once: true }}
          transition={{ delay: 1.6, duration: 0.3 }}
        >
          <span className="flex items-center justify-center tabular-nums" style={{ width: 48, height: 48, fontSize: 15, fontWeight: 800, color: "#166534" }}>
            8/10
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: INK }}>Quiz</span>
          <span style={{ fontSize: 10, color: "#166534" }}>Passed</span>
        </motion.div>
      </div>
    </Frame>
  );
}

/** 6 — a session moved to another day by the learner; the rest stay put. */
function YoursPicture({ colors }: { colors: [string, string] }) {
  const days = ["Tue", "Wed", "Thu"];
  const chip = (c: string) => ({ background: c + "1f", borderLeft: `3px solid ${c}` });
  return (
    <Frame>
      <div className="relative grid grid-cols-3 gap-2">
        {days.map((d, i) => (
          <div key={d} className="rounded-lg p-1.5 flex flex-col gap-1.5" style={{ background: "white", border: `1px solid ${RULE}`, minHeight: 96 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: MUTED }}>{d}</span>
            <span className="rounded-md h-5" style={chip(colors[i % 2])} />
            {i === 1 && <span className="rounded-md h-5" style={chip(colors[0])} />}
          </div>
        ))}
        {/* The moving session: from Tuesday's second slot to Thursday's. */}
        <motion.span
          className="absolute rounded-md h-5 flex items-center justify-end pr-1"
          style={{ ...chip(colors[1]), top: 64, width: "calc((100% - 16px) / 3 - 12px)", boxShadow: "0 4px 10px rgba(15,39,72,.12)" }}
          initial={{ left: "6px" }}
          animate={{ left: ["6px", "6px", "calc(66.666% + 4px)", "calc(66.666% + 4px)"] }}
          transition={{ duration: 3.2, times: [0, 0.3, 0.7, 1], repeat: Infinity, repeatDelay: 1, ease: "easeInOut" }}
        >
          <MoreHorizontal className="w-3 h-3" style={{ color: MUTED }} />
        </motion.span>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {[
          { icon: CalendarClock, label: "Move" },
          { icon: ArrowLeftRight, label: "Swap" },
          { icon: Replace, label: "Change topic" },
          { icon: Trash2, label: "Remove" },
          { icon: Plus, label: "Add" },
          { icon: RotateCcw, label: "Reset" },
        ].map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1" style={{ background: "white", border: `1px solid ${RULE}`, fontSize: 11, fontWeight: 600, color: INK }}>
            <Icon className="w-3 h-3" style={{ color: MUTED }} /> {label}
          </span>
        ))}
      </div>
    </Frame>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HowItWorksContent() {
  const [math, rla, science, social] = LANDING_SUBJECTS;
  // The example the pictures follow: Math and Science, three months out,
  // two hours on weekdays and four on weekend days.
  const need = subjectHours(math) + subjectHours(science);
  const have = (2 * 5 + 4 * 2) * 13;
  const mathTopics = math.categories.flatMap((c) => c.topics.flatMap((t) => t.subtopics));
  const sciTopics = science.categories.flatMap((c) => c.topics.flatMap((t) => t.subtopics));
  const scores = [
    { name: mathTopics[0]?.name ?? "Fractions", score: 42 },
    { name: sciTopics[0]?.name ?? "Cells", score: 68 },
    { name: mathTopics[5]?.name ?? "Percents", score: 86 },
  ];

  return (
    <>
      <LandingNavbar />

      {/* ── Masthead ── */}
      <header
        className="px-5 md:px-10"
        style={{ background: "linear-gradient(160deg,#e8f2ff 0%,#f4f8ff 70%)", paddingTop: 64 + 52, paddingBottom: 40 }}
      >
        <div className="max-w-[980px] mx-auto">
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "#1e90e8", marginBottom: 12 }}>
            How it works
          </p>
          <h1 className="text-[36px] md:text-[52px]" style={{ fontFamily: "var(--font-feather)", fontWeight: 700, color: INK, lineHeight: 1.05 }}>
            From sign-up to exam day.
          </h1>
          <p className="text-[15px] md:text-[16px]" style={{ color: MUTED, lineHeight: 1.65, marginTop: 16, maxWidth: 580 }}>
            You tell us what to study and when you&apos;re free. We plan every day up to your exam, once. After
            that the plan is yours to change.
          </p>
        </div>
      </header>

      <main className="px-5 md:px-10 py-12" style={{ background: "#f4f8ff" }}>
        <div className="max-w-[980px] mx-auto">
          <Step
            num="01"
            eyebrow="You"
            color={math.color}
            title="Pick your subjects"
            body={
              <>
                <p>Take all four, or only the ones you still need to pass.</p>
                <p>
                  Every subject is a list of topics, and every topic has real videos and articles behind it. The hours
                  you see are what that content takes to study, with time to pause and take notes.
                </p>
              </>
            }
            visual={<SubjectsPicture picked={[math.code, science.code]} />}
          />

          <Step
            num="02"
            eyebrow="You"
            color={rla.color}
            title="Tell us your free time"
            body={
              <>
                <p>Set your exam date, and the hours you&apos;re usually free on each day of the week.</p>
                <p>
                  Then we add it up: the hours your subjects need against the hours you have before the exam. If
                  they don&apos;t fit, you see it straight away, with what would fix it: more hours a week, a later
                  exam, or one subject fewer.
                </p>
                <p>Your usual week is only where we start. You can still study on any other day later.</p>
              </>
            }
            visual={<FreeTimePicture need={need} have={have} />}
          />

          <Step
            num="03"
            eyebrow="You"
            color={science.color}
            title="Take a short test"
            body={
              <>
                <p>Ten questions for each subject you picked.</p>
                <p>
                  Every question belongs to one topic, so you get a score for each topic, not just one for the
                  subject. Red means weak, and weak topics are planned first.
                </p>
              </>
            }
            visual={<ScoresPicture rows={scores} />}
          />

          <Step
            num="04"
            eyebrow="We do this"
            color="#4aa8f0"
            dark
            title="We plan every day to your exam — once"
            body={
              <>
                <p>
                  First, topics longer than {MAX_PART_MINUTES / 60} hours are split into even parts of up to{" "}
                  {MAX_PART_MINUTES / 60} hours, always at the end of a unit or lesson, never mid-lesson.
                </p>
                <p>
                  Then a genetic algorithm makes {DEFAULT_CONFIG.populationSize} draft timetables and improves them
                  for up to {DEFAULT_CONFIG.generations} rounds, keeping the best each time. Every draft is scored on
                  six things:
                </p>
                <Objectives />
                <p className="pt-2">
                  The best one is spread evenly over every day up to your exam, so no week is crammed and none is
                  empty. The last few days before the exam are for review.
                </p>
              </>
            }
            visual={<PlanPicture colors={[math.color, science.color]} />}
          />

          <Step
            num="05"
            eyebrow="You"
            color={social.color}
            title="Study, then take the quiz"
            body={
              <>
                <p>Open today&apos;s session and watch or read at least 80% of each video and article to finish it.</p>
                <p>A long topic comes in parts. Part 2 stays locked until part 1 is done, so you learn it in order.</p>
                <p>
                  After the last part comes a short quiz. {WEAKNESS_THRESHOLD}% passes. If you don&apos;t pass, go
                  back over the material and take it again.
                </p>
                <p>Want a full check-up? A practice exam covers every subject at once.</p>
              </>
            }
            visual={<StudyPicture color={social.color} />}
          />

          <Step
            num="06"
            eyebrow="You"
            color="#DB2777"
            title="After that, the plan is yours"
            body={
              <>
                <p>We never reshuffle your schedule behind your back. Every change is yours.</p>
                <p>
                  Move a session to another day, swap two, remove one, or study another topic instead. Add a
                  session on any day, including days you didn&apos;t mark as free, with a topic from any subject.
                </p>
                <p>Parts of a topic always stay in order. Changed your mind? Reset brings back the plan we made.</p>
              </>
            }
            visual={<YoursPicture colors={[math.color, science.color]} />}
            last
          />
        </div>
      </main>

      {/* ── CTA ── */}
      <section className="px-5 md:px-10 pb-14 md:pb-20" style={{ background: "#f4f8ff" }}>
        <motion.div
          {...inView}
          className="max-w-[980px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-5 rounded-2xl px-6 py-6"
          style={{ background: "white", boxShadow: "0 4px 0 " + RULE }}
        >
          <p className="text-[19px] md:text-[24px]" style={{ fontFamily: "var(--font-feather)", fontWeight: 700, color: INK, lineHeight: 1.25, maxWidth: 440 }}>
            Step one takes about a minute.
          </p>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link
              href="/subjects"
              className="inline-flex items-center gap-2 transition-transform hover:scale-[1.03] active:scale-[0.97]"
              style={{ padding: "13px 22px", background: "white", color: "#1e90e8", border: "2px solid #1e90e8", borderRadius: 14, fontSize: 15, fontWeight: 700, textDecoration: "none" }}
            >
              See the syllabus
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 transition-transform hover:scale-[1.03] active:scale-[0.97]"
              style={{ padding: "13px 26px", background: "#1e90e8", color: "white", borderRadius: 14, fontSize: 15, fontWeight: 700, boxShadow: "0 4px 0 #1670be", textDecoration: "none" }}
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

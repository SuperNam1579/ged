import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import LandingNavbar from "@/components/layout/LandingNavbar";
import LandingFooter from "@/components/layout/LandingFooter";
import Reveal from "@/components/ui/Reveal";
import { DEFAULT_CONFIG, WEAKNESS_THRESHOLD } from "@/lib/ga/constants";
import { WEIGHTS } from "@/lib/ga/fitness";
import {
  LANDING_SUBJECTS,
  TOTAL_MID_TOPICS,
  TOTAL_TOPICS,
} from "@/components/landing/subjects";

/**
 * DRAFT — not linked from the navbar yet, and noindex until the copy is signed
 * off. Every figure quoted here is imported from the code it describes
 * (GA weights, evolution parameters, the weakness threshold, the curriculum
 * counts) so the page cannot drift from the system the way the hardcoded
 * per-subject topic counts on the landing page did.
 */
export const metadata: Metadata = {
  title: "How it works",
  description:
    "How the study plan is built: a diagnostic down to individual lessons, a genetic algorithm balancing six objectives, and a schedule you rebuild when your results move.",
  robots: { index: false, follow: false },
};

const INK = "#0f2748";
const MUTED = "#5b769a";

/** The six objectives the fitness function scores every candidate plan against. */
const OBJECTIVES = [
  {
    key: "coverage",
    weight: WEIGHTS.coverage,
    name: "Coverage",
    body: `Does the plan reach the topics you're weakest on? A topic counts as weak below ${WEAKNESS_THRESHOLD} out of 100.`,
  },
  {
    key: "weaknessFocus",
    weight: WEIGHTS.weaknessFocus,
    name: "Weakness focus",
    body: "The further below the line a topic sits, the more time it should get. Even coverage isn't enough on its own.",
  },
  {
    key: "timeFeasibility",
    weight: WEIGHTS.timeFeasibility,
    name: "Time feasibility",
    body: "Does each day actually fit the hours you said you were free? A plan you can't follow scores badly.",
  },
  {
    key: "prerequisiteOrder",
    weight: WEIGHTS.prerequisiteOrder,
    name: "Prerequisite order",
    body: "Foundations before the things built on them — no quadratics before you've done expressions.",
  },
  {
    key: "variety",
    weight: WEIGHTS.variety,
    name: "Variety",
    body: "Rotate subjects instead of grinding one for a week, without letting rotation override the weak topics that need the time.",
  },
  {
    key: "balance",
    weight: WEIGHTS.balance,
    name: "Balance",
    body: "Spread the hard material out, so two heavy days don't land back to back.",
  },
];

const STEPS = [
  {
    num: "01",
    eyebrow: "Setup",
    color: "#1e90e8",
    title: "Tell us the target",
    body: `Pick the subjects you're sitting — all ${LANDING_SUBJECTS.length} or just the ones you need — set your exam date, and mark the hours you're actually free each week. The plan is built inside those hours, not an idealised version of them.`,
  },
  {
    num: "02",
    eyebrow: "Diagnostic",
    color: "#16A34A",
    title: "Find out where you stand",
    body: `Ten questions per subject you chose. Every question is tied to one specific lesson, so the result isn't a single subject score — it's a separate reading for each of the ${TOTAL_TOPICS} lessons you could study.`,
  },
  {
    num: "03",
    eyebrow: "Planning",
    color: "#7C3AED",
    title: "Evolve a schedule",
    body: `${DEFAULT_CONFIG.populationSize} candidate schedules compete over ${DEFAULT_CONFIG.generations} generations. Each is scored against six objectives at once, the strongest are recombined, and the best ${DEFAULT_CONFIG.elitismCount} carry through untouched every round.`,
  },
  {
    num: "04",
    eyebrow: "Study",
    color: "#D97706",
    title: "Work the plan",
    body: "Daily sessions with a target time, then a quiz on the lesson. Each quiz updates that lesson's score, weighted 70% toward the new result and 30% toward your history — quick to reflect real progress, slow to overreact to one bad day.",
  },
  {
    num: "05",
    eyebrow: "Rebuild",
    color: "#DB2777",
    title: "Rebuild when it drifts",
    body: "When lessons you've quizzed on stay below the line with nothing queued for them, your dashboard says so and offers to rebuild. It doesn't rebuild behind your back — see below.",
  },
];

export default function HowItWorksPage() {
  const heaviest = OBJECTIVES.reduce((a, b) => (b.weight > a.weight ? b : a));

  return (
    <>
      <LandingNavbar />

      {/* ── Masthead ── */}
      <header
        className="px-5 md:px-10"
        style={{
          background: "linear-gradient(160deg,#e8f2ff 0%,#f4f8ff 70%)",
          paddingTop: 64 + 52,
          paddingBottom: 44,
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
            How your plan gets built.
          </h1>
          <p
            className="text-[15px] md:text-[17px]"
            style={{ color: MUTED, lineHeight: 1.65, marginTop: 16, maxWidth: 560 }}
          >
            Not a template with your name on it. A diagnostic that reads down to individual lessons,
            then an algorithm that weighs six competing goals to fit them into the time you actually
            have.
          </p>
        </div>
      </header>

      {/* ── Steps ── */}
      <main className="px-5 md:px-10 py-12 md:py-16" style={{ background: "#f4f8ff" }}>
        <div className="max-w-[880px] mx-auto">
          {STEPS.map((step, i) => (
            <Reveal key={step.num} delay={i * 0.05}>
              <div className="relative flex gap-4 md:gap-6 pb-6">
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute"
                    style={{
                      left: 25,
                      top: 62,
                      bottom: 0,
                      width: 4,
                      background: "#dceaf9",
                      borderRadius: 2,
                    }}
                  />
                )}
                <span
                  className="relative shrink-0 flex items-center justify-center tabular-nums"
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: "50%",
                    background: "white",
                    border: `4px solid ${step.color}`,
                    boxShadow: `0 4px 0 ${step.color}33`,
                    color: step.color,
                    fontFamily: "var(--font-feather)",
                    fontWeight: 700,
                    fontSize: 17,
                  }}
                >
                  {step.num}
                </span>

                <div
                  className="flex-1 min-w-0 rounded-2xl px-5 py-4"
                  style={{ background: "white", boxShadow: "0 4px 0 #dceaf9" }}
                >
                  <p
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: ".14em",
                      textTransform: "uppercase",
                      color: step.color,
                      marginBottom: 4,
                    }}
                  >
                    {step.eyebrow}
                  </p>
                  <h2
                    className="text-[19px] md:text-[22px]"
                    style={{
                      fontFamily: "var(--font-feather)",
                      fontWeight: 700,
                      color: INK,
                      lineHeight: 1.2,
                    }}
                  >
                    {step.title}
                  </h2>
                  <p
                    className="text-[14px] md:text-[14.5px]"
                    style={{ color: MUTED, lineHeight: 1.65, marginTop: 6 }}
                  >
                    {step.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </main>

      {/* ── The six objectives ── */}
      <section className="px-5 md:px-10 py-14 md:py-20" style={{ background: "white" }}>
        <div className="max-w-[880px] mx-auto">
          <Reveal>
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
              Inside the algorithm
            </p>
            <h2
              className="text-[28px] md:text-[38px]"
              style={{
                fontFamily: "var(--font-feather)",
                fontWeight: 700,
                color: INK,
                lineHeight: 1.1,
              }}
            >
              Six goals, pulling against each other.
            </h2>
            <p
              className="text-[15px] md:text-[16px]"
              style={{ color: MUTED, lineHeight: 1.65, marginTop: 14, maxWidth: 600 }}
            >
              A schedule that only chased your weakest topic would bury you in one subject and
              ignore your calendar. Every candidate plan is scored on all six at once, and the
              weights below decide the trade-off — {heaviest.name.toLowerCase()} carries the most at{" "}
              {Math.round(heaviest.weight * 100)}%.
            </p>
          </Reveal>

          <div className="mt-10 flex flex-col gap-5">
            {OBJECTIVES.map((obj, i) => (
              <Reveal key={obj.key} delay={i * 0.04}>
                <div
                  className="grid gap-x-6 gap-y-2 md:grid-cols-[150px_1fr] items-baseline pt-5"
                  style={{ borderTop: "1px solid #dbe6f5" }}
                >
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-[26px] md:text-[30px] tabular-nums"
                        style={{
                          fontFamily: "var(--font-feather)",
                          fontWeight: 700,
                          color: "#1e90e8",
                          lineHeight: 1,
                        }}
                      >
                        {Math.round(obj.weight * 100)}%
                      </span>
                    </div>
                    <div
                      className="h-[3px] rounded-full overflow-hidden mt-2"
                      style={{ background: "#eaf1fa", maxWidth: 120 }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          // Relative to the largest weight, so the bars stay
                          // readable instead of all sitting under a quarter full.
                          width: `${(obj.weight / heaviest.weight) * 100}%`,
                          background: "#1e90e8",
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <h3
                      className="text-[16px] md:text-[18px]"
                      style={{ fontFamily: "var(--font-feather)", fontWeight: 700, color: INK }}
                    >
                      {obj.name}
                    </h3>
                    <p
                      className="text-[14px]"
                      style={{ color: MUTED, lineHeight: 1.65, marginTop: 4, maxWidth: 560 }}
                    >
                      {obj.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why rebuilding is a choice ── */}
      <section className="px-5 md:px-10 py-14 md:py-20" style={{ background: "#f4f8ff" }}>
        <div className="max-w-[880px] mx-auto">
          <Reveal>
            <div
              className="rounded-2xl px-6 py-7"
              style={{ background: "white", boxShadow: "0 4px 0 #dceaf9" }}
            >
              <p
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: ".16em",
                  textTransform: "uppercase",
                  color: MUTED,
                  marginBottom: 10,
                }}
              >
                One deliberate limit
              </p>
              <h2
                className="text-[22px] md:text-[28px]"
                style={{
                  fontFamily: "var(--font-feather)",
                  fontWeight: 700,
                  color: INK,
                  lineHeight: 1.2,
                }}
              >
                Your plan doesn&apos;t rewrite itself behind your back.
              </h2>
              <p
                className="text-[14.5px] md:text-[15px]"
                style={{ color: MUTED, lineHeight: 1.7, marginTop: 12, maxWidth: 640 }}
              >
                Every quiz updates your scores straight away — that part is automatic. Rebuilding
                the schedule is not, and that&apos;s on purpose. Evolution starts from a random
                population, so two runs on the same data return different schedules. If a failed
                quiz triggered a rebuild, the whole week would reshuffle, including the days you had
                already planned around and subjects that had nothing to do with the quiz.
              </p>
              <p
                className="text-[14.5px] md:text-[15px]"
                style={{ color: MUTED, lineHeight: 1.7, marginTop: 10, maxWidth: 640 }}
              >
                So the signal is surfaced instead: when lessons you&apos;ve quizzed on stay below{" "}
                {WEAKNESS_THRESHOLD} with nothing queued for them, your dashboard tells you and
                offers the rebuild. You pick the moment. Work you&apos;ve already finished is never
                rescheduled.
              </p>
            </div>
          </Reveal>

          {/* CTA */}
          <Reveal>
            <div
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 rounded-2xl px-6 py-6 mt-5"
              style={{ background: "white", boxShadow: "0 4px 0 #dceaf9" }}
            >
              <p
                className="text-[19px] md:text-[24px]"
                style={{
                  fontFamily: "var(--font-feather)",
                  fontWeight: 700,
                  color: INK,
                  lineHeight: 1.25,
                  maxWidth: 460,
                }}
              >
                See the {TOTAL_MID_TOPICS} topics this runs on.
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
                  The syllabus
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
            </div>
          </Reveal>
        </div>
      </section>

      <LandingFooter />
    </>
  );
}

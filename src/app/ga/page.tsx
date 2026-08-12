import type { Metadata } from "next";
import LandingNavbar from "@/components/layout/LandingNavbar";
import LandingFooter from "@/components/layout/LandingFooter";
import MethodDemo from "@/components/method/MethodDemo";
import MethodGoals from "@/components/method/MethodGoals";
import MethodComparison from "@/components/method/MethodComparison";
import { GENS, INK, MUTED, POP } from "@/components/method/methodData";

/**
 * How the timetable is built — the algorithm page.
 *
 * Kept separate from /how-it-works, which walks the seven things the learner
 * does. This one is about the planner, and it opens on the learner's problem
 * rather than on the algorithm, because most readers don't arrive wanting to
 * know what a genetic algorithm is.
 *
 * Figures come from @/lib/ga/constants and @/lib/ga/fitness, never retyped.
 */
export const metadata: Metadata = {
  title: "The method",
  description:
    "Why planning your own study timetable falls apart, and how drafting fifty of them and scoring each against six goals produces a better one.",
  alternates: { canonical: "/ga" },
};

function SectionHeading({
  kicker,
  title,
  lead,
}: {
  kicker: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="mb-7">
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "#1e90e8",
          marginBottom: 10,
        }}
      >
        {kicker}
      </p>
      <h2
        className="text-[26px] md:text-[34px]"
        style={{
          fontFamily: "var(--font-feather)",
          fontWeight: 700,
          color: INK,
          lineHeight: 1.15,
        }}
      >
        {title}
      </h2>
      {lead ? (
        <p
          className="text-[15px] md:text-[16px]"
          style={{ color: MUTED, lineHeight: 1.7, marginTop: 12, maxWidth: 660 }}
        >
          {lead}
        </p>
      ) : null}
    </div>
  );
}

export default function MethodPage() {
  return (
    <>
      <LandingNavbar />
      <main className="px-5 md:px-10" style={{ background: "#f4f8ff" }}>
        {/* ── 1. The problem ── */}
        <section className="max-w-[860px] mx-auto" style={{ paddingTop: 64 + 56 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: "#1e90e8",
              marginBottom: 14,
            }}
          >
            GA — the genetic algorithm
          </p>
          <h1
            className="text-[36px] md:text-[56px]"
            style={{
              fontFamily: "var(--font-feather)",
              fontWeight: 700,
              color: INK,
              lineHeight: 1.06,
            }}
          >
            Planning your own week
            <br />
            is where studying dies.
          </h1>

          {/* The navbar only has room for "GA", so the two letters get spelled
              out here — this is the first place someone who clicked it can find
              out what they stand for, and confirm they landed on the right page. */}
          <p
            className="text-[15px] md:text-[16.5px] mt-5"
            style={{ color: MUTED, lineHeight: 1.65, maxWidth: 660 }}
          >
            <strong style={{ color: INK, fontWeight: 700 }}>GA</strong>{" "}
            stands for{" "}
            <strong style={{ color: INK, fontWeight: 700 }}>genetic algorithm</strong>
            {" — the part of this product that decides which lesson you study on which day. "}
            {"This page is about why that job is harder than it looks, and how it gets done."}
          </p>

          <div className="mt-7 flex flex-col gap-3" style={{ maxWidth: 660 }}>
            {[
              "Your free hours never line up with the days you meant to study.",
              "You re-read the subject you're already good at, because it feels productive.",
              "The one you're worst at keeps sliding to next week.",
              "By the time the exam is close, half the syllabus has had no time at all.",
            ].map((line) => (
              <div key={line} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="shrink-0 rounded-full"
                  style={{ width: 5, height: 5, background: "#c2553f", marginTop: 9 }}
                />
                <p className="text-[15px] md:text-[16.5px]" style={{ color: MUTED, lineHeight: 1.65 }}>
                  {line}
                </p>
              </div>
            ))}
          </div>

          <p
            className="text-[18px] md:text-[22px] mt-8"
            style={{
              fontFamily: "var(--font-feather)",
              fontWeight: 700,
              color: INK,
              lineHeight: 1.35,
              maxWidth: 660,
            }}
          >
            What if something drafted {POP} versions of your week
            {" "}
            and handed you the best one?
          </p>
        </section>

        {/* ── 2. Plain-language explanation ── */}
        <section className="max-w-[860px] mx-auto" style={{ paddingTop: 72 }}>
          <SectionHeading kicker="In plain terms" title="That's all this does." />
          <ol className="flex flex-col gap-3" style={{ maxWidth: 660 }}>
            {[
              `It drafts ${POP} rough timetables at once, all different.`,
              "It scores every one of them against what a good week looks like.",
              "It throws out the weak ones and combines the strong ones.",
              `It does that ${GENS} times, and keeps the best week that survives.`,
            ].map((line, i) => (
              <li key={line} className="flex items-start gap-3.5">
                <span
                  className="shrink-0 flex items-center justify-center tabular-nums"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "#1e90e8",
                    color: "white",
                    fontSize: 12.5,
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </span>
                <p
                  className="text-[15px] md:text-[16.5px]"
                  style={{ color: INK, lineHeight: 1.6, paddingTop: 2 }}
                >
                  {line}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── 3. Watch it happen ── */}
        <section className="max-w-[1060px] mx-auto" style={{ paddingTop: 80 }}>
          <SectionHeading
            kicker="Watch it happen"
            title="One week, sorting itself out."
            lead="Press Run to let it evolve, or Step through a generation at a time. Watch the sessions move off the days this learner isn't free, spread across the week, and put the basics before the hard lessons."
          />
          <MethodDemo />
          <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginTop: 12 }}>
            An illustration of how a run behaves, using one example learner&apos;s week — not
            measured output from the engine.
          </p>
        </section>

        {/* ── 4. What "good" means ── */}
        <section className="max-w-[860px] mx-auto" style={{ paddingTop: 80 }}>
          <SectionHeading
            kicker="What counts as good"
            title="Six goals, pulling against each other."
            lead="This is why one plain rule can't do the job. Spend every hour on your weakest subject and you stop rotating; rotate perfectly and you neglect the weak spot; do both and you may book a day you're not free. Each draft is scored on all six at once, and the weights decide which compromise wins."
          />
          <MethodGoals />
        </section>

        {/* ── 5. Is it actually better ── */}
        <section
          className="max-w-[1060px] mx-auto"
          style={{ paddingTop: 80, paddingBottom: 90 }}
        >
          <SectionHeading
            kicker="Does it beat doing it yourself"
            title="The same week, two ways."
            lead="A plan a learner would plausibly write for themselves, next to the one the algorithm settles on — both marked by the same six goals."
          />
          <MethodComparison />
        </section>
      </main>
      <LandingFooter />
    </>
  );
}

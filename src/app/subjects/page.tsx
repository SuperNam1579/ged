import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import LandingNavbar from "@/components/layout/LandingNavbar";
import LandingFooter from "@/components/layout/LandingFooter";
import Reveal from "@/components/ui/Reveal";
import {
  LANDING_SUBJECTS,
  TOTAL_MID_TOPICS,
  subtopicCount,
  topicCount,
} from "@/components/landing/subjects";

const INK = "#0f2748";
const MUTED = "#5b769a";

const TOTAL_LESSONS = LANDING_SUBJECTS.reduce((n, s) => n + subtopicCount(s), 0);

export const metadata: Metadata = {
  title: "What you'll study",
  description: `The full GED syllabus — ${TOTAL_MID_TOPICS} topics and ${TOTAL_LESSONS} lessons across all four subjects, with the real exam weightings.`,
  alternates: { canonical: "/subjects" },
};

/**
 * The whole GED as one route: four subject waypoints in the order the syllabus
 * presents them, each opening into that subject's own path.
 *
 * Each waypoint carries its real category and topic names. An earlier version
 * listed only the categories and read as thin — the fix was more information
 * per waypoint, not bigger type.
 */
export default function SubjectsPage() {
  const totalLessons = TOTAL_LESSONS;

  return (
    <>
      <LandingNavbar />

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
            Your GED syllabus
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
            Everything you&apos;ll study.
          </h1>
          {/* The figures moved out of the headline into their own row — as a
              sentence they ran to two lines and read as a list. */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-5">
            {[
              { value: LANDING_SUBJECTS.length, label: "subjects" },
              { value: 15, label: "topics" },
              { value: totalLessons, label: "lessons" },
            ].map((stat) => (
              <span key={stat.label} className="flex items-baseline gap-1.5">
                <span
                  className="text-[24px] md:text-[28px] tabular-nums"
                  style={{
                    fontFamily: "var(--font-feather)",
                    fontWeight: 700,
                    color: "#1e90e8",
                    lineHeight: 1,
                  }}
                >
                  {stat.value}
                </span>
                <span style={{ fontSize: 13.5, color: MUTED, fontWeight: 600 }}>{stat.label}</span>
              </span>
            ))}
          </div>
          <p
            className="text-[15px] md:text-[16px]"
            style={{ color: MUTED, lineHeight: 1.6, marginTop: 16, maxWidth: 520 }}
          >
            Every topic in the order the exam covers them, with the real weightings — so you can
            see where the marks are.
          </p>
        </div>
      </header>

      <main className="px-5 md:px-10 py-12" style={{ background: "#f4f8ff" }}>
        <div className="max-w-[880px] mx-auto">
          {LANDING_SUBJECTS.map((subject, i) => (
            <Reveal key={subject.slug} delay={i * 0.06}>
              <div className="relative flex gap-4 md:gap-6 pb-6">
                {/* Road running behind the waypoints */}
                {i < LANDING_SUBJECTS.length - 1 && (
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

                {/* Waypoint — the number alone marks the stop; the subject icon
                    lives in the card, so the two aren't competing. */}
                <span
                  className="relative shrink-0 flex items-center justify-center tabular-nums"
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: "50%",
                    background: "white",
                    border: `4px solid ${subject.color}`,
                    boxShadow: `0 4px 0 ${subject.color}33`,
                    color: subject.color,
                    fontFamily: "var(--font-feather)",
                    fontWeight: 700,
                    fontSize: 20,
                  }}
                >
                  {i + 1}
                </span>

                {/* Waypoint card */}
                <Link
                  href={`/subjects/${subject.slug}`}
                  className="group flex-1 min-w-0 rounded-2xl px-5 py-4 transition-transform hover:-translate-y-0.5"
                  style={{ background: "white", boxShadow: "0 4px 0 #dceaf9" }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="shrink-0 flex items-center justify-center"
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        background: subject.iconBg,
                      }}
                    >
                      <span className="flex scale-[.86]">{subject.icon}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2
                        className="text-[19px] md:text-[22px]"
                        style={{
                          fontFamily: "var(--font-feather)",
                          fontWeight: 700,
                          color: INK,
                          lineHeight: 1.2,
                        }}
                      >
                        {subject.name}
                      </h2>
                      <p style={{ fontSize: 13, color: MUTED, marginTop: 2, lineHeight: 1.5 }}>
                        {subject.desc}
                      </p>
                    </div>
                    <span
                      className="shrink-0 tabular-nums text-right hidden sm:block"
                      style={{ fontSize: 12, color: MUTED, fontWeight: 600, paddingTop: 4 }}
                    >
                      {topicCount(subject)} topics
                      <br />
                      {subtopicCount(subject)} lessons
                    </span>
                  </div>

                  {/* Categories, each with the topics it actually contains —
                      this is the substance the earlier version was missing. */}
                  <div
                    className="mt-4 pt-3.5 flex flex-col gap-3"
                    style={{ borderTop: "1px solid #eef4fc" }}
                  >
                    {subject.categories.map((category) => (
                      <div key={category.name} className="grid gap-x-3 sm:grid-cols-[1fr_auto]">
                        <div className="min-w-0">
                          <p
                            className="text-[13.5px]"
                            style={{ fontWeight: 700, color: INK, lineHeight: 1.3 }}
                          >
                            {category.name}
                          </p>
                          <p
                            style={{
                              fontSize: 12.5,
                              color: MUTED,
                              lineHeight: 1.5,
                              marginTop: 2,
                            }}
                          >
                            {category.topics.map((t) => t.name).join(" · ")}
                          </p>
                        </div>
                        {/* Weight as a right-aligned figure plus a hairline bar,
                            instead of a pill that wrapped messily on the
                            four-category subjects. */}
                        <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-1 mt-1 sm:mt-0">
                          <span
                            className="tabular-nums"
                            style={{ fontSize: 12.5, fontWeight: 700, color: subject.color }}
                          >
                            {category.weight}%
                          </span>
                          <span
                            aria-hidden="true"
                            className="rounded-full"
                            style={{
                              width: 52,
                              height: 3,
                              background: `linear-gradient(to right, ${subject.color} ${category.weight}%, #e8f0fb ${category.weight}%)`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <span
                    className="inline-flex items-center gap-1.5 mt-4"
                    style={{ fontSize: 13, fontWeight: 700, color: subject.color }}
                  >
                    View topics
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </div>
            </Reveal>
          ))}

          {/* Single close-out. The earlier finish-flag block repeated the
              headline's figures and then put a second CTA under them. */}
          <Reveal>
            <div
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 rounded-2xl px-6 py-6 mt-4"
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
                Take the diagnostic and we&apos;ll mark the lessons you can skip.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 shrink-0 self-start md:self-auto transition-transform hover:scale-[1.04] active:scale-[0.97]"
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
          </Reveal>
        </div>
      </main>

      <LandingFooter />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import LandingNavbar from "@/components/layout/LandingNavbar";
import Reveal from "@/components/ui/Reveal";
import {
  LANDING_SUBJECTS,
  TOTAL_MID_TOPICS,
  TOTAL_TOPICS,
  subtopicCount,
  topicCount,
} from "@/components/landing/subjects";

export const metadata: Metadata = {
  title: "What you'll study",
  description: `The full GED syllabus — ${TOTAL_MID_TOPICS} topics and ${TOTAL_TOPICS} lessons across all four subjects, with real exam weightings.`,
  alternates: { canonical: "/subjects" },
};

const INK = "#0f2748";
const MUTED = "#5b769a";
const RULE = "#dbe6f5";

function issueNumber(i: number) {
  return String(i + 1).padStart(2, "0");
}

export default function SubjectsPage() {
  return (
    <>
      <LandingNavbar />

      {/* ── Masthead ── */}
      <header
        className="px-5 md:px-10"
        style={{ background: "white", paddingTop: 64 + 56, paddingBottom: 52 }}
      >
        <div className="max-w-[1080px] mx-auto">
          <div className="flex items-center gap-4 mb-7">
            <span style={{ width: 34, height: 4, background: "#1e90e8", borderRadius: 2 }} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".18em",
                textTransform: "uppercase",
                color: "#1e90e8",
              }}
            >
              The syllabus
            </span>
          </div>

          <h1
            className="text-[44px] md:text-[76px]"
            style={{
              fontFamily: "var(--font-feather)",
              fontWeight: 700,
              color: INK,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              maxWidth: 860,
            }}
          >
            Everything you&apos;ll study, before you sign up.
          </h1>

          <div
            className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end mt-10 pt-8"
            style={{ borderTop: `2px solid ${INK}` }}
          >
            <p
              className="text-[16px] md:text-[18px]"
              style={{ color: MUTED, lineHeight: 1.65, maxWidth: 540 }}
            >
              No paywalled curriculum. Every topic and lesson across all four GED subjects, with the
              real exam weightings — so you can see where the marks are before you commit.
            </p>

            <dl className="flex gap-8 md:gap-10">
              {[
                { value: LANDING_SUBJECTS.length, label: "Subjects" },
                { value: TOTAL_MID_TOPICS, label: "Topics" },
                { value: TOTAL_TOPICS, label: "Lessons" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: ".14em",
                      textTransform: "uppercase",
                      color: MUTED,
                      marginBottom: 6,
                    }}
                  >
                    {stat.label}
                  </dt>
                  <dd
                    className="text-[30px] md:text-[38px] tabular-nums"
                    style={{
                      fontFamily: "var(--font-feather)",
                      fontWeight: 700,
                      color: INK,
                      lineHeight: 1,
                    }}
                  >
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </header>

      {/* ── Contents ── */}
      <main className="px-5 md:px-10 pb-6" style={{ background: "white" }}>
        <div className="max-w-[1080px] mx-auto">
          <p
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: MUTED,
              marginBottom: 4,
            }}
          >
            Contents
          </p>

          {LANDING_SUBJECTS.map((subject, i) => (
            <Reveal key={subject.slug} delay={i * 0.05}>
              <Link
                href={`/subjects/${subject.slug}`}
                className="group grid gap-5 md:grid-cols-[70px_1fr_auto] md:gap-10 items-start py-9 md:py-11 transition-colors"
                style={{ borderTop: `1px solid ${RULE}` }}
              >
                {/* Issue number + icon */}
                <div className="flex items-center gap-4 md:block">
                  <span
                    className="block text-[34px] md:text-[46px] tabular-nums"
                    style={{
                      fontFamily: "var(--font-feather)",
                      fontWeight: 700,
                      color: subject.color,
                      lineHeight: 1,
                    }}
                  >
                    {issueNumber(i)}
                  </span>
                  <span
                    className="flex items-center justify-center md:mt-4"
                    style={{ width: 40, height: 40, borderRadius: 12, background: subject.iconBg }}
                  >
                    <span className="flex scale-[.82]">{subject.icon}</span>
                  </span>
                </div>

                {/* Title, blurb, and the exam split as a run-in list */}
                <div className="min-w-0">
                  <h2
                    className="text-[26px] md:text-[38px]"
                    style={{
                      fontFamily: "var(--font-feather)",
                      fontWeight: 700,
                      color: INK,
                      lineHeight: 1.1,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {subject.name}
                  </h2>
                  <p
                    className="text-[14.5px] md:text-[16px]"
                    style={{ color: MUTED, marginTop: 8, maxWidth: 480, lineHeight: 1.6 }}
                  >
                    {subject.desc}.
                  </p>

                  <ul className="mt-6 flex flex-col" style={{ maxWidth: 460 }}>
                    {subject.categories.map((category) => (
                      <li
                        key={category.name}
                        className="flex items-center gap-3 py-2"
                        style={{ borderTop: `1px solid #eef4fc` }}
                      >
                        <span
                          className="tabular-nums shrink-0 text-right"
                          style={{ width: 34, fontSize: 12.5, fontWeight: 700, color: subject.color }}
                        >
                          {category.weight}%
                        </span>
                        {/* Hairline bar keeps the proportions readable without
                            turning the row into a chart. */}
                        <span
                          className="hidden sm:block shrink-0 rounded-full"
                          style={{
                            width: 56,
                            height: 3,
                            background: `linear-gradient(to right, ${subject.color} ${category.weight}%, #e8f0fb ${category.weight}%)`,
                          }}
                        />
                        <span
                          className="min-w-0 truncate"
                          style={{ fontSize: 13.5, color: "#41597a" }}
                        >
                          {category.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Folio */}
                <div className="md:text-right md:pt-2">
                  <p
                    className="tabular-nums"
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      color: MUTED,
                    }}
                  >
                    {topicCount(subject)} topics
                    <br className="hidden md:block" />
                    <span className="md:hidden"> · </span>
                    {subtopicCount(subject)} lessons
                  </p>
                  <span
                    className="inline-flex items-center gap-1.5 mt-4"
                    style={{ fontSize: 13, fontWeight: 700, color: subject.color }}
                  >
                    Read
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </main>

      {/* ── Colophon ── */}
      <section className="px-5 md:px-10 py-14 md:py-20" style={{ background: "#f4f8ff" }}>
        <div
          className="max-w-[1080px] mx-auto pt-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6"
          style={{ borderTop: `2px solid ${INK}` }}
        >
          <p
            className="text-[22px] md:text-[32px]"
            style={{
              fontFamily: "var(--font-feather)",
              fontWeight: 700,
              color: INK,
              lineHeight: 1.2,
              maxWidth: 540,
            }}
          >
            Take the diagnostic and we&apos;ll turn this into a plan built around your gaps.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 shrink-0 transition-transform duration-150 hover:scale-[1.04] active:scale-[0.97]"
            style={{
              padding: "13px 26px",
              background: "#1e90e8",
              color: "white",
              borderRadius: 12,
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
      </section>
    </>
  );
}

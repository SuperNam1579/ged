import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import LandingNavbar from "@/components/layout/LandingNavbar";
import Reveal from "@/components/ui/Reveal";
import {
  LANDING_SUBJECTS,
  findSubject,
  subtopicCount,
  topicCount,
} from "@/components/landing/subjects";

/** Pre-render all four subject pages at build time — the list is static. */
export function generateStaticParams() {
  return LANDING_SUBJECTS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const subject = findSubject(slug);
  if (!subject) return {};
  return {
    title: subject.name,
    description: `${subject.name} on the GED: ${topicCount(subject)} topics and ${subtopicCount(subject)} lessons — ${subject.desc}.`,
    alternates: { canonical: `/subjects/${subject.slug}` },
  };
}

const LEVEL_LABELS = ["", "Foundation", "Core", "Advanced", "Challenge"];

/** Two-digit chapter marker, e.g. 1 → "01". */
function chapterNumber(i: number) {
  return String(i + 1).padStart(2, "0");
}

const INK = "#0f2748";
const MUTED = "#5b769a";
const RULE = "#dbe6f5";


export default async function SubjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const subject = findSubject(slug);
  if (!subject) notFound();

  const others = LANDING_SUBJECTS.filter((s) => s.slug !== subject.slug);

  return (
    <>
      <LandingNavbar />

      {/* ── Masthead ── */}
      <header
        className="px-5 md:px-10"
        style={{ background: "white", paddingTop: 64 + 48, paddingBottom: 48 }}
      >
        <div className="max-w-[1080px] mx-auto">
          <Link
            href="/subjects"
            className="inline-flex items-center gap-1.5 mb-10 transition-colors hover:opacity-70"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All subjects
          </Link>

          {/* Eyebrow rule — the magazine's section marker */}
          <div className="flex items-center gap-4 mb-6">
            <span style={{ width: 34, height: 4, background: subject.color, borderRadius: 2 }} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".18em",
                textTransform: "uppercase",
                color: subject.color,
              }}
            >
              GED Subject
            </span>
          </div>

          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <h1
                className="text-[40px] md:text-[68px]"
                style={{
                  fontFamily: "var(--font-feather)",
                  fontWeight: 700,
                  color: INK,
                  lineHeight: 1.02,
                  letterSpacing: "-0.015em",
                  maxWidth: 720,
                }}
              >
                {subject.name}
              </h1>
              <p
                className="text-[16px] md:text-[19px]"
                style={{ color: MUTED, marginTop: 18, maxWidth: 560, lineHeight: 1.6 }}
              >
                {subject.desc}.
              </p>
            </div>

            {/* Figures set as a small masthead column */}
            <dl className="flex gap-8 md:gap-10 md:pb-2">
              {[
                { value: subject.categories.length, label: "Parts" },
                { value: topicCount(subject), label: "Topics" },
                { value: subtopicCount(subject), label: "Lessons" },
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

      {/* ── Chapters ── */}
      <main className="px-5 md:px-10 pb-4" style={{ background: "white" }}>
        <div className="max-w-[1080px] mx-auto">
          {subject.categories.map((category, ci) => (
            <Reveal key={category.name} delay={ci * 0.04}>
              <section
                className="grid gap-6 md:grid-cols-[220px_1fr] md:gap-12 py-12 md:py-16"
                style={{ borderTop: `2px solid ${INK}` }}
              >
                {/* Chapter marker — sticks alongside its lessons while reading */}
                <div className="md:sticky md:top-24 md:self-start">
                  <div className="flex items-baseline gap-3 mb-4">
                    <span
                      className="text-[34px] md:text-[42px] tabular-nums"
                      style={{
                        fontFamily: "var(--font-feather)",
                        fontWeight: 700,
                        color: subject.color,
                        lineHeight: 1,
                      }}
                    >
                      {chapterNumber(ci)}
                    </span>
                    <span
                      className="tabular-nums"
                      style={{ fontSize: 13, fontWeight: 700, color: MUTED }}
                    >
                      {category.weight}% of exam
                    </span>
                  </div>

                  <h2
                    className="text-[21px] md:text-[25px]"
                    style={{
                      fontFamily: "var(--font-feather)",
                      fontWeight: 700,
                      color: INK,
                      lineHeight: 1.15,
                      marginBottom: 14,
                    }}
                  >
                    {category.name}
                  </h2>

                  <div
                    className="h-[3px] rounded-full overflow-hidden"
                    style={{ background: "#eaf1fa", maxWidth: 160 }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${category.weight}%`, background: subject.color }}
                    />
                  </div>
                </div>

                {/* Lessons, set as a running list rather than a grid of boxes */}
                <div>
                  {category.topics.map((topic, ti) => (
                    <div key={topic.name} className={ti > 0 ? "mt-11" : undefined}>
                      <div className="flex items-baseline justify-between gap-4 mb-1">
                        <h3
                          className="text-[15px] md:text-[17px]"
                          style={{ fontFamily: "var(--font-feather)", fontWeight: 700, color: INK }}
                        >
                          {topic.name}
                        </h3>
                        <span
                          className="shrink-0 tabular-nums"
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            letterSpacing: ".12em",
                            textTransform: "uppercase",
                            color: MUTED,
                          }}
                        >
                          {topic.subtopics.length} lessons
                        </span>
                      </div>

                      <ol>
                        {topic.subtopics.map((subtopic, si) => (
                          <li
                            key={subtopic.name}
                            className="group grid grid-cols-[30px_1fr] gap-x-3 py-4"
                            style={{ borderTop: `1px solid ${RULE}` }}
                          >
                            <span
                              className="tabular-nums pt-0.5"
                              style={{ fontSize: 12.5, fontWeight: 700, color: subject.color }}
                            >
                              {chapterNumber(si)}
                            </span>

                            <div className="min-w-0">
                              <h4
                                className="text-[15px] md:text-[16px]"
                                style={{ fontWeight: 700, color: INK, lineHeight: 1.35 }}
                              >
                                {subtopic.name}
                              </h4>
                              <p
                                className="text-[13.5px] md:text-[14px]"
                                style={{
                                  color: MUTED,
                                  lineHeight: 1.6,
                                  marginTop: 4,
                                  maxWidth: 560,
                                }}
                              >
                                {subtopic.description}
                              </p>

                              {/* Meta line — small caps, no pills, so the type
                                  stays the loudest thing on the page. */}
                              <p
                                className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2.5"
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  letterSpacing: ".12em",
                                  textTransform: "uppercase",
                                  color: MUTED,
                                }}
                              >
                                <span style={{ color: subject.color }}>
                                  {LEVEL_LABELS[subtopic.level] ?? `Level ${subtopic.level}`}
                                </span>
                                <span aria-hidden="true" style={{ opacity: 0.4 }}>
                                  ·
                                </span>
                                <span className="tabular-nums">{subtopic.minutes} min</span>
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </section>
            </Reveal>
          ))}
        </div>
      </main>

      {/* ── Colophon: other subjects + CTA ── */}
      <footer className="px-5 md:px-10 py-14 md:py-20" style={{ background: "#f4f8ff" }}>
        <div className="max-w-[1080px] mx-auto">
          <p
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: MUTED,
              marginBottom: 18,
            }}
          >
            Continue reading
          </p>

          <div className="grid gap-px sm:grid-cols-3" style={{ background: RULE }}>
            {others.map((other) => (
              <Link
                key={other.slug}
                href={`/subjects/${other.slug}`}
                className="group flex items-center justify-between gap-3 px-5 py-6 transition-colors hover:bg-white"
                style={{ background: "#f4f8ff" }}
              >
                <span className="min-w-0">
                  <span
                    className="block text-[16px] md:text-[18px]"
                    style={{ fontFamily: "var(--font-feather)", fontWeight: 700, color: INK, lineHeight: 1.2 }}
                  >
                    {other.shortName}
                  </span>
                  <span
                    className="block tabular-nums"
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      color: MUTED,
                      marginTop: 6,
                    }}
                  >
                    {subtopicCount(other)} lessons
                  </span>
                </span>
                <ArrowRight
                  className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1"
                  style={{ color: other.color }}
                />
              </Link>
            ))}
          </div>

          <div
            className="mt-14 pt-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6"
            style={{ borderTop: `2px solid ${INK}` }}
          >
            <p
              className="text-[22px] md:text-[30px]"
              style={{
                fontFamily: "var(--font-feather)",
                fontWeight: 700,
                color: INK,
                lineHeight: 1.2,
                maxWidth: 520,
              }}
            >
              Which of these {subtopicCount(subject)} lessons do you actually need?
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
              Take the free diagnostic
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}

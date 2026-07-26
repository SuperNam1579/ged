import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import LandingNavbar from "@/components/layout/LandingNavbar";
import LandingFooter from "@/components/layout/LandingFooter";
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

const INK = "#0f2748";
const MUTED = "#5b769a";
const LEVEL_LABELS = ["", "Foundation", "Core", "Advanced", "Challenge"];

export default async function SubjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const subject = findSubject(slug);
  if (!subject) notFound();

  const others = LANDING_SUBJECTS.filter((x) => x.slug !== subject.slug);

  // Number every lesson up front rather than counting during render — the path
  // reads as one journey across the whole subject, not a count that restarts at
  // each category.
  const lessonNumbers = new Map<string, number>();
  subject.categories.forEach((c) =>
    c.topics.forEach((t) =>
      t.subtopics.forEach((st) => lessonNumbers.set(st.name, lessonNumbers.size + 1))
    )
  );

  return (
    <>
      <LandingNavbar />

      {/* ── Header ── */}
      <header
        className="relative overflow-hidden px-5 md:px-10"
        style={{
          background: `linear-gradient(160deg, ${subject.iconBg} 0%, #f4f8ff 70%)`,
          paddingTop: 64 + 44,
          paddingBottom: 44,
        }}
      >
        <div className="max-w-[880px] mx-auto">
          <Link
            href="/subjects"
            className="inline-flex items-center gap-1.5 mb-7 transition-opacity hover:opacity-70"
            style={{ fontSize: 13, fontWeight: 700, color: MUTED }}
          >
            <ArrowLeft className="w-4 h-4" />
            All subjects
          </Link>

          <div className="flex items-center gap-4">
            <span
              className="flex items-center justify-center shrink-0"
              style={{
                width: 62,
                height: 62,
                borderRadius: 18,
                background: "white",
                boxShadow: `0 4px 0 ${subject.color}33`,
              }}
            >
              {subject.icon}
            </span>
            <div className="min-w-0">
              <h1
                className="text-[28px] md:text-[38px]"
                style={{
                  fontFamily: "var(--font-feather)",
                  fontWeight: 700,
                  color: INK,
                  lineHeight: 1.1,
                }}
              >
                {subject.name}
              </h1>
              <p style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>
                {topicCount(subject)} topics · {subtopicCount(subject)} lessons
              </p>
            </div>
          </div>

          {/* Switcher, so all four subjects stay one click apart */}
          <nav aria-label="Subjects" className="flex flex-wrap gap-2 mt-7">
            {LANDING_SUBJECTS.map((other) => {
              const isActive = other.slug === subject.slug;
              return (
                <Link
                  key={other.slug}
                  href={`/subjects/${other.slug}`}
                  aria-current={isActive ? "page" : undefined}
                  className="transition-transform hover:scale-[1.04] active:scale-[0.97]"
                  style={{
                    padding: "7px 14px",
                    borderRadius: 999,
                    fontSize: 12.5,
                    fontWeight: 700,
                    background: isActive ? other.color : "white",
                    color: isActive ? "white" : MUTED,
                    boxShadow: isActive ? `0 3px 0 ${other.color}66` : "0 2px 0 #d8e6f7",
                    textDecoration: "none",
                  }}
                >
                  {other.shortName}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ── The path ── */}
      <main className="px-5 md:px-10 py-12" style={{ background: "#f4f8ff" }}>
        <div className="max-w-[880px] mx-auto">
          {subject.categories.map((category, ci) => (
            <section key={category.name} className="mb-4">
              {/* Part banner */}
              <Reveal>
                <div
                  className="flex items-center justify-between gap-4 rounded-2xl px-5 py-4 mb-2"
                  style={{
                    background: subject.color,
                    boxShadow: `0 4px 0 ${subject.color}55`,
                  }}
                >
                  <div className="min-w-0">
                    <p
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        letterSpacing: ".14em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,.7)",
                      }}
                    >
                      Part {ci + 1} of {subject.categories.length}
                    </p>
                    <h2
                      className="text-[18px] md:text-[22px]"
                      style={{
                        fontFamily: "var(--font-feather)",
                        fontWeight: 700,
                        color: "white",
                        lineHeight: 1.2,
                        marginTop: 2,
                      }}
                    >
                      {category.name}
                    </h2>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-3 py-1.5 tabular-nums"
                    style={{
                      background: "rgba(255,255,255,.2)",
                      color: "white",
                      fontSize: 12.5,
                      fontWeight: 700,
                    }}
                  >
                    {category.weight}%
                  </span>
                </div>
              </Reveal>

              {category.topics.map((topic) => (
                <div key={topic.name}>
                  {/* Topic marker */}
                  <Reveal>
                    <div className="flex items-center gap-3 py-5">
                      <span
                        className="shrink-0 rounded-full"
                        style={{ width: 10, height: 10, background: subject.color }}
                      />
                      <h3
                        className="text-[15px] md:text-[17px]"
                        style={{ fontFamily: "var(--font-feather)", fontWeight: 700, color: INK }}
                      >
                        {topic.name}
                      </h3>
                      <span
                        className="h-px flex-1"
                        style={{ background: "#d8e6f7" }}
                        aria-hidden="true"
                      />
                      <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>
                        {topic.subtopics.length}
                      </span>
                    </div>
                  </Reveal>

                  {/* Lesson nodes down a single trail. An earlier version
                      staggered them left and right, but the connector is drawn
                      per row, so alternating the offset broke the line into
                      disconnected stubs instead of reading as a winding path. */}
                  {topic.subtopics.map((subtopic, si) => {
                    const lessonNo = lessonNumbers.get(subtopic.name);
                    const isLast = si === topic.subtopics.length - 1;
                    return (
                      <Reveal key={subtopic.name} delay={si * 0.04}>
                        <div className="relative flex gap-4 pb-4">
                          {/* Trail line behind the node — stops at the last
                              node so the path doesn't dangle into the gap. */}
                          {!isLast && (
                            <span
                              aria-hidden="true"
                              className="absolute"
                              style={{
                                left: 27,
                                top: 56,
                                bottom: 0,
                                width: 3,
                                background: "#dceaf9",
                                borderRadius: 2,
                              }}
                            />
                          )}

                          {/* Node */}
                          <span
                            className="relative shrink-0 flex items-center justify-center tabular-nums"
                            style={{
                              width: 56,
                              height: 56,
                              borderRadius: "50%",
                              background: "white",
                              border: `3px solid ${subject.color}`,
                              boxShadow: `0 4px 0 ${subject.color}44`,
                              color: subject.color,
                              fontFamily: "var(--font-feather)",
                              fontWeight: 700,
                              fontSize: 18,
                            }}
                          >
                            {lessonNo}
                          </span>

                          {/* Lesson card */}
                          <div
                            className="flex-1 min-w-0 rounded-2xl px-4 py-3.5"
                            style={{
                              background: "white",
                              boxShadow: "0 3px 0 #dceaf9",
                            }}
                          >
                            <h4
                              className="text-[14.5px]"
                              style={{ fontWeight: 700, color: INK, lineHeight: 1.3 }}
                            >
                              {subtopic.name}
                            </h4>
                            <p
                              style={{
                                fontSize: 12.5,
                                color: MUTED,
                                lineHeight: 1.5,
                                marginTop: 3,
                              }}
                            >
                              {subtopic.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2.5">
                              <span
                                className="rounded-full px-2 py-0.5"
                                style={{
                                  background: subject.iconBg,
                                  color: subject.color,
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                }}
                              >
                                {LEVEL_LABELS[subtopic.level] ?? `Level ${subtopic.level}`}
                              </span>
                              <span style={{ fontSize: 11.5, color: MUTED, fontWeight: 600 }}>
                                {subtopic.minutes} min
                              </span>
                            </div>
                          </div>
                        </div>
                      </Reveal>
                    );
                  })}
                </div>
              ))}
            </section>
          ))}

          {/* Every remaining subject, not just the sequential next one — the
              reader has finished this leg and may want any of the others, and
              the switcher at the top is a long scroll away by this point. */}
          {others.length > 0 && (
            <Reveal>
              <div className="mt-10">
                <p
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: ".16em",
                    textTransform: "uppercase",
                    color: MUTED,
                    marginBottom: 12,
                  }}
                >
                  Other subjects
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {others.map((other) => (
                    <Link
                      key={other.slug}
                      href={`/subjects/${other.slug}`}
                      className="group flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-transform hover:-translate-y-0.5"
                      style={{ background: "white", boxShadow: "0 4px 0 #dceaf9" }}
                    >
                      <span
                        className="shrink-0 flex items-center justify-center"
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 11,
                          background: other.iconBg,
                        }}
                      >
                        <span className="flex scale-[.78]">{other.icon}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className="block text-[14px]"
                          style={{
                            fontFamily: "var(--font-feather)",
                            fontWeight: 700,
                            color: INK,
                            lineHeight: 1.25,
                          }}
                        >
                          {other.shortName}
                        </span>
                        <span
                          className="block tabular-nums"
                          style={{ fontSize: 11.5, color: MUTED, fontWeight: 600, marginTop: 2 }}
                        >
                          {subtopicCount(other)} lessons
                        </span>
                      </span>
                      <ArrowRight
                        className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                        style={{ color: other.color }}
                      />
                    </Link>
                  ))}
                </div>
              </div>
            </Reveal>
          )}
          {/* Closing CTA. It sits after "Other subjects" so the page ends on
              the action rather than on links leading away. */}
          <Reveal>
            <div
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 rounded-2xl px-6 py-6 mt-6"
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
                Which of these {subtopicCount(subject)} lessons do you actually need?
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
                Take the free diagnostic
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

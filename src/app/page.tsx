import Link from "next/link";
import Image from "next/image";
import Reveal from "@/components/ui/Reveal";
import LandingNavbar from "@/components/layout/LandingNavbar";
import LandingFooter from "@/components/layout/LandingFooter";
import LiveGaDemo from "@/components/method/LiveGaDemo";
import { LANDING_SUBJECTS, TOTAL_TOPICS, findSubject, subtopicCount } from "@/components/landing/subjects";

/* ─── Hero ───────────────────────────────────────────────────── */

function HeroSection() {
  const mathSubject = findSubject("math");
  const mathLessonCount = mathSubject ? subtopicCount(mathSubject) : 0;
  // A real lesson from the curriculum, so the mock-up card can't quote a topic
  // the product doesn't teach.
  // subtopics[0] rather than [1]: "Integer Operations" fits on one line, where
  // "Fractions, Decimals & Percents" wrapped and made the card tall enough to
  // collide with the illustration.
  const sampleLesson = mathSubject?.categories[0].topics[0].subtopics[0] ?? {
    name: "Integer Operations",
    minutes: 45,
  };

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(145deg,#030C1A 0%,#050E1D 40%,#071530 100%)", paddingTop: 64 }}
    >
      {/* Dot grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(rgba(37,99,235,.22) 1px,transparent 1px)",
          backgroundSize: "28px 28px",
          zIndex: 0,
        }}
      />
      {/* Radial blue glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: -100,
          left: "25%",
          width: 560,
          height: 380,
          borderRadius: "50%",
          background: "radial-gradient(ellipse,rgba(37,99,235,.13) 0%,transparent 70%)",
          zIndex: 0,
        }}
      />
      {/* Light right panel (diagonal) — desktop only */}
      <div
        className="absolute hidden md:block"
        style={{
          right: 0, top: 0, bottom: 0, width: "54%",
          background: "#EFF6FF",
          clipPath: "polygon(9% 0,100% 0,100% 100%,0% 100%)",
          zIndex: 1,
        }}
      />
      {/* Blue accent strip at diagonal edge — desktop only */}
      <div
        className="absolute hidden md:block pointer-events-none"
        style={{
          right: 0, top: 0, bottom: 0, width: "54%",
          clipPath: "polygon(9% 0,calc(9% + 3px) 0,calc(0% + 3px) 100%,0% 100%)",
          background: "#1e90e8",
          opacity: 0.6,
          zIndex: 2,
        }}
      />

      {/* Main grid: 1-col on mobile, 2-col on desktop */}
      <Reveal
        className="relative max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-[46%_54%] min-h-[auto] md:min-h-[680px]"
        style={{ zIndex: 10 }}
        amount={0}
      >
        {/* LEFT: Text column */}
        <div className="flex flex-col justify-center px-5 py-12 md:pt-[72px] md:pr-[48px] md:pb-[180px] md:pl-[40px]">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 self-start"
            style={{
              border: "1px solid rgba(255,255,255,.14)",
              borderRadius: 100,
              padding: "5px 14px",
              marginBottom: 20,
            }}
          >
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#1e90e8", flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)", letterSpacing: ".1em", textTransform: "uppercase" }}>
              AI-Powered · Free
            </span>
          </div>

          {/* Heading */}
          <h1
            className="text-[38px] md:text-[60px]"
            style={{
              fontFamily: "var(--font-feather)",
              fontWeight: 700,
              lineHeight: 1.06,
              color: "white",
              marginBottom: 16,
            }}
          >
            Study smart.<br />
            <span style={{ color: "#1e90e8" }}>Pass your GED.</span>
          </h1>

          {/* Description */}
          <p style={{ fontSize: 15, color: "rgba(255,255,255,.52)", lineHeight: 1.72, maxWidth: 380, marginBottom: 28 }}>
            Adaptive AI maps your exact gaps and builds a personalized study plan —
            every minute counts toward your diploma.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-wrap items-center gap-3" style={{ marginBottom: 20 }}>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 transition-transform duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.08] hover:brightness-110 active:scale-[0.95]"
              style={{
                padding: "13px 24px",
                background: "#1e90e8",
                color: "white",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 700,
                boxShadow: "0 4px 0 #1670be",
                textDecoration: "none",
              }}
            >
              Start for Free
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Trust pills */}
          <div className="flex items-center flex-wrap gap-[14px]">
            {["Free forever", "57 topics", "AI plan"].map((label) => (
              <div key={label} className="flex items-center gap-[5px]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#22C55E">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,.38)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Mascots + floating cards — desktop only */}
        <div
          className="hidden md:flex relative"
          style={{ alignItems: "flex-end", justifyContent: "center", padding: "24px 16px 0 100px", minHeight: 560 }}
        >
          {/* Soft glow behind characters */}
          <div
            className="absolute pointer-events-none"
            style={{
              bottom: 60,
              left: "50%",
              transform: "translateX(-50%)",
              width: 340,
              height: 340,
              borderRadius: "50%",
              background: "radial-gradient(circle,rgba(37,99,235,.11) 0%,transparent 70%)",
            }}
          />

          {/* Floating badge: streak (top-right) */}
          <div
            className="absolute"
            style={{
              top: "4%", right: "3%", zIndex: 20,
              animation: "floatC 3.2s .4s ease-in-out infinite",
              background: "#1e90e8",
              borderRadius: 12,
              padding: "9px 16px",
              boxShadow: "0 6px 20px rgba(37,99,235,.35)",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.7)", marginBottom: 2 }}>🔥 7-day streak</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>Keep it up!</div>
          </div>

          {/* Floating badge: today's session (left-mid).
              Replaces a "Predicted Score 158 ✓ Pass" badge. The app has no score
              prediction — grep for "predicted" across the API, lib and schema
              returns nothing — so it advertised a feature that doesn't exist.
              Showing the next session instead demonstrates what the plan
              actually does, uses a real lesson from the curriculum, and states a
              task rather than a verdict on the learner. */}
          <div
            className="absolute"
            style={{
              top: "40%", left: -18, zIndex: 20,
              animation: "floatB 3.6s .8s ease-in-out infinite",
              background: "#ffffff",
              border: "1px solid #d8e6f7",
              borderRadius: 12,
              padding: "10px 14px",
              boxShadow: "0 6px 24px rgba(37,99,235,.13)",
              maxWidth: 172,
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 700, color: "#5b769a", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>
              Today&apos;s session
            </div>
            <div style={{ fontFamily: "var(--font-feather)", fontSize: 14, fontWeight: 700, color: "#0f2748", lineHeight: 1.25 }}>
              {sampleLesson.name}
            </div>
            <div style={{ fontSize: 10, color: "#5b769a", marginTop: 3 }}>
              {sampleLesson.minutes} min · picked for you
            </div>
          </div>

          {/* Floating badge: Math Progress (top-left) */}
          <div
            className="absolute"
            style={{
              top: "9%", left: 0, zIndex: 20,
              animation: "floatA 3.8s .2s ease-in-out infinite",
              background: "#ffffff",
              border: "1px solid #d8e6f7",
              borderRadius: 12,
              padding: "10px 14px",
              boxShadow: "0 6px 24px rgba(37,99,235,.1)",
              minWidth: 148,
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 700, color: "#1e90e8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Math Progress</div>
            <div style={{ height: 5, background: "#e9f2fd", borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
              <div style={{ width: "75%", height: "100%", background: "#1e90e8", borderRadius: 3 }} />
            </div>
            {/* Lesson count comes from the shared curriculum so it can't drift
                from the real figure the way the hardcoded 14 had. The 75% is
                illustrative — this card is a mock-up of the dashboard, like the
                streak and predicted-score badges beside it. */}
            <div style={{ fontSize: 10, color: "#5b769a" }}>
              75% · {mathLessonCount} topics
            </div>
          </div>

          {/* Duo hero image */}
          <Image
            src="/mascots/duo-hero.png"
            alt="Nam and Nick studying together at their laptops"
            width={600}
            height={500}
            className="relative"
            style={{
              width: "100%",
              maxWidth: 600,
              height: "auto",
              zIndex: 10,
              animation: "floatA 4s ease-in-out infinite",
              flexShrink: 0,
              filter: "drop-shadow(0 20px 32px rgba(37,99,235,.18))",
            }}
          />
        </div>
      </Reveal>
    </section>
  );
}

/* ─── Stats bar ──────────────────────────────────────────────── */

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center py-2 md:py-0">
      <div className="text-[36px] md:text-[52px]" style={{ fontFamily: "var(--font-feather)", fontWeight: 700, color: "white", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".12em", marginTop: 6, fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );
}

function StatsSection() {
  return (
    <Reveal className="px-4 py-8 md:px-[40px] md:py-[40px]" style={{ background: "#1e90e8" }}>
      <div className="max-w-[1200px] mx-auto grid grid-cols-2 gap-6 md:flex md:items-center md:justify-between md:gap-0">
        <StatItem value="57" label="Topics covered" />
        <div className="hidden md:block" style={{ width: 1, height: 52, background: "rgba(255,255,255,.15)" }} />
        <StatItem value="4" label="GED subjects" />
        <div className="hidden md:block" style={{ width: 1, height: 52, background: "rgba(255,255,255,.15)" }} />
        <StatItem value="AI" label="Adaptive plan" />
        <div className="hidden md:block" style={{ width: 1, height: 52, background: "rgba(255,255,255,.15)" }} />
        <StatItem value="Free" label="To start" />
      </div>
    </Reveal>
  );
}

/* ─── Features Bento ─────────────────────────────────────────── */

function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-16 px-4 py-16 md:px-[40px] md:py-24">
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <Reveal style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#1e90e8", textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 12 }}>
            What we offer
          </p>
          <h2
            className="text-[32px] md:text-[48px]"
            style={{ fontFamily: "var(--font-feather)", fontWeight: 700, color: "var(--foreground)", lineHeight: 1.1 }}
          >
            Everything you need<br />to pass, in one place.
          </h2>
        </Reveal>

        {/* Bento grid: single column on mobile, full 2x2 on desktop */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-[18px]">

          {/* Card 1: Assessment */}
          <Reveal
            style={{
              background: "#f4f8ff",
              borderRadius: 24,
              padding: 28,
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              minHeight: 260,
            }}
          >
            {/* Mini quiz mockup */}
            <div style={{ background: "white", borderRadius: 14, padding: 16, border: "1px solid #d8e6f7", marginBottom: 16, position: "relative", zIndex: 1 }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#17a673", flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#5b769a", flex: 1 }}>Math · Question 3 of 10</span>
                <div style={{ width: 80, height: 4, background: "#d8e6f7", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: "7%", height: "100%", background: "#1e90e8", borderRadius: 2 }} />
                </div>
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#0f2748", marginBottom: 10, lineHeight: 1.4 }}>
                What is the slope of the line y = 3x − 5?
              </p>
              <div className="flex flex-col gap-[6px]">
                <div className="flex items-center gap-2" style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #1e90e8", background: "#d8ecfd", fontSize: 12, fontWeight: 600, color: "#1e90e8" }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#1e90e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "white", flexShrink: 0 }}>A</div>
                  3
                </div>
                <div className="flex items-center gap-2" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d8e6f7", fontSize: 12, color: "#5b769a" }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px solid #d8e6f7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#5b769a", flexShrink: 0 }}>B</div>
                  −5
                </div>
              </div>
            </div>

            {/* Bottom text */}
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: "#1e90e8", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="2" />
                  <path d="M9 12h6M9 16h4" />
                </svg>
              </div>
              <h3 style={{ fontFamily: "var(--font-feather)", fontSize: 20, fontWeight: 700, color: "#0f2748", marginBottom: 6 }}>Diagnostic Assessment</h3>
              <p style={{ fontSize: 13, color: "#5b769a", lineHeight: 1.5 }}>Ten questions for each subject you pick. Every question belongs to one lesson, so your results come back lesson by lesson — not one score per subject.</p>
            </div>
          </Reveal>

          {/* Card 2: Adaptive AI — blue bg */}
          <Reveal
            delay={0.1}
            style={{
              background: "#1e90e8",
              borderRadius: 24,
              padding: 28,
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              minHeight: 260,
            }}
          >
            <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6, position: "relative", zIndex: 1 }}>
              {[{ label: "MATH", w: "80%", c: "rgba(255,255,255,.7)" }, { label: "SCI", w: "52%", c: "rgba(255,255,255,.5)" }, { label: "RLA", w: "68%", c: "#FBBF24" }].map((b) => (
                <div key={b.label} className="flex items-center gap-2">
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,.4)", fontWeight: 600, width: 32, flexShrink: 0 }}>{b.label}</span>
                  <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,.12)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: b.w, height: "100%", background: b.c, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 2, fontSize: 10, color: "rgba(255,255,255,.35)" }}>6 goals balanced at once</div>
            </div>
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <h3 style={{ fontFamily: "var(--font-feather)", fontSize: 20, fontWeight: 700, color: "white", marginBottom: 6 }}>Adaptive AI Planning</h3>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,.6)", lineHeight: 1.5 }}>Weak spots get more time, finished lessons get skipped, and the basics come first — all inside the hours you are free.</p>
            </div>
          </Reveal>

          {/* Card 3: Progress — donut rings */}
          <Reveal
            delay={0.2}
            style={{
              background: "#f4f8ff",
              borderRadius: 24,
              padding: 28,
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              minHeight: 260,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16, position: "relative", zIndex: 1 }}>
              {[
                { pct: 75, color: "#2563EB", label: "Math" },
                { pct: 82, color: "#16A34A", label: "RLA" },
                { pct: 58, color: "#7C3AED", label: "SCI" },
                { pct: 67, color: "#D97706", label: "SS" },
              ].map((d) => (
                <div key={d.label} style={{ textAlign: "center" }}>
                  <div style={{ position: "relative", width: 54, height: 54, margin: "0 auto 4px" }}>
                    <div
                      style={{
                        width: 54, height: 54, borderRadius: "50%",
                        background: `conic-gradient(${d.color} ${d.pct}%,#d8e6f7 0)`,
                        WebkitMask: "radial-gradient(farthest-side,transparent 56%,black 0)",
                        mask: "radial-gradient(farthest-side,transparent 56%,black 0)",
                      }}
                    />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#0f2748" }}>{d.pct}%</div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#5b769a", textTransform: "uppercase", letterSpacing: ".05em" }}>{d.label}</div>
                </div>
              ))}
            </div>
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: "#d8ecfd", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <h3 style={{ fontFamily: "var(--font-feather)", fontSize: 20, fontWeight: 700, color: "#0f2748", marginBottom: 6 }}>Progress Tracking</h3>
              <p style={{ fontSize: 13, color: "#5b769a", lineHeight: 1.5 }}>Lesson-by-lesson scores, your study streak, and a nudge when something is not sticking.</p>
            </div>
          </Reveal>

          {/* Card 4: Full-length mock test — timed, multi-subject */}
          <Reveal
            delay={0.3}
            style={{
              background: "#f4f8ff",
              borderRadius: 24,
              padding: 28,
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              minHeight: 260,
            }}
          >
            {/* Subject + timer mockup */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, position: "relative", zIndex: 1 }}>
              {[
                { label: "Mathematical Reasoning", color: "#2563EB", bg: "#e4edfd" },
                { label: "Reasoning Through Language Arts", color: "#16A34A", bg: "#e3f6ec" },
                { label: "Social Studies", color: "#D97706", bg: "#fdf1e3" },
                { label: "Science", color: "#7C3AED", bg: "#efe6fb" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between"
                  style={{ padding: "8px 12px", borderRadius: 10, background: s.bg, fontSize: 12, fontWeight: 600, color: s.color }}
                >
                  <span>{s.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.7 }}>30:00</span>
                </div>
              ))}
            </div>
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: "#d8ecfd", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
              </div>
              <h3 style={{ fontFamily: "var(--font-feather)", fontSize: 20, fontWeight: 700, color: "#0f2748", marginBottom: 6 }}>Full-Length Mock Test</h3>
              <p style={{ fontSize: 13, color: "#5b769a", lineHeight: 1.5 }}>A timed, full-length practice exam for each subject — 30 minutes a piece, the same structure as test day.</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── Subjects ───────────────────────────────────────────────── */

function SubjectsSection() {
  const subjects = LANDING_SUBJECTS;

  return (
    <section id="subjects" className="scroll-mt-16 px-4 py-16 md:px-[40px] md:py-24">
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <Reveal className="flex items-end justify-between flex-wrap gap-4" style={{ marginBottom: 40 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#1e90e8", textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 12 }}>
              Full coverage
            </p>
            <h2
              className="text-[32px] md:text-[48px]"
              style={{ fontFamily: "var(--font-feather)", fontWeight: 700, color: "#0f2748", lineHeight: 1.1 }}
            >
              All 4 GED subjects.
            </h2>
          </div>
          <p className="hidden md:block" style={{ fontSize: 15, color: "#5b769a", maxWidth: 280, lineHeight: 1.6 }}>
            {TOTAL_TOPICS} topics. Every subtopic on exam day. Nothing left out.
          </p>
        </Reveal>

        {/* Subject rows */}
        <div>
          {subjects.map((s, i) => (
            <Reveal
              key={s.name}
              delay={i * 0.08}
              style={{
                borderTop: "1px solid #d8e6f7",
                borderBottom: i === subjects.length - 1 ? "1px solid #d8e6f7" : undefined,
              }}
            >
            <Link
              href={`/subjects/${s.slug}`}
              className="group flex items-center gap-3 sm:gap-5 transition-colors hover:bg-[#f4f8ff]"
              style={{ padding: "20px 0" }}
            >
              {/* Color bar */}
              <div style={{ width: 3, height: 44, background: s.color, borderRadius: 2, flexShrink: 0 }} />
              {/* Icon */}
              <div style={{ width: 42, height: 42, background: s.iconBg, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {s.icon}
              </div>
              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".09em", color: s.color, fontWeight: 700, marginBottom: 3 }}>{subtopicCount(s)} topics</div>
                <h3 className="text-[15px] md:text-[20px]" style={{ fontFamily: "var(--font-feather)", fontWeight: 700, color: "#0f2748", marginBottom: 1 }}>{s.name}</h3>
                <p className="hidden sm:block" style={{ fontSize: 13, color: "#5b769a" }}>{s.desc}</p>
              </div>
              {/* Arrow — hidden on mobile */}
              <div
                className="hidden sm:block transition-transform group-hover:translate-x-0.5"
                style={{ fontSize: 13, color: s.color, fontWeight: 600, flexShrink: 0 }}
              >
                View topics →
              </div>
            </Link>
            </Reveal>
          ))}
        </div>

        {/* Close-out: the full syllabus, for anyone who wants the whole picture
            before committing to one subject. */}
        <Reveal className="flex justify-end" style={{ marginTop: 28 }}>
          <Link
            href="/subjects"
            className="inline-flex items-center gap-2 transition-transform duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.04] active:scale-[0.97]"
            style={{
              padding: "12px 22px",
              background: "#1e90e8",
              color: "white",
              borderRadius: 12,
              fontSize: 14.5,
              fontWeight: 700,
              boxShadow: "0 3px 0 #1670be",
              textDecoration: "none",
            }}
          >
            View the full syllabus →
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Live algorithm demo ────────────────────────────────────── */

function LiveGaSection() {
  return (
    <section className="px-4 py-16 md:px-[40px] md:py-24" style={{ background: "#f4f8ff" }}>
      <div className="max-w-[1060px] mx-auto">
        <Reveal style={{ marginBottom: 32 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#1e90e8",
              textTransform: "uppercase",
              letterSpacing: ".12em",
              marginBottom: 12,
            }}
          >
            See it run
          </p>
          <h2
            className="text-[32px] md:text-[44px]"
            style={{
              fontFamily: "var(--font-feather)",
              fontWeight: 700,
              color: "#0f2748",
              lineHeight: 1.1,
            }}
          >
            Build a week, live.
          </h2>
          <p
            className="text-[15px] md:text-[16.5px]"
            style={{ color: "#5b769a", lineHeight: 1.7, marginTop: 14, maxWidth: 620 }}
          >
            This isn&apos;t a recording. Press the button and the planner runs in your browser on
            real lessons from the syllabus, scored by the same function that builds a real study
            plan.
          </p>
        </Reveal>

        <Reveal>
          <LiveGaDemo />
        </Reveal>

        <Reveal>
          <p style={{ fontSize: 12, color: "#5b769a", lineHeight: 1.6, marginTop: 12 }}>
            Real lessons and real scoring, for one example learner — a public page has no signed-in
            student to plan for.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── CTA ────────────────────────────────────────────────────── */

function CtaSection() {
  return (
    <section
      className="px-4 py-16 md:px-[40px] md:py-[72px]"
      style={{
        background: "linear-gradient(135deg,#030C1A 0%,#050E1D 45%,#1D4ED8 100%)",
        position: "relative",
        overflow: "hidden",
        minHeight: 240,
      }}
    >
      {/* Dot pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(rgba(37,99,235,.2) 1px,transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <Reveal className="max-w-[640px] mx-auto text-center relative" style={{ zIndex: 1 }}>
        <h2
          className="text-[30px] md:text-[50px]"
          style={{
            fontFamily: "var(--font-feather)",
            fontWeight: 700,
            color: "white",
            lineHeight: 1.12,
            marginBottom: 14,
          }}
        >
          Ready to pass<br />your GED?
        </h2>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,.55)", marginBottom: 28, lineHeight: 1.65 }}>
          Start free today. No credit card. No commitment. Just results.
        </p>
        <Link
          href="/register"
          className="transition-transform duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.08] active:scale-[0.95]"
          style={{
            display: "inline-block",
            padding: "14px 36px",
            background: "white",
            color: "#1e90e8",
            borderRadius: 14,
            fontSize: 16,
            fontWeight: 700,
            boxShadow: "0 4px 0 rgba(0,0,0,.2)",
            textDecoration: "none",
          }}
        >
          Create Free Account →
        </Link>
      </Reveal>
    </section>
  );
}

/* ─── Footer ─────────────────────────────────────────────────── */

/* ─── Page ───────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <LandingNavbar />
      <main>
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <SubjectsSection />
        <LiveGaSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}

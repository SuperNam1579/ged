import Link from "next/link";
import Image from "next/image";
import { BookOpen } from "lucide-react";

/* ─── Navbar ─────────────────────────────────────────────────── */

function DuoNavbar() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{ background: "#060D1C", borderBottom: "1px solid rgba(255,255,255,.07)" }}
    >
      <div
        className="max-w-[1200px] mx-auto px-10 flex items-center justify-between"
        style={{ height: 64 }}
      >
        {/* Logo */}
        <div className="flex items-center gap-[10px]">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 34, height: 34, background: "#1e90e8", borderRadius: 9, boxShadow: "0 3px 0 #1670be" }}
          >
            <BookOpen className="text-white" style={{ width: 18, height: 18 }} strokeWidth={2.5} />
          </div>
          <span style={{ fontFamily: "var(--font-feather)", fontSize: 18, fontWeight: 700, color: "white" }}>
            GED Prep
          </span>
        </div>

        {/* Nav links */}
        <div
          className="hidden md:flex items-center gap-8"
          style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,.45)" }}
        >
          <a href="#features" className="hover:text-white transition-colors" style={{ color: "inherit", textDecoration: "none" }}>Features</a>
          <a href="#subjects" className="hover:text-white transition-colors" style={{ color: "inherit", textDecoration: "none" }}>Subjects</a>
          <a href="#how-it-works" className="hover:text-white transition-colors" style={{ color: "inherit", textDecoration: "none" }}>How it works</a>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-[10px]">
          <Link
            href="/login"
            style={{
              padding: "9px 18px",
              background: "transparent",
              color: "rgba(255,255,255,.65)",
              border: "1.5px solid rgba(255,255,255,.18)",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Sign In
          </Link>
          <Link
            href="/register"
            style={{
              padding: "9px 20px",
              background: "#1e90e8",
              color: "white",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              boxShadow: "0 3px 0 #1670be",
              textDecoration: "none",
            }}
          >
            Get Started →
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ─── Hero ───────────────────────────────────────────────────── */

function HeroSection() {
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
      {/* Light right panel (diagonal) */}
      <div
        className="absolute"
        style={{
          right: 0, top: 0, bottom: 0, width: "54%",
          background: "#EFF6FF",
          clipPath: "polygon(9% 0,100% 0,100% 100%,0% 100%)",
          zIndex: 1,
        }}
      />
      {/* Blue accent strip at diagonal edge */}
      <div
        className="absolute pointer-events-none"
        style={{
          right: 0, top: 0, bottom: 0, width: "54%",
          clipPath: "polygon(9% 0,calc(9% + 3px) 0,calc(0% + 3px) 100%,0% 100%)",
          background: "#1e90e8",
          opacity: 0.6,
          zIndex: 2,
        }}
      />

      {/* Main grid */}
      <div
        className="relative max-w-[1200px] mx-auto"
        style={{ display: "grid", gridTemplateColumns: "46% 54%", minHeight: 680, zIndex: 10 }}
      >
        {/* LEFT: Text column */}
        <div
          className="flex flex-col justify-center"
          style={{ padding: "72px 48px 180px 40px" }}
        >
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 self-start"
            style={{
              border: "1px solid rgba(255,255,255,.14)",
              borderRadius: 100,
              padding: "5px 14px",
              marginBottom: 22,
            }}
          >
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#1e90e8", flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)", letterSpacing: ".1em", textTransform: "uppercase" }}>
              AI-Powered · Free
            </span>
          </div>

          {/* Heading */}
          <h1
            style={{
              fontFamily: "var(--font-feather)",
              fontSize: 60,
              fontWeight: 700,
              lineHeight: 1.06,
              color: "white",
              marginBottom: 18,
            }}
          >
            Study smart.<br />
            <span style={{ color: "#1e90e8" }}>Pass your GED.</span>
          </h1>

          {/* Description */}
          <p style={{ fontSize: 15, color: "rgba(255,255,255,.52)", lineHeight: 1.72, maxWidth: 380, marginBottom: 32 }}>
            Adaptive AI maps your exact gaps and builds a personalized study plan —
            every minute counts toward your diploma.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-wrap items-center gap-3" style={{ marginBottom: 22 }}>
            <Link
              href="/register"
              className="inline-flex items-center gap-2"
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

          {/* Trust pills with checkmarks */}
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

        {/* RIGHT: Mascots + floating cards */}
        <div
          className="relative"
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "24px 16px 0 100px", minHeight: 560 }}
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

          {/* Floating badge: Predicted Score (left-mid) */}
          <div
            className="absolute"
            style={{
              top: "44%", left: 0, zIndex: 20,
              animation: "floatB 3.6s .8s ease-in-out infinite",
              background: "#ffffff",
              border: "1px solid #d8e6f7",
              borderRadius: 12,
              padding: "10px 14px",
              boxShadow: "0 6px 24px rgba(37,99,235,.13)",
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 700, color: "#5b769a", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>Predicted Score</div>
            <div style={{ fontFamily: "var(--font-feather)", fontSize: 22, fontWeight: 700, color: "#1e90e8", lineHeight: 1 }}>
              158 <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>✓ Pass</span>
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
            <div style={{ fontSize: 10, color: "#5b769a" }}>75% · 14 topics</div>
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
      </div>
    </section>
  );
}

/* ─── Stats bar ──────────────────────────────────────────────── */

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center" style={{ flex: 1 }}>
      <div style={{ fontFamily: "var(--font-feather)", fontSize: 52, fontWeight: 700, color: "white", lineHeight: 1 }}>
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
    <div style={{ background: "#1e90e8", padding: "40px 40px" }}>
      <div className="max-w-[1200px] mx-auto flex items-center justify-between">
        <StatItem value="57" label="Topics covered" />
        <div style={{ width: 1, height: 52, background: "rgba(255,255,255,.15)" }} />
        <StatItem value="4" label="GED subjects" />
        <div style={{ width: 1, height: 52, background: "rgba(255,255,255,.15)" }} />
        <StatItem value="AI" label="Adaptive plan" />
        <div style={{ width: 1, height: 52, background: "rgba(255,255,255,.15)" }} />
        <StatItem value="Free" label="To start" />
      </div>
    </div>
  );
}

/* ─── Features Bento ─────────────────────────────────────────── */

function FeaturesSection() {
  return (
    <section id="features" style={{ padding: "96px 40px" }}>
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div style={{ marginBottom: 56 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#1e90e8", textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 12 }}>
            What we offer
          </p>
          <h2
            style={{ fontFamily: "var(--font-feather)", fontSize: 48, fontWeight: 700, color: "var(--foreground)", lineHeight: 1.1 }}
          >
            Everything you need<br />to pass, in one place.
          </h2>
        </div>

        {/* Bento grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "3fr 2fr",
            gridTemplateRows: "240px 240px",
            gap: 18,
          }}
        >
          {/* Card 1: Assessment — spans 2 rows */}
          <div
            style={{
              gridRow: "span 2",
              background: "#f4f8ff",
              borderRadius: 24,
              padding: 36,
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Faded number */}
            <div
              style={{
                position: "absolute",
                right: -20,
                bottom: -44,
                fontFamily: "var(--font-feather)",
                fontSize: 190,
                fontWeight: 700,
                color: "#1e90e8",
                opacity: 0.055,
                lineHeight: 1,
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              01
            </div>

            {/* Mini quiz mockup */}
            <div style={{ background: "white", borderRadius: 14, padding: 16, border: "1px solid #d8e6f7", marginBottom: "auto", position: "relative", zIndex: 1 }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#17a673", flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#5b769a", flex: 1 }}>Math · Question 3 of 40</span>
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
                <div className="flex items-center gap-2" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d8e6f7", fontSize: 12, color: "#5b769a" }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px solid #d8e6f7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#5b769a", flexShrink: 0 }}>C</div>
                  5
                </div>
              </div>
            </div>

            {/* Bottom text */}
            <div style={{ position: "relative", zIndex: 1, marginTop: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: "#1e90e8", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="2" />
                  <path d="M9 12h6M9 16h4" />
                </svg>
              </div>
              <h3 style={{ fontFamily: "var(--font-feather)", fontSize: 22, fontWeight: 700, color: "#0f2748", marginBottom: 8 }}>Diagnostic Assessment</h3>
              <p style={{ fontSize: 14, color: "#5b769a", lineHeight: 1.6 }}>40 targeted questions map every knowledge gap — your plan targets only what you actually need.</p>
            </div>
          </div>

          {/* Card 2: Adaptive AI — blue bg */}
          <div
            style={{
              background: "#1e90e8",
              borderRadius: 24,
              padding: 28,
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <div style={{ position: "absolute", right: -14, top: -28, fontFamily: "var(--font-feather)", fontSize: 110, fontWeight: 700, color: "rgba(255,255,255,.08)", lineHeight: 1, pointerEvents: "none" }}>02</div>
            {/* Mini schedule bars */}
            <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6, position: "relative", zIndex: 1 }}>
              {[{ label: "MATH", w: "80%", c: "rgba(255,255,255,.7)" }, { label: "SCI", w: "52%", c: "rgba(255,255,255,.5)" }, { label: "RLA", w: "68%", c: "#FBBF24" }].map((b) => (
                <div key={b.label} className="flex items-center gap-2">
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,.4)", fontWeight: 600, width: 32, flexShrink: 0 }}>{b.label}</span>
                  <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,.12)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: b.w, height: "100%", background: b.c, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 2, fontSize: 10, color: "rgba(255,255,255,.35)" }}>↑ Plan updated after last quiz</div>
            </div>
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <h3 style={{ fontFamily: "var(--font-feather)", fontSize: 20, fontWeight: 700, color: "white", marginBottom: 6 }}>Adaptive AI Planning</h3>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,.6)", lineHeight: 1.5 }}>Your plan reshapes in real time — harder topics get more time, mastered ones get skipped.</p>
            </div>
          </div>

          {/* Card 3: Progress — donut rings */}
          <div
            style={{
              background: "#f4f8ff",
              borderRadius: 24,
              padding: 28,
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <div style={{ position: "absolute", right: -14, top: -28, fontFamily: "var(--font-feather)", fontSize: 110, fontWeight: 700, color: "#1e90e8", opacity: 0.055, lineHeight: 1, pointerEvents: "none" }}>03</div>
            {/* Mini donut rings */}
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
                        width: 54,
                        height: 54,
                        borderRadius: "50%",
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
              <p style={{ fontSize: 13, color: "#5b769a", lineHeight: 1.5 }}>Subject scores, predicted GED result, and weak-area spotlights — always up to date.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works ───────────────────────────────────────────── */

function HowItWorksSection() {
  const steps = [
    {
      num: "01",
      eyebrow: "Assessment",
      color: "#1e90e8",
      opacity: 0.1,
      title: "Take the Assessment",
      body: "40 quick questions across Math, Science, Social Studies, and Language Arts pinpoint exactly where you are and where you need to go.",
    },
    {
      num: "02",
      eyebrow: "Planning",
      color: "#1cb0f6",
      opacity: 0.13,
      title: "Get Your AI Plan",
      body: "Our genetic algorithm builds an optimal, personalized schedule based on your gaps, your exam date, and your weekly availability.",
    },
    {
      num: "03",
      eyebrow: "Study",
      color: "#D97706",
      opacity: 0.12,
      title: "Study, Quiz, Repeat",
      body: "Follow daily sessions, complete quizzes, and watch your plan adapt automatically. Each result makes your next session smarter.",
    },
  ];

  return (
    <section id="how-it-works" style={{ background: "#f4f8ff", padding: "0 40px 96px" }}>
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div style={{ padding: "72px 0 52px" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#1e90e8", textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 12 }}>
            The process
          </p>
          <h2 style={{ fontFamily: "var(--font-feather)", fontSize: 48, fontWeight: 700, color: "#0f2748", lineHeight: 1.1 }}>
            Three steps.<br />One diploma.
          </h2>
        </div>

        {/* Numbered rows */}
        <div style={{ borderTop: "1px solid #d8e6f7" }}>
          {steps.map((s) => (
            <div
              key={s.num}
              style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr",
                alignItems: "start",
                borderBottom: "1px solid #d8e6f7",
                padding: "48px 0",
                position: "relative",
              }}
            >
              {/* Left color bar */}
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: s.color, borderRadius: 2 }} />
              {/* Big number */}
              <div
                style={{
                  fontFamily: "var(--font-feather)",
                  fontSize: 110,
                  fontWeight: 700,
                  color: s.color,
                  opacity: s.opacity,
                  lineHeight: 1,
                  textAlign: "right",
                  paddingRight: 40,
                }}
              >
                {s.num}
              </div>
              {/* Content */}
              <div style={{ paddingTop: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>
                  {s.eyebrow}
                </p>
                <h3 style={{ fontFamily: "var(--font-feather)", fontSize: 28, fontWeight: 700, color: "#0f2748", marginBottom: 14 }}>
                  {s.title}
                </h3>
                <p style={{ fontSize: 15, color: "#5b769a", lineHeight: 1.7, maxWidth: 520 }}>
                  {s.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Subjects ───────────────────────────────────────────────── */

function SubjectsSection() {
  const subjects = [
    {
      color: "#1e90e8",
      iconBg: "#d8ecfd",
      icon: <span style={{ color: "#1e90e8", fontWeight: 700, fontSize: 20, fontFamily: "var(--font-feather)" }}>∑</span>,
      topics: "14 topics",
      name: "Mathematical Reasoning",
      desc: "Algebra, geometry, statistics, data analysis",
      badgeBg: "#d8ecfd",
      badgeBorder: "#a0c9f0",
      badgeColor: "#1e90e8",
      badge: "75% ready",
    },
    {
      color: "#16A34A",
      iconBg: "#F0FDF4",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      ),
      topics: "18 topics",
      name: "Reasoning Through Language Arts",
      desc: "Reading, writing, grammar, argument analysis",
      badgeBg: "#F0FDF4",
      badgeBorder: "#86EFAC",
      badgeColor: "#16A34A",
      badge: "82% ready",
    },
    {
      color: "#7C3AED",
      iconBg: "#F5F3FF",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="3" />
          <line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" />
          <line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" />
        </svg>
      ),
      topics: "15 topics",
      name: "Science",
      desc: "Life science, physical science, earth and space science",
      badgeBg: "#F5F3FF",
      badgeBorder: "#C4B5FD",
      badgeColor: "#7C3AED",
      badge: "58% ready",
    },
    {
      color: "#D97706",
      iconBg: "#FFFBEB",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
      topics: "10 topics",
      name: "Social Studies",
      desc: "US civics, American history, economics, geography",
      badgeBg: "#FFFBEB",
      badgeBorder: "#FCD34D",
      badgeColor: "#D97706",
      badge: "67% ready",
    },
  ];

  return (
    <section id="subjects" style={{ padding: "96px 40px" }}>
      <div className="max-w-[1200px] mx-auto">
        {/* Header split */}
        <div className="flex items-end justify-between flex-wrap gap-4" style={{ marginBottom: 52 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#1e90e8", textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 12 }}>
              Full coverage
            </p>
            <h2 style={{ fontFamily: "var(--font-feather)", fontSize: 48, fontWeight: 700, color: "#0f2748", lineHeight: 1.1 }}>
              All 4 GED subjects.
            </h2>
          </div>
          <p style={{ fontSize: 15, color: "#5b769a", maxWidth: 280, lineHeight: 1.6 }}>
            57 topics. Every subtopic on exam day. Nothing left out.
          </p>
        </div>

        {/* Subject rows */}
        <div>
          {subjects.map((s, i) => (
            <div
              key={s.name}
              className="flex items-center gap-5"
              style={{
                padding: "26px 0",
                borderTop: "1px solid #d8e6f7",
                borderBottom: i === subjects.length - 1 ? "1px solid #d8e6f7" : undefined,
              }}
            >
              {/* Color bar */}
              <div style={{ width: 3, height: 52, background: s.color, borderRadius: 2, flexShrink: 0 }} />
              {/* Icon */}
              <div style={{ width: 46, height: 46, background: s.iconBg, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {s.icon}
              </div>
              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".09em", color: s.color, fontWeight: 700, marginBottom: 4 }}>{s.topics}</div>
                <h3 style={{ fontFamily: "var(--font-feather)", fontSize: 20, fontWeight: 700, color: "#0f2748", marginBottom: 2 }}>{s.name}</h3>
                <p style={{ fontSize: 13, color: "#5b769a" }}>{s.desc}</p>
              </div>
              {/* Badge */}
              <div
                style={{
                  flexShrink: 0,
                  background: s.badgeBg,
                  border: `1px solid ${s.badgeBorder}`,
                  borderRadius: 20,
                  padding: "4px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  color: s.badgeColor,
                }}
              >
                {s.badge}
              </div>
              {/* Arrow */}
              <div style={{ fontSize: 13, color: s.color, fontWeight: 600, flexShrink: 0 }}>Explore →</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA ────────────────────────────────────────────────────── */

function CtaSection() {
  return (
    <section
      style={{
        background: "linear-gradient(135deg,#030C1A 0%,#050E1D 45%,#1D4ED8 100%)",
        padding: "72px 40px",
        position: "relative",
        overflow: "hidden",
        minHeight: 260,
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
      <div className="max-w-[640px] mx-auto text-center relative" style={{ zIndex: 1 }}>
        <h2
          style={{
            fontFamily: "var(--font-feather)",
            fontSize: 50,
            fontWeight: 700,
            color: "white",
            lineHeight: 1.12,
            marginBottom: 14,
          }}
        >
          Ready to pass<br />your GED?
        </h2>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,.55)", marginBottom: 32, lineHeight: 1.65 }}>
          Start free today. No credit card. No commitment. Just results.
        </p>
        <Link
          href="/register"
          style={{
            display: "inline-block",
            padding: "15px 40px",
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
      </div>
    </section>
  );
}

/* ─── Footer ─────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer style={{ borderTop: "1px solid #d8e6f7", padding: "24px 40px", background: "var(--card)" }}>
      <div className="max-w-[1200px] mx-auto flex items-center justify-between flex-wrap gap-3">
        {/* Logo */}
        <div className="flex items-center gap-[9px]">
          <div style={{ width: 28, height: 28, background: "#1e90e8", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 0 #1670be" }}>
            <BookOpen className="text-white" style={{ width: 14, height: 14 }} strokeWidth={2.5} />
          </div>
          <span style={{ fontFamily: "var(--font-feather)", fontSize: 15, fontWeight: 700, color: "#0f2748" }}>GED Prep</span>
        </div>

        <p style={{ fontSize: 12, color: "#5b769a" }}>
          &copy; {new Date().getFullYear()} GED Prep · AI-powered adaptive learning
        </p>

        <div className="flex gap-[18px]" style={{ fontSize: 13, fontWeight: 600 }}>
          <Link href="/login" style={{ color: "#1e90e8", textDecoration: "none" }}>Sign In</Link>
          <Link href="/register" style={{ color: "#1e90e8", textDecoration: "none" }}>Get Started</Link>
        </div>
      </div>
    </footer>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <DuoNavbar />
      <main>
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <HowItWorksSection />
        <SubjectsSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}

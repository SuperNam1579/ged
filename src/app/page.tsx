import Link from "next/link";
import Image from "next/image";
import HeroIllustration from "@/components/illustrations/HeroIllustration";
import AdaptiveIllustration from "@/components/illustrations/AdaptiveIllustration";
import ProgressIllustration from "@/components/illustrations/ProgressIllustration";
import AssessmentIllustration from "@/components/illustrations/AssessmentIllustration";

/* ─── Logo ───────────────────────────────────────────────────── */

function GedLogo({ size = 10, textClass = "" }: { size?: number; textClass?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="bg-primary rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ width: size * 4, height: size * 4 }}
      >
        <svg viewBox="0 0 24 24" fill="none" style={{ width: size * 2.4, height: size * 2.4 }} aria-hidden="true">
          <path
            d="M4 19V5a2 2 0 012-2h12a2 2 0 012 2v14M4 19h16M4 19H2M20 19h2M9 7h6M9 11h6M9 15h4"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span
        className={`font-bold text-white ${textClass}`}
        style={{ fontFamily: "var(--font-feather)", fontSize: size * 1.8 }}
      >
        GED Prep
      </span>
    </div>
  );
}

/* ─── Navbar ─────────────────────────────────────────────────── */

function DuoNavbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#060D1C]/95 backdrop-blur border-b border-white/8">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-3.5 flex items-center justify-between">
        <GedLogo size={9} textClass="text-[18px]" />

        <div className="hidden md:flex items-center gap-8 text-[13px] font-semibold text-white/55">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#subjects" className="hover:text-white transition-colors">Subjects</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-5 py-2.5 text-[13px] font-bold text-white border border-white/25 rounded-xl hover:border-white/50 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-5 py-2.5 text-[13px] font-bold text-white bg-primary rounded-xl hover:bg-primary-dark transition-colors"
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
    <section className="flex flex-col md:flex-row min-h-screen overflow-hidden">
      {/* ── Left — dark panel ── */}
      <div className="md:w-1/2 bg-[#060D1C] flex flex-col justify-center px-8 md:px-12 lg:px-20 py-24">
        <div className="max-w-[520px] md:ml-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 border border-white/20 rounded-full px-4 py-1.5 mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
            <span className="text-[11px] font-bold text-white/55 tracking-[0.14em] uppercase">
              AI-Powered · Free
            </span>
          </div>

          {/* Heading */}
          <h1
            className="text-[52px] lg:text-[66px] font-bold leading-[1.05] mb-6"
            style={{ fontFamily: "var(--font-feather)", letterSpacing: "-1px" }}
          >
            <span className="text-white">Study smart.</span>
            <br />
            <span className="text-primary">Pass your GED.</span>
          </h1>

          {/* Description */}
          <p className="text-[16px] text-white/55 leading-[1.65] max-w-[420px] mb-10">
            Adaptive AI maps your exact gaps and builds a personalized study plan —
            every minute counts toward your diploma.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-wrap items-center gap-3 mb-9">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-primary text-white font-bold rounded-xl text-[15px] hover:bg-primary-dark active:scale-[0.98] transition-all"
            >
              Start for Free <span aria-hidden>→</span>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/10 border border-white/20 text-white font-bold rounded-xl text-[15px] hover:bg-white/15 active:scale-[0.98] transition-all"
            >
              Sign In
            </Link>
          </div>

          {/* Trust pills */}
          <div className="flex flex-wrap items-center gap-5 text-[13px] text-white/40">
            {["Free forever", "57 topics", "AI plan"].map((label) => (
              <span key={label} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#22c55e] flex-shrink-0" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right — light panel ── */}
      <div className="md:w-1/2 bg-[#EFF6FF] relative flex items-center justify-center min-h-[55vw] md:min-h-0 overflow-hidden pt-16 md:pt-0">
        {/* Floating card — Math Progress */}
        <div className="absolute top-[22%] left-6 md:left-8 bg-white rounded-2xl shadow-xl px-5 py-4 min-w-[190px] z-10">
          <p className="text-[10px] font-bold text-primary uppercase tracking-[0.12em] mb-2.5">
            Math Progress
          </p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
            <div className="bg-primary h-1.5 rounded-full" style={{ width: "75%" }} />
          </div>
          <p className="text-[12px] text-gray-400 font-medium">75% · 14 topics</p>
        </div>

        {/* Floating badge — streak */}
        <div className="absolute top-[22%] right-6 md:right-8 bg-primary text-white rounded-2xl shadow-xl px-5 py-3.5 z-10">
          <p className="text-[11px] text-white/70 mb-1">🔥 7-day streak</p>
          <p className="text-[15px] font-bold">Keep it up!</p>
        </div>

        {/* Floating card — Predicted Score */}
        <div className="absolute top-[45%] left-6 md:left-8 bg-white rounded-2xl shadow-xl px-5 py-4 z-10">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.12em] mb-2">
            Predicted Score
          </p>
          <p className="text-[28px] font-bold text-[#0f2748] leading-none">
            158{" "}
            <span className="text-[14px] font-bold text-[#22c55e]">✓ Pass</span>
          </p>
        </div>

        {/* Mascot — duo (replace with duo.png when available) */}
        <div className="relative z-0 w-full max-w-[440px] px-4">
          <HeroIllustration />
        </div>
      </div>
    </section>
  );
}

/* ─── Stats bar ──────────────────────────────────────────────── */

function StatsSection() {
  const stats = [
    { value: "57", label: "Topics covered" },
    { value: "4", label: "GED subjects" },
    { value: "AI", label: "Adaptive plan" },
    { value: "Free", label: "To start" },
  ];

  return (
    <section className="bg-primary py-10">
      <div className="max-w-[1140px] mx-auto px-6 grid grid-cols-2 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center py-3">
            <p
              className="text-[38px] md:text-[44px] font-bold text-white leading-none mb-1.5"
              style={{ fontFamily: "var(--font-feather)", letterSpacing: "-0.5px" }}
            >
              {s.value}
            </p>
            <p className="text-[12px] text-white/60 font-semibold uppercase tracking-wider">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Feature rows ───────────────────────────────────────────── */

function FeatureRow({
  illustration,
  eyebrow,
  headline,
  body,
  reverse = false,
}: {
  illustration: React.ReactNode;
  eyebrow: string;
  headline: string;
  body: string;
  reverse?: boolean;
}) {
  return (
    <div
      className={`flex flex-col ${
        reverse ? "md:flex-row-reverse" : "md:flex-row"
      } items-center gap-10 md:gap-16`}
    >
      <div className="flex-1 max-w-[400px] w-full mx-auto">{illustration}</div>
      <div className="flex-1 text-center md:text-left">
        <p
          className="text-[13px] font-bold text-primary uppercase mb-3"
          style={{ letterSpacing: "0.15em" }}
        >
          {eyebrow}
        </p>
        <h2
          className="text-[32px] md:text-[44px] font-bold text-foreground leading-[1.2] mb-5"
          style={{ fontFamily: "var(--font-feather)", letterSpacing: "-0.8px" }}
        >
          {headline}
        </h2>
        <p className="text-[16px] text-muted-foreground leading-[1.6] max-w-md mx-auto md:mx-0">
          {body}
        </p>
      </div>
    </div>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="py-20 px-6">
      <div className="max-w-[1140px] mx-auto space-y-24">
        <FeatureRow
          illustration={<AssessmentIllustration />}
          eyebrow="Diagnostic Assessment"
          headline="Know exactly where you stand."
          body="Answer 40 questions across all 4 GED subjects. Our system maps every knowledge gap so your study plan targets only what you actually need."
        />
        <FeatureRow
          reverse
          illustration={<AdaptiveIllustration />}
          eyebrow="Adaptive Learning"
          headline="A plan that grows with you."
          body="Struggling with a topic? Your schedule automatically shifts to give it more attention. Crushing it? We move you forward faster. Every quiz updates your plan in real time."
        />
        <FeatureRow
          illustration={<ProgressIllustration />}
          eyebrow="Progress Tracking"
          headline="See your score climb."
          body="Visual proficiency scores across all 4 subjects, predicted GED score, and a streak-based system that keeps you coming back every day."
        />
      </div>
    </section>
  );
}

/* ─── How it works ───────────────────────────────────────────── */

function HowItWorksSection() {
  const steps = [
    {
      num: "1",
      color: "#1e90e8",
      shadow: "#1670be",
      title: "Take the assessment",
      body: "40 quick questions map your current knowledge across Math, Science, Social Studies, and Language Arts.",
    },
    {
      num: "2",
      color: "#17a673",
      shadow: "#0e7a55",
      title: "Get your AI study plan",
      body: "Our genetic algorithm builds an optimal, personalized schedule based on your gaps and your target exam date.",
    },
    {
      num: "3",
      color: "#ffb020",
      shadow: "#cc8a00",
      title: "Study, quiz, repeat",
      body: "Follow daily sessions, complete quizzes, and watch your plan adapt automatically until you are ready for exam day.",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 px-6 bg-primary-light">
      <div className="max-w-[1140px] mx-auto">
        <div className="text-center mb-14">
          <h2
            className="text-[44px] font-bold text-foreground leading-[1.2]"
            style={{ fontFamily: "var(--font-feather)", letterSpacing: "-0.8px" }}
          >
            How it works
          </h2>
          <p className="text-[16px] text-muted-foreground mt-3">
            Three steps to your GED diploma.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-7">
          {steps.map((s) => (
            <div
              key={s.num}
              className="bg-card rounded-2xl p-8 border border-border text-center shadow-sm"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 text-white text-xl font-bold"
                style={{
                  backgroundColor: s.color,
                  boxShadow: `0 4px 0 ${s.shadow}`,
                  fontFamily: "var(--font-feather)",
                }}
              >
                {s.num}
              </div>
              <h3
                className="text-[18px] font-bold text-foreground mb-2.5"
                style={{ fontFamily: "var(--font-feather)" }}
              >
                {s.title}
              </h3>
              <p className="text-[14px] text-muted-foreground leading-[1.6]">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Subjects ───────────────────────────────────────────────── */

function SubjectBadgesSection() {
  const subjects = [
    {
      name: "Mathematical Reasoning",
      short: "Math",
      topics: 19,
      icon: "📐",
      accent: "#1e90e8",
      bg: "bg-[#EFF6FF]",
      border: "border-[#1e90e8]/20",
    },
    {
      name: "Reasoning Through Language Arts",
      short: "Language Arts",
      topics: 14,
      icon: "📝",
      accent: "#1cb0f6",
      bg: "bg-[#EFF6FF]",
      border: "border-[#1cb0f6]/20",
    },
    {
      name: "Science",
      short: "Science",
      topics: 14,
      icon: "🔬",
      accent: "#17a673",
      bg: "bg-[#f0fdf4]",
      border: "border-[#17a673]/20",
    },
    {
      name: "Social Studies",
      short: "Social Studies",
      topics: 10,
      icon: "🌍",
      accent: "#ffb020",
      bg: "bg-[#fffbeb]",
      border: "border-[#ffb020]/20",
    },
  ];

  return (
    <section id="subjects" className="py-20 px-6">
      <div className="max-w-[1140px] mx-auto text-center">
        <h2
          className="text-[36px] md:text-[44px] font-bold text-foreground leading-[1.2] mb-3"
          style={{ fontFamily: "var(--font-feather)", letterSpacing: "-0.8px" }}
        >
          All 4 GED subjects covered.
        </h2>
        <p className="text-[16px] text-muted-foreground mb-12">
          57 topics. Full coverage. Nothing left out.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {subjects.map((s) => (
            <div
              key={s.name}
              className={`${s.bg} ${s.border} rounded-2xl p-6 border-2 text-left hover:-translate-y-1 transition-all group`}
              style={{ borderColor: `${s.accent}33` }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4"
                style={{ backgroundColor: `${s.accent}18` }}
              >
                {s.icon}
              </div>
              <p className="text-[15px] font-bold text-foreground leading-snug mb-1.5">{s.name}</p>
              <p className="text-[12px] font-semibold" style={{ color: s.accent }}>
                {s.topics} topics
              </p>
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
    <section className="py-24 px-6 bg-primary">
      <div className="max-w-[680px] mx-auto text-center">
        <h2
          className="text-[44px] md:text-[58px] font-bold text-white leading-[1.15] mb-5"
          style={{ fontFamily: "var(--font-feather)", letterSpacing: "-1px" }}
        >
          Ready to pass your GED?
        </h2>
        <p className="text-[16px] text-white/70 mb-9">
          Start free today. No credit card. No commitment. Just results.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 px-10 py-4 text-[15px] font-bold text-primary bg-white rounded-xl shadow-[0_4px_0_rgba(0,0,0,0.15)] hover:shadow-[0_3px_0_rgba(0,0,0,0.15)] hover:-translate-y-[1px] active:translate-y-[2px] transition-all"
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
    <footer className="py-10 px-6 border-t border-border bg-card">
      <div className="max-w-[1140px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <GedLogo size={8} textClass="text-[16px] !text-foreground" />

        <p className="text-[13px] text-muted-foreground">
          &copy; {new Date().getFullYear()} GED Prep. Adaptive learning powered by AI.
        </p>

        <div className="flex items-center gap-6 text-[13px] font-semibold text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Sign In
          </Link>
          <Link href="/register" className="text-primary hover:underline">
            Get Started
          </Link>
        </div>
      </div>
    </footer>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <DuoNavbar />
      <main>
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <HowItWorksSection />
        <SubjectBadgesSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}

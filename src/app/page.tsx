import Link from "next/link";
import HeroIllustration from "@/components/illustrations/HeroIllustration";
import AdaptiveIllustration from "@/components/illustrations/AdaptiveIllustration";
import ProgressIllustration from "@/components/illustrations/ProgressIllustration";
import AssessmentIllustration from "@/components/illustrations/AssessmentIllustration";

/* ─── Reusable primitives ─────────────────────────────────────── */

function DuoNavbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b-2 border-[var(--border)]">
      <div className="max-w-[1140px] mx-auto px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-[var(--primary)] rounded-xl flex items-center justify-center shadow-[0_3px_0_var(--primary-dark)]">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="white" />
            </svg>
          </div>
          <span
            className="text-xl font-bold text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-feather)" }}
          >
            GED Prep
          </span>
        </div>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-6 text-sm font-bold text-[var(--muted-foreground)]" style={{ letterSpacing: "0.053em" }}>
          <a href="#features" className="hover:text-[var(--foreground)] transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-[var(--foreground)] transition-colors">How it works</a>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-5 py-2.5 text-sm font-bold text-[var(--accent)] border-2 border-[var(--border)] rounded-xl hover:border-[var(--accent)] transition-colors btn-duo-secondary"
            style={{ letterSpacing: "0.053em" }}
          >
            SIGN IN
          </Link>
          <Link
            href="/register"
            className="px-5 py-2.5 text-sm font-bold text-white bg-[var(--primary)] rounded-xl shadow-[0_4px_0_var(--primary-dark)] hover:bg-[var(--primary)] transition-colors btn-duo-primary"
            style={{ letterSpacing: "0.053em" }}
          >
            GET STARTED
          </Link>
        </div>
      </div>
    </nav>
  );
}

function DuoPrimaryButton({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white bg-[var(--primary)] rounded-xl shadow-[0_4px_0_var(--primary-dark)] hover:bg-[var(--primary)] hover:shadow-[0_3px_0_var(--primary-dark)] active:shadow-[0_2px_0_var(--primary-dark)] active:translate-y-[2px] transition-all btn-duo-primary ${className}`}
      style={{ letterSpacing: "0.053em" }}
    >
      {children}
    </Link>
  );
}

function DuoOutlineButton({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center px-8 py-4 text-base font-bold text-[var(--accent)] bg-card border-2 border-[var(--border)] rounded-xl shadow-[0_4px_0_var(--border)] hover:border-[var(--accent)] hover:shadow-[0_3px_0_var(--border)] active:translate-y-[2px] transition-all btn-duo-secondary ${className}`}
      style={{ letterSpacing: "0.053em" }}
    >
      {children}
    </Link>
  );
}

/* ─── Sections ───────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section className="pt-28 pb-16 px-6">
      <div className="max-w-[1140px] mx-auto flex flex-col-reverse md:flex-row items-center gap-10 md:gap-16">
        {/* Text side */}
        <div className="flex-1 text-center md:text-left">
          <h1
            className="text-[48px] md:text-[64px] font-bold text-[var(--primary)] leading-[1.2] mb-6"
            style={{
              fontFamily: "var(--font-feather)",
              letterSpacing: "-1.28px",
            }}
          >
            free. fun.
            <br />
            <span className="text-[var(--foreground)]">pass your GED.</span>
          </h1>
          <p
            className="text-[17px] text-[var(--muted-foreground)] leading-[1.4] mb-10 max-w-md mx-auto md:mx-0"
            style={{ letterSpacing: "0.053em" }}
          >
            Our AI uses your strengths and gaps to build a study plan that{" "}
            <span className="text-[var(--accent)] font-bold underline underline-offset-2 cursor-pointer">
              actually works
            </span>
            . No wasted time. No guesswork.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4">
            <DuoPrimaryButton href="/register">GET STARTED FOR FREE</DuoPrimaryButton>
            <DuoOutlineButton href="/login">I ALREADY HAVE AN ACCOUNT</DuoOutlineButton>
          </div>
        </div>

        {/* Illustration side */}
        <div className="flex-1 max-w-[420px] w-full mx-auto">
          <HeroIllustration />
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  const stats = [
    { value: "57", label: "Topics covered" },
    { value: "4", label: "GED subjects" },
    { value: "AI", label: "Adaptive plan" },
    { value: "100%", label: "Free to start" },
  ];

  return (
    <section className="py-10 border-t-2 border-b-2 border-[var(--border)]">
      <div className="max-w-[1140px] mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p
              className="text-[32px] font-bold text-[var(--primary)] leading-[1.2]"
              style={{ fontFamily: "var(--font-feather)", letterSpacing: "-0.5px" }}
            >
              {s.value}
            </p>
            <p
              className="text-[14px] text-[var(--muted-foreground)] font-bold mt-1"
              style={{ letterSpacing: "0.053em" }}
            >
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

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
          className="text-[13px] font-bold text-[var(--primary)] uppercase mb-3"
          style={{ letterSpacing: "0.15em" }}
        >
          {eyebrow}
        </p>
        <h2
          className="text-[32px] md:text-[48px] font-bold text-[var(--foreground)] leading-[1.2] mb-5"
          style={{ fontFamily: "var(--font-feather)", letterSpacing: "-0.96px" }}
        >
          {headline}
        </h2>
        <p
          className="text-[17px] text-[var(--muted-foreground)] leading-[1.5] max-w-md mx-auto md:mx-0"
          style={{ letterSpacing: "0.053em" }}
        >
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

function HowItWorksSection() {
  const steps = [
    {
      num: "1",
      color: "var(--primary)",
      shadow: "var(--primary-dark)",
      title: "Take the assessment",
      body: "40 quick questions map your current knowledge across Math, Science, Social Studies, and Language Arts.",
    },
    {
      num: "2",
      color: "var(--accent)",
      shadow: "var(--accent-dark)",
      title: "Get your AI study plan",
      body: "Our genetic algorithm builds an optimal, personalized schedule based on your gaps and your target exam date.",
    },
    {
      num: "3",
      color: "var(--gold)",
      shadow: "var(--warning)",
      title: "Study, quiz, repeat",
      body: "Follow daily sessions, complete quizzes, and watch your plan adapt automatically until you are ready for exam day.",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 px-6 bg-[var(--primary-light)]">
      <div className="max-w-[1140px] mx-auto">
        <div className="text-center mb-16">
          <h2
            className="text-[48px] font-bold text-[var(--foreground)] leading-[1.2]"
            style={{ fontFamily: "var(--font-feather)", letterSpacing: "-0.96px" }}
          >
            How it works
          </h2>
          <p
            className="text-[17px] text-[var(--muted-foreground)] mt-4"
            style={{ letterSpacing: "0.053em" }}
          >
            Three steps to your GED diploma.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div
              key={s.num}
              className="bg-card rounded-xl p-8 border-2 border-[var(--border)] text-center"
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold"
                style={{
                  backgroundColor: s.color,
                  boxShadow: `0 4px 0 ${s.shadow}`,
                  fontFamily: "var(--font-feather)",
                }}
              >
                {s.num}
              </div>
              <h3
                className="text-[19px] font-bold text-[var(--foreground)] mb-3"
                style={{ fontFamily: "var(--font-feather)" }}
              >
                {s.title}
              </h3>
              <p
                className="text-[15px] text-[var(--muted-foreground)] leading-[1.5]"
                style={{ letterSpacing: "0.053em" }}
              >
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SubjectBadgesSection() {
  const subjects = [
    { name: "Mathematical Reasoning", emoji: "🔢", bg: "var(--primary-light)", text: "var(--primary-dark)" },
    { name: "Reasoning Through Language Arts", emoji: "📝", bg: "var(--primary-light)", text: "var(--accent-dark)" },
    { name: "Science", emoji: "🔬", bg: "var(--primary-light)", text: "var(--accent)" },
    { name: "Social Studies", emoji: "🌍", bg: "var(--muted)", text: "var(--warning)" },
  ];

  return (
    <section className="py-20 px-6">
      <div className="max-w-[1140px] mx-auto text-center">
        <h2
          className="text-[32px] md:text-[48px] font-bold text-[var(--foreground)] leading-[1.2] mb-4"
          style={{ fontFamily: "var(--font-feather)", letterSpacing: "-0.96px" }}
        >
          All 4 GED subjects covered.
        </h2>
        <p
          className="text-[17px] text-[var(--muted-foreground)] mb-12"
          style={{ letterSpacing: "0.053em" }}
        >
          57 topics. Full coverage. Nothing left out.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {subjects.map((s) => (
            <div
              key={s.name}
              className="rounded-xl p-6 border-2 border-[var(--border)] text-left hover:border-[var(--primary)] hover:-translate-y-1 transition-all"
              style={{ backgroundColor: s.bg }}
            >
              <div className="text-3xl mb-4">{s.emoji}</div>
              <p
                className="text-[15px] font-bold"
                style={{ color: s.text, letterSpacing: "0.053em" }}
              >
                {s.name}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="py-24 px-6 bg-[var(--primary)]">
      <div className="max-w-[720px] mx-auto text-center">
        <h2
          className="text-[48px] md:text-[64px] font-bold text-white leading-[1.2] mb-6"
          style={{ fontFamily: "var(--font-feather)", letterSpacing: "-1.28px" }}
        >
          Ready to pass your GED?
        </h2>
        <p
          className="text-[17px] text-white/80 mb-10"
          style={{ letterSpacing: "0.053em" }}
        >
          Start free today. No credit card. No commitment. Just results.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex items-center justify-center px-10 py-4 text-base font-bold text-[var(--primary)] bg-card rounded-xl shadow-[0_4px_0_var(--primary-dark)] hover:shadow-[0_3px_0_var(--primary-dark)] hover:-translate-y-[1px] active:translate-y-[2px] active:shadow-[0_2px_0_var(--primary-dark)] transition-all btn-duo-primary"
            style={{ letterSpacing: "0.053em" }}
          >
            CREATE FREE ACCOUNT
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-10 px-6 border-t-2 border-[var(--border)]">
      <div className="max-w-[1140px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-[var(--primary)] rounded-xl flex items-center justify-center shadow-[0_3px_0_var(--primary-dark)]">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="white" />
            </svg>
          </div>
          <span
            className="text-lg font-bold text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-feather)" }}
          >
            GED Prep
          </span>
        </div>

        <p
          className="text-[13px] text-[var(--muted-foreground)]"
          style={{ letterSpacing: "0.053em" }}
        >
          &copy; {new Date().getFullYear()} GED Prep. Adaptive learning powered by AI.
        </p>

        <div
          className="flex items-center gap-6 text-[14px] font-bold text-[var(--muted-foreground)]"
          style={{ letterSpacing: "0.053em" }}
        >
          <Link href="/login" className="text-[var(--accent)] hover:underline transition-colors">
            Sign In
          </Link>
          <Link href="/register" className="text-[var(--accent)] hover:underline transition-colors">
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
    <div className="min-h-screen bg-card">
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

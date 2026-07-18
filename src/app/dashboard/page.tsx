"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ClipboardList, Calendar, TrendingUp, Play,
  AlertCircle, BookOpen, Info,
} from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import Button from "@/components/ui/Button";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { useAuth } from "@/lib/hooks/useAuth";
import { cn } from "@/lib/utils/cn";
import type { DashboardStats, StudySessionWithSubtopic, SubjectSummary } from "@/types";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

// ─── Subject colors ──────────────────────────────────────────────────────────

const SUBJECT_TAG_CLS: Record<string, string> = {
  MATH: "bg-primary-light text-primary",
  RLA:  "bg-green-100 text-green-700",
  SS:   "bg-orange-100 text-orange-700",
  SCI:  "bg-purple-100 text-purple-700",
};

// Bar-fill colors keyed by subject — keeps every progress bar in the subject's
// own brand color instead of a generic accent, matching the reference design.
const SUBJECT_BAR_COLOR: Record<string, string> = {
  MATH: "var(--primary)",
  RLA:  "#16A34A",
  SCI:  "#7C3AED",
  SS:   "#D97706",
};

// ─── Week helpers ────────────────────────────────────────────────────────────

const MON_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function buildWeekDays(streakDays: number) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dow = todayStart.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + diff);

  return MON_LETTERS.map((letter, i) => {
    const dayDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const daysAgo = Math.round((todayStart.getTime() - dayDate.getTime()) / 86_400_000);
    const isToday = daysAgo === 0;
    const isFuture = daysAgo < 0;
    const studied = !isFuture && daysAgo < streakDays;
    return { letter, isToday, isFuture, studied };
  });
}

// ─── Loading skeleton ────────────────────────────────────────────────────────
// Mirrors the page's actual layout (stat band, greeting, hero card, two-column
// content) so the loading state doesn't flash a jarring blank screen before
// settling into the real content.

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="px-5 py-5 lg:px-6" style={{ borderRight: i < 3 ? "1px solid var(--border)" : undefined }}>
            <SkeletonBlock className="h-2.5 w-16 mb-2" />
            <SkeletonBlock className="h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="px-4 py-5 lg:px-9 lg:py-8">
        <SkeletonBlock className="h-7 w-56 mb-2" />
        <SkeletonBlock className="h-4 w-72 mb-6" />
        <SkeletonBlock className="h-24 w-full mb-6 rounded-2xl" />
        <SkeletonBlock className="h-16 w-full mb-6 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 mb-6">
          <SkeletonBlock className="h-64 w-full rounded-2xl" />
          <SkeletonBlock className="h-64 w-full rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-5">
          <SkeletonBlock className="h-40 w-full rounded-2xl" />
          <SkeletonBlock className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCell({
  label, value, suffix, color, border,
}: { label: string; value: number | null; suffix?: string; color: string; border?: boolean }) {
  return (
    <motion.div
      variants={fadeUp}
      className="px-5 py-5 lg:px-6"
      style={{ borderRight: border ? "1px solid var(--border)" : undefined }}
    >
      <div className="text-[10px] uppercase tracking-[.08em] text-muted-foreground font-semibold mb-1">
        {label}
      </div>
      <div
        className="text-[28px] lg:text-[32px] font-bold leading-none"
        style={{ fontFamily: "var(--font-feather)", color }}
      >
        {value === null ? "—" : <AnimatedNumber value={value} format={(n) => `${n}${suffix ?? ""}`} />}
      </div>
    </motion.div>
  );
}

function SessionRow({ session, last }: { session: StudySessionWithSubtopic; last: boolean }) {
  return (
    <div
      className="flex items-center gap-3.5 py-3 relative"
      style={{ borderBottom: last ? "none" : "1px solid var(--border)" }}
    >
      <div style={{
        width: 12, height: 12, borderRadius: "50%",
        background: "var(--primary)", border: "3px solid var(--card)",
        flexShrink: 0, position: "relative", zIndex: 1,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center gap-1.5 mb-1">
          <span className={cn("px-2 py-0.5 text-xs font-semibold rounded", SUBJECT_TAG_CLS[session.subjectCode] ?? "bg-muted text-foreground")}>
            {session.subjectCode}
          </span>
          <span className="text-xs text-muted-foreground">Lv {session.difficultyLevel}</span>
          <span className="text-xs text-muted-foreground">· {session.durationMins} min</span>
        </div>
        <div className="text-sm font-semibold text-foreground truncate">{session.subtopicName}</div>
      </div>
      <Link href={`/study/${session.id}`} style={{ flexShrink: 0 }}>
        <button
          className="transition-transform duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.08] hover:brightness-110 active:scale-[0.95]"
          style={{
            padding: "8px 16px", background: "var(--primary)", color: "white",
            border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700,
            cursor: "pointer", boxShadow: "0 2px 0 var(--primary-dark)",
          }}>
          Start →
        </button>
      </Link>
    </div>
  );
}

function SubjectBar({ s, last }: { s: SubjectSummary; last: boolean }) {
  const scoreColor = SUBJECT_BAR_COLOR[s.code] ?? "var(--primary)";
  return (
    <div style={{ borderBottom: last ? "none" : "1px solid var(--border)", paddingBottom: last ? 0 : 18, marginBottom: last ? 0 : 18 }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className={cn("px-2 py-0.5 text-xs font-semibold rounded", SUBJECT_TAG_CLS[s.code] ?? "bg-muted text-foreground")}>
          {s.code}
        </span>
        <span className="text-xs font-bold text-foreground">
          {s.attemptedCount === 0 ? "—" : `${s.proficiencyScore}%`}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: "var(--border)" }}>
        <div style={{ width: `${s.proficiencyScore}%`, height: "100%", background: scoreColor, borderRadius: "inherit" }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>Coverage</span>
        <span>{Math.round(s.coveragePercent)}%</span>
      </div>
      <div className="h-[3px] rounded-full overflow-hidden mt-1" style={{ background: "var(--border)" }}>
        <div style={{ width: `${s.coveragePercent}%`, height: "100%", background: "var(--primary)", borderRadius: "inherit" }} />
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Gate the dashboard fetch behind a preferences check so a brand-new
  // account (e.g. fresh Google sign-up, which never set up a study plan)
  // never renders a flash of empty/zeroed dashboard before bouncing to
  // onboarding — it goes straight there instead.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    fetch("/api/user/preferences")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.preferences) {
          router.replace("/onboarding");
          return;
        }
        return fetch("/api/dashboard")
          .then((r) => r.json())
          .then((statsData) => {
            if (cancelled) return;
            if (statsData.error) setError(statsData.error);
            else setStats(statsData);
            setLoading(false);
          });
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load dashboard. Please refresh.");
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [authLoading, router]);

  // ── Derived values ──────────────────────────────────────────────────────────

  const overallProgress  = stats?.overallProgress  ?? 0;
  const daysUntilExam    = stats?.daysUntilExam    ?? 0;
  const todaySessions    = stats?.todaySessions    ?? [];
  const subjectSummaries = stats?.subjectSummaries ?? [];
  const streakDays       = stats?.streakDays       ?? 0;
  const lastUpdate       = stats?.lastPlanUpdate;

  const predictedScore = useMemo(
    () => overallProgress > 0 ? Math.round(145 + (overallProgress / 100) * 20) : null,
    [overallProgress],
  );

  const continueSession = useMemo(
    () => todaySessions.find((s) => s.status === "IN_PROGRESS") ?? todaySessions.find((s) => s.status === "PENDING"),
    [todaySessions],
  );

  const focusAreas = useMemo(
    () => [...subjectSummaries]
      .filter((s) => s.attemptedCount > 0)
      .sort((a, b) => a.proficiencyScore - b.proficiencyScore)
      .slice(0, 3),
    [subjectSummaries],
  );

  const weekDays = useMemo(() => buildWeekDays(streakDays), [streakDays]);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const firstName = user?.name?.split(" ")[0] ?? "there";

  // ── Loading / error states ──────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <MainLayout>
        <DashboardSkeleton />
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[calc(100vh-56px)] px-6">
          <div className="text-center max-w-sm">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="text-foreground font-medium mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Refresh</Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <MainLayout
      userName={user?.name}
      daysUntilExam={daysUntilExam}
      overallProgress={overallProgress}
    >
      {/* ── Stats band ─────────────────────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
        initial="hidden"
        animate="visible"
        transition={{ staggerChildren: 0.06 }}
      >
        <StatCell label="Overall Progress" value={Math.round(overallProgress)} suffix="%" color="var(--primary)" border />
        <StatCell label="Days to Exam"     value={daysUntilExam}               color="#F97316"        border />
        <StatCell label="Today's Sessions" value={todaySessions.length}        color="#22C55E"        border />
        <StatCell label="Predicted Score"  value={predictedScore}              color="#7C3AED" />
      </motion.div>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="px-4 py-5 lg:px-9 lg:py-8">

        {/* Greeting */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1
            className="font-bold text-foreground mb-1"
            style={{ fontFamily: "var(--font-feather)", fontSize: 28 }}
          >
            {greeting}, {firstName}! 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            {dateStr} · Here&apos;s your study plan for today.
          </p>
        </motion.div>

        {/* Plan update notice */}
        {lastUpdate && lastUpdate.reason !== "INITIAL" && (
          <div className="mb-5 flex items-start gap-3 rounded-xl px-5 py-4" style={{ background: "var(--primary-light)", border: "1px solid var(--primary)" }}>
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-primary">Your study plan was updated</p>
              <p className="text-xs text-primary mt-0.5">
                Reason: {lastUpdate.reason.replace(/_/g, " ")} ·{" "}
                {new Date(lastUpdate.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
          </div>
        )}

        {/* ── Continue where you left off ──────────────────────────────────── */}
        {continueSession && (
          <motion.div
            className="mb-6 relative overflow-hidden flex items-center"
            style={{
              background: "linear-gradient(120deg,#030C1A,#1e90e8 55%,#38BDF8)",
              borderRadius: 18, padding: "22px 26px", gap: 20,
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            <div style={{
              position: "absolute", right: -30, bottom: -40,
              width: 180, height: 180, borderRadius: "50%",
              background: "rgba(255,255,255,.06)", pointerEvents: "none",
            }} />
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: "rgba(255,255,255,.16)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Play className="w-6 h-6 text-white" />
            </div>
            <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
              <div style={{
                fontSize: 11, fontWeight: 700,
                color: "rgba(255,255,255,.72)",
                textTransform: "uppercase", letterSpacing: ".08em",
                marginBottom: 5,
              }}>
                {continueSession.status === "IN_PROGRESS" ? "Continue where you left off" : "Next up"}
              </div>
              <div style={{
                fontFamily: "var(--font-feather)", fontSize: 19,
                fontWeight: 700, color: "white", marginBottom: 6,
              }}>
                {continueSession.subtopicName} · {continueSession.subjectName}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", fontWeight: 600 }}>
                {continueSession.durationMins} min session
              </div>
            </div>
            <Link href={`/study/${continueSession.id}`} style={{ position: "relative", zIndex: 1, flexShrink: 0 }}>
              <button
                className="transition-transform duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.08] active:scale-[0.95]"
                style={{
                  padding: "12px 24px", background: "white", color: "var(--primary)",
                  border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700,
                  cursor: "pointer", boxShadow: "0 4px 0 rgba(0,0,0,.14)",
                }}>
                {continueSession.status === "IN_PROGRESS" ? "Resume →" : "Start →"}
              </button>
            </Link>
          </motion.div>
        )}

        {/* ── Overall GED Readiness bar ─────────────────────────────────────── */}
        <motion.div
          className="mb-6 rounded-2xl px-5 py-4"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="flex justify-between mb-2">
            <span className="text-sm font-bold text-foreground">Overall GED Readiness</span>
            <span className="text-sm font-bold" style={{ color: "var(--primary)" }}>
              <AnimatedNumber value={Math.round(overallProgress)} format={(n) => `${n}%`} />
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg,var(--primary),#38BDF8)" }}
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.15 }}
            />
          </div>
        </motion.div>

        {/* ── Sessions + Subject Progress ───────────────────────────────────── */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 mb-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >

          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden" }}>
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <h2 className="text-[15px] font-bold text-foreground">Today&apos;s Study Sessions</h2>
              <span
                className="text-[11px] font-bold px-[9px] py-1 rounded-full"
                style={{ background: "var(--primary-light)", color: "var(--primary)" }}
              >
                {todaySessions.length} sessions
              </span>
            </div>
            <div className="px-5 py-4 relative">
              {todaySessions.length > 0 && (
                <div style={{
                  position: "absolute", left: 28, top: 16, bottom: 16,
                  width: 2, background: "var(--border)",
                }} />
              )}
              {todaySessions.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No sessions for today</p>
                  <Link href="/schedule">
                    <Button variant="secondary" size="sm" className="mt-3">View Schedule</Button>
                  </Link>
                </div>
              ) : (
                todaySessions.map((s, i) => (
                  <SessionRow key={s.id} session={s} last={i === todaySessions.length - 1} />
                ))
              )}
            </div>
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden" }}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="text-[15px] font-bold text-foreground">Subject Progress</h2>
            </div>
            <div className="px-5 py-4">
              {subjectSummaries.map((s, i) => (
                <SubjectBar key={s.code} s={s} last={i === subjectSummaries.length - 1} />
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── This Week + Focus Areas ───────────────────────────────────────── */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-5 mb-7"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >

          <div
            className="rounded-[18px] px-5 py-5"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between mb-[18px]">
              <h2 className="text-[15px] font-bold text-foreground">This Week</h2>
              {streakDays > 0 && (
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(249,115,22,.12)", color: "#F97316" }}
                >
                  🔥 {streakDays}-day streak
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-1">
              {weekDays.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: d.isToday
                      ? "var(--card)"
                      : d.studied
                        ? "var(--primary)"
                        : "var(--border)",
                    border: d.isToday ? "2px solid var(--primary)" : "none",
                    opacity: d.isFuture ? 0.35 : 1,
                  }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: d.isToday ? "var(--primary)" : d.studied ? "white" : "var(--muted-foreground)",
                    }}>
                      {d.letter}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
              {streakDays > 0 ? (
                <>You&apos;ve studied <strong className="text-foreground">{Math.min(streakDays, 7)} day{Math.min(streakDays, 7) !== 1 ? "s" : ""}</strong> in a row this week. Keep going!</>
              ) : (
                "Start studying today to build your streak!"
              )}
            </p>
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden" }}>
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <h2 className="text-[15px] font-bold text-foreground">Focus Areas</h2>
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: "var(--primary-light)", color: "var(--primary)" }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                AI picks
              </span>
            </div>
            <div className="px-5 py-2">
              {focusAreas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-5">
                  Complete some sessions to get personalized AI focus areas.
                </p>
              ) : (
                focusAreas.map((f, i) => (
                  <div
                    key={f.code}
                    className="flex items-center gap-3.5 py-3"
                    style={{ borderBottom: i < focusAreas.length - 1 ? "1px solid var(--border)" : "none" }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className={cn("px-2 py-0.5 text-xs font-semibold rounded", SUBJECT_TAG_CLS[f.code] ?? "bg-muted text-foreground")}>
                          {f.code}
                        </span>
                        <span className="text-[13px] font-semibold text-foreground truncate">{f.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-[5px] rounded-full overflow-hidden" style={{ flex: 1, maxWidth: 160, background: "var(--border)" }}>
                          <div style={{ width: `${f.proficiencyScore}%`, height: "100%", background: SUBJECT_BAR_COLOR[f.code] ?? "var(--primary)", borderRadius: "inherit" }} />
                        </div>
                        <span className="text-[11px] text-muted-foreground font-semibold whitespace-nowrap">
                          {f.proficiencyScore}% mastery
                        </span>
                      </div>
                    </div>
                    <Link href="/progress" style={{ flexShrink: 0 }}>
                      <button
                        className="transition-transform duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.08] active:scale-[0.95]"
                        style={{
                          padding: "7px 14px",
                          background: "var(--primary-light)",
                          color: "var(--primary)",
                          border: "1px solid var(--border)",
                          borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                        }}>
                        Practice
                      </button>
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Quick Actions ──────────────────────────────────────────────────── */}
        <h2
          className="font-bold text-muted-foreground uppercase mb-3"
          style={{ fontSize: 13, letterSpacing: ".08em" }}
        >
          Quick Actions
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/mock-test" className="flex-1">
            <div
              className="flex items-center gap-[11px] rounded-[14px] px-[18px] py-4 cursor-pointer hover:shadow-md hover:scale-[1.03] active:scale-[0.98] transition-[transform,box-shadow] duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: "var(--primary-light)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <ClipboardList className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-foreground">Mock Test</div>
                <div className="text-[11px] text-muted-foreground">Simulate GED exam</div>
              </div>
            </div>
          </Link>
          <Link href="/schedule" className="flex-1">
            <div
              className="flex items-center gap-[11px] rounded-[14px] px-[18px] py-4 cursor-pointer hover:shadow-md hover:scale-[1.03] active:scale-[0.98] transition-[transform,box-shadow] duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-center shrink-0 rounded-[9px] w-8.5 h-8.5 bg-orange-50 dark:bg-orange-500/15">
                <Calendar className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-foreground">Schedule</div>
                <div className="text-[11px] text-muted-foreground">Full study plan</div>
              </div>
            </div>
          </Link>
          <Link href="/progress" className="flex-1">
            <div
              className="flex items-center gap-[11px] rounded-[14px] px-[18px] py-4 cursor-pointer hover:shadow-md hover:scale-[1.03] active:scale-[0.98] transition-[transform,box-shadow] duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-center shrink-0 rounded-[9px] w-8.5 h-8.5 bg-green-50 dark:bg-green-500/15">
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-foreground">My Progress</div>
                <div className="text-[11px] text-muted-foreground">Scores &amp; weak areas</div>
              </div>
            </div>
          </Link>
        </div>

      </div>
    </MainLayout>
  );
}

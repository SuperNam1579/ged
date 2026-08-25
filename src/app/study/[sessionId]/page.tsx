"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft, BookOpen, CheckCircle, ChevronRight, Clock,
  ExternalLink, GraduationCap, Layers, Timer,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import DifficultyDots from "@/components/ui/DifficultyDots";
import { safeUrl } from "@/lib/utils/sanitize";
import { returnLabel, safeReturnTo, withReturnTo } from "@/lib/utils/return-to";
import { StudySessionView } from "@/components/study/StudySessionView";
import { studySection, studyStagger } from "@/components/study/studyMotion";
import { formatDuration } from "@/components/study/types";
import type { StudySessionWithSubtopic } from "@/types";

const SUBJECT_BADGE_VARIANT: Record<string, "info" | "success" | "warning" | "danger" | "default"> = {
  MATH: "info",
  RLA: "success",
  SS: "warning",
  SCI: "default",
};

export default function StudySessionPage() {
  // useSearchParams needs a Suspense boundary during static generation.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <StudySessionPageInner />
    </Suspense>
  );
}

function StudySessionPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const sessionId = params.sessionId as string;

  // Sessions are listed on the schedule, so that is where an unaccompanied
  // visit goes back to.
  const returnTo = safeReturnTo(searchParams.get("from"), "/schedule");
  const backLabel = returnLabel(returnTo);

  const [session, setSession] = useState<StudySessionWithSubtopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [csrfToken, setCsrfToken] = useState("");
  // null until the resource list has loaded, so the manual completion control
  // isn't flashed on screen and then withdrawn once videos turn up.
  const [videoCount, setVideoCount] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/csrf")
      .then((r) => r.json())
      .then((d: { csrfToken?: string }) => setCsrfToken(d.csrfToken ?? ""))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        if (cancelled) return;

        if (res.status === 404) {
          setError("Session not found.");
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setError("Failed to load session details.");
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setSession(data.session);
          setCompleted(data.session.status === "COMPLETED");
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Network error loading session.");
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Wall-clock time on the page. Deliberately separate from watch time: this
  // counts sitting with the material, which is worth showing but is not what
  // the completion gate measures.
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleComplete = async () => {
    if (completing || completed) return;
    setCompleting(true);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ elapsedSeconds: elapsed }),
      });
      if (res.ok || res.status === 409) {
        setCompleted(true);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    } catch {
      // Network error — reflect it in the UI and let the next load reconcile.
      setCompleted(true);
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <p className="mb-4 font-medium text-red-600">
            {error || "Session not found."}
          </p>
          <Link href={returnTo}>
            <Button variant="secondary">Back to {backLabel}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const scheduled = new Date(session.scheduledDate);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
            <Link
              href={returnTo}
              className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={`Back to ${backLabel}`}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <ol className="flex min-w-0 items-center gap-1.5 text-xs">
              <li className="hidden sm:block">
                <Link href={returnTo} className="text-muted-foreground hover:text-foreground">
                  {backLabel}
                </Link>
              </li>
              <ChevronRight className="hidden h-3 w-3 shrink-0 text-muted-foreground sm:block" aria-hidden />
              <li className="hidden text-muted-foreground md:block">{session.subjectName}</li>
              <ChevronRight className="hidden h-3 w-3 shrink-0 text-muted-foreground md:block" aria-hidden />
              <li className="hidden text-muted-foreground md:block">{session.topicName}</li>
              <ChevronRight className="hidden h-3 w-3 shrink-0 text-muted-foreground md:block" aria-hidden />
              <li className="min-w-0 truncate font-semibold text-foreground">
                {session.subtopicName}
              </li>
            </ol>
          </nav>

          <div className="flex shrink-0 items-center gap-2 rounded-full bg-muted px-3 py-1.5">
            <Timer className="h-3.5 w-3.5 text-primary" aria-hidden />
            <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
              {formatDuration(elapsed)}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
        <motion.div
          variants={studyStagger}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          className="flex flex-col gap-6"
        >
          {/* ── Session meta ─────────────────────────────────────────── */}
          <motion.section
            variants={studySection}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge variant={SUBJECT_BADGE_VARIANT[session.subjectCode] ?? "default"}>
                {session.subjectCode}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {scheduled.toLocaleDateString(undefined, {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </span>
              {completed && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                  <CheckCircle className="h-3.5 w-3.5" aria-hidden />
                  Completed
                </span>
              )}
            </div>

            <h1 className="mt-3 text-2xl font-bold text-foreground">{session.subtopicName}</h1>
            {session.subtopicDescription && (
              <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                {session.subtopicDescription}
              </p>
            )}

            <div className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-4">
              <MetaItem icon={<GraduationCap className="h-4 w-4" />} label="Subject">
                {session.subjectName}
              </MetaItem>
              <MetaItem icon={<Layers className="h-4 w-4" />} label="Topic">
                {session.topicName}
              </MetaItem>
              <MetaItem icon={<Clock className="h-4 w-4" />} label="Scheduled for">
                {session.durationMins} min
              </MetaItem>
              <MetaItem icon={<BookOpen className="h-4 w-4" />} label="Difficulty">
                <span className="flex items-center gap-2">
                  <DifficultyDots level={session.difficultyLevel} />
                  <span className="text-xs text-muted-foreground">
                    {session.difficultyLevel}/5
                  </span>
                </span>
              </MetaItem>
            </div>

            {/* Only rendered when there is something to say — an empty
                "Prerequisites: none" row is noise on most subtopics. */}
            {session.prerequisites && session.prerequisites.length > 0 && (
              <div className="mt-4 rounded-xl bg-muted/50 px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Builds on:{" "}
                  <span className="font-semibold text-foreground">
                    {session.prerequisites.join(", ")}
                  </span>
                </p>
              </div>
            )}
          </motion.section>

          {/* ── Player + contents ────────────────────────────────────── */}
          <motion.div variants={studySection}>
            <StudySessionView
              sessionId={sessionId}
              subtopicId={session.subtopicId}
              initialStatus={session.status}
              elapsedSec={elapsed}
              // Forwarded so that finishing the quiz returns to wherever this
              // session was opened from, not to a fixed page.
              returnTo={returnTo}
              onResourcesLoaded={setVideoCount}
              onCompleted={() => setCompleted(true)}
              fallback={
                /* Videos when the subtopic has them, the original external link
                   when it doesn't. Coverage is still partial, so the link is a
                   real fallback rather than dead code. */
                <div className="rounded-2xl border border-border bg-card p-8">
                  <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <BookOpen className="h-4 w-4" />
                    Learning resource
                  </div>
                  <p className="mb-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    No videos are attached to this subtopic yet. Use the resource below to study
                    the material at your own pace, then take the quiz when you feel ready.
                  </p>

                  {session.learningUrl ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <a
                        href={safeUrl(session.learningUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
                      >
                        Open learning resource
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <Button
                        variant="secondary"
                        onClick={handleComplete}
                        loading={completing}
                        disabled={completing || completed || !csrfToken}
                      >
                        <CheckCircle className="mr-1.5 h-4 w-4" />
                        {completed ? "Completed" : "Mark as complete"}
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        No external resource is linked for this subtopic.
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Study from your textbook or notes, then take the quiz when ready.
                      </p>
                    </div>
                  )}
                </div>
              }
            />
          </motion.div>

          {/* The gate owns completion whenever videos exist, so this only shows
              for subtopics with nothing to measure. */}
          {videoCount === 0 && !completed && (
            <motion.div variants={studySection} className="flex justify-end">
              <Link href={withReturnTo(`/quiz/${session.subtopicId}`, returnTo)}>
                <Button>Take the quiz</Button>
              </Link>
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

function MetaItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground">{children}</div>
    </div>
  );
}

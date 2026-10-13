"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle, ArrowLeft, BookOpen, CheckCircle, ChevronRight, Clock,
  CalendarDays, ExternalLink, Layers, Lock, Timer, WifiOff,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { safeUrl } from "@/lib/utils/sanitize";
import { postJson } from "@/lib/csrf-client";
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
  // Why "Mark as complete" didn't go through, shown under the button.
  const [completeError, setCompleteError] = useState("");
  // null until the resource list has loaded, so the manual completion control
  // isn't flashed on screen and then withdrawn once videos turn up.
  const [videoCount, setVideoCount] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Topics this one builds on that the learner hasn't passed a quiz on.
  const [unmet, setUnmet] = useState<{ subtopicId: string; name: string; bestScore: number | null }[]>([]);

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

  const subtopicId = session?.subtopicId;
  const hasPrerequisites = (session?.prerequisites?.length ?? 0) > 0;
  useEffect(() => {
    if (!subtopicId || !hasPrerequisites) return;
    let cancelled = false;
    fetch(`/api/subtopics/${subtopicId}/readiness`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { unmet?: { subtopicId: string; name: string; bestScore: number | null }[] } | null) => {
        if (!cancelled) setUnmet(d?.unmet ?? []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [subtopicId, hasPrerequisites]);

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
    setCompleteError("");

    try {
      await postJson(`/api/sessions/${sessionId}/complete`, { elapsedSeconds: elapsed });
      setCompleted(true);
      if (timerRef.current) clearInterval(timerRef.current);
    } catch (err) {
      // Only the server's answer marks a session done. This used to call
      // setCompleted(true) on a network error too, showing "Completed" and
      // unlocking the quiz for a session that was still PENDING in the database.
      setCompleteError(
        err instanceof TypeError
          ? "Couldn't reach the server. Check your connection and try again."
          : err instanceof Error && err.message !== ""
            ? err.message
            : "Couldn't mark this session complete. Please try again."
      );
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
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
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

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <motion.div
          variants={studyStagger}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          className="flex flex-col gap-6"
        >
          {/* ── Session meta ─────────────────────────────────────────── */}
          <motion.section
            variants={studySection}
            className="rounded-2xl border border-border bg-card px-5 py-4 sm:px-6"
          >
            {/* Kept short so the player is in view without scrolling: the
                title, the part, and one row of facts. */}
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-foreground sm:text-2xl">{session.subtopicName}</h1>
                {/* One part of a subtopic split across several sessions. The units
                    named are what this sitting actually covers. */}
                {session.partIndex ? (
                  <p className="mt-0.5 text-sm font-medium text-primary">
                    Part {session.partIndex}
                    {session.partCount ? ` of ${session.partCount}` : ""}
                    {session.unitNames && session.unitNames.length > 0 && (
                      <span className="font-normal text-muted-foreground"> · {session.unitNames.join(", ")}</span>
                    )}
                  </p>
                ) : null}
                {session.subtopicDescription && (
                  <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{session.subtopicDescription}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant={SUBJECT_BADGE_VARIANT[session.subjectCode] ?? "default"}>
                  {session.subjectName}
                </Badge>
                <MetaChip icon={<Layers className="h-3.5 w-3.5" />}>{session.topicName}</MetaChip>
                <MetaChip icon={<CalendarDays className="h-3.5 w-3.5" />}>
                  {/* English, like the rest of the site — the browser's locale
                      showed Thai Buddhist-era dates here. */}
                  {scheduled.toLocaleDateString("en-US", {
                    weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
                  })}
                </MetaChip>
                <MetaChip icon={<Clock className="h-3.5 w-3.5" />}>{session.durationMins} min</MetaChip>
                {completed && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 font-semibold text-green-700">
                    <CheckCircle className="h-3.5 w-3.5" aria-hidden />
                    Completed
                  </span>
                )}
              </div>
            </div>

            {/* Only rendered when there is something to say — an empty
                "Prerequisites: none" row is noise on most subtopics. A topic it
                builds on that isn't passed yet is a warning, never a lock. */}
            {unmet.length > 0 && !completed ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  {/* One string: in a flex row, separate text pieces lose their spaces. */}
                  {`This builds on ${unmet.length === 1 ? "a topic" : "topics"} you haven't passed yet`}
                </p>
                <ul className="mt-1.5 space-y-1 text-sm text-amber-900">
                  {unmet.map((p) => (
                    <li key={p.subtopicId} className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-amber-700">
                        {p.bestScore === null ? "no quiz yet" : `best ${Math.round(p.bestScore)}%`}
                      </span>
                      <Link
                        href={withReturnTo(`/quiz/${p.subtopicId}`, `/study/${sessionId}`)}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Take its quiz
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-xs text-amber-700">You can still study this now — it may just be harder.</p>
              </div>
            ) : session.prerequisites && session.prerequisites.length > 0 && (
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
          {/* Part 2 waits for part 1: a locked part stays closed and points to
              the part to do first (the server refuses to complete it anyway). */}
          {session.lockedBy && !completed ? (
            <motion.div variants={studySection}>
              <LockedPart lock={session.lockedBy} partIndex={session.partIndex ?? null} returnTo={returnTo} />
            </motion.div>
          ) : (
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
                isLastPart={session.isLastPart ?? true}
                nextPartDate={session.nextPart?.scheduledDate ?? null}
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
                          disabled={completing || completed}
                        >
                          <CheckCircle className="mr-1.5 h-4 w-4" />
                          {completed ? "Completed" : completeError ? "Try again" : "Mark as complete"}
                        </Button>
                        {completeError && (
                          <p role="alert" className="flex w-full items-center gap-2 text-sm text-red-700">
                            <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
                            {completeError}
                          </p>
                        )}
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
          )}

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

/** Shown instead of the player while an earlier part of the subtopic is unfinished. */
function LockedPart({
  lock,
  partIndex,
  returnTo,
}: {
  lock: NonNullable<StudySessionWithSubtopic["lockedBy"]>;
  partIndex: number | null;
  returnTo: string;
}) {
  const earlier = lock.partIndex ? `Part ${lock.partIndex}` : "the earlier part";
  const when = lock.scheduledDate
    ? new Date(`${lock.scheduledDate}T00:00:00Z`).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
      })
    : null;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
      <Lock className="mx-auto h-8 w-8 text-amber-600" aria-hidden />
      <h2 className="mt-3 text-lg font-bold text-amber-900">
        {`Finish ${earlier} of ${lock.subtopicName} first`}
      </h2>
      <p className="mx-auto mt-1.5 max-w-lg text-sm text-amber-800">
        {`${partIndex ? `Part ${partIndex}` : "This part"} builds on ${earlier}, so it opens once that one is done.`}
        {lock.sessionId === null && " That part isn't in your schedule yet — add it from “Not in your plan yet”."}
      </p>
      <div className="mt-5">
        {lock.sessionId ? (
          <Link href={withReturnTo(`/study/${lock.sessionId}`, returnTo)}>
            <Button>{`Go to ${earlier}${when ? ` (${when})` : ""}`}</Button>
          </Link>
        ) : (
          <Link href="/schedule">
            <Button>Open your schedule</Button>
          </Link>
        )}
      </div>
    </div>
  );
}

/** One fact about the session, as a small pill beside the title. */
function MetaChip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground">
      {icon}
      <span className="text-foreground/80">{children}</span>
    </span>
  );
}

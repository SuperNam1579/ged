"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle2, Clock, Lock } from "lucide-react";
import { postJson } from "@/lib/csrf-client";
import { withReturnTo } from "@/lib/utils/return-to";
import { cn } from "@/lib/utils/cn";
import { ProgressRing } from "./ProgressRing";
import { unlockVariants } from "./studyMotion";
import { formatDuration, type CompletionBreakdown, type StudyResource } from "./types";

interface ProgressGateProps {
  sessionId: string;
  subtopicId: string;
  resources: StudyResource[];
  isCompleted: boolean;
  /** Seconds spent on this page, shown alongside the watch figure. */
  elapsedSec: number;
  /** Origin to hand on to the quiz, so its result page can return there. */
  returnTo: string;
  onCompleted: () => void;
}

interface VerifyResponse {
  eligible: boolean;
  reason?: "no_resources" | "insufficient_watch_time";
  status: string;
  resources: CompletionBreakdown[];
}

/**
 * The session footer: how far along the learner is, and the one action that
 * depends on it.
 *
 * The ring and the percentage are a courtesy — they let someone see at a glance
 * how much is left. They are not what decides anything. Pressing the button
 * sends no percentage; it asks the server to recompute eligibility from stored
 * progress. If this component's arithmetic ever disagrees with the server's,
 * the server wins and the disagreement surfaces as a message rather than as a
 * session wrongly marked done.
 */
export function ProgressGate({
  sessionId,
  subtopicId,
  resources,
  isCompleted,
  elapsedSec,
  returnTo,
  onCompleted,
}: ProgressGateProps) {
  const reduceMotion = useReducedMotion();
  const [verifying, setVerifying] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);

  const requiredTotal = resources.reduce((sum, r) => sum + r.requiredSec, 0);
  const watchedTotal = resources.reduce(
    // Credit per resource is capped at that resource's requirement, so
    // over-watching one video cannot pay for skipping another.
    (sum, r) => sum + Math.min(r.watchedSec, r.requiredSec),
    0
  );
  const percent = requiredTotal > 0 ? (watchedTotal / requiredTotal) * 100 : 0;
  const looksReady = requiredTotal > 0 && watchedTotal >= requiredTotal;
  const remaining = Math.max(0, 100 - percent);

  async function verify() {
    setVerifying(true);
    setRejection(null);
    try {
      const result = await postJson<VerifyResponse>(
        `/api/sessions/${sessionId}/verify-completion`,
        {}
      );

      if (result.eligible) {
        onCompleted();
        return;
      }

      const left = result.resources.filter((r) => !r.complete);
      setRejection(
        left.length === 0
          ? "This session can't be completed yet."
          : `Still to watch: ${left
              .map((r) => `${r.title} (${formatDuration(Math.max(0, r.requiredSec - r.watchedSec))} left)`)
              .join(", ")}`
      );
    } catch (err) {
      setRejection(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="sticky bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3.5">
        <div className="flex items-center gap-2.5 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
          <div className="leading-tight">
            <p className="font-mono text-sm font-semibold text-foreground">
              {formatDuration(elapsedSec)}
            </p>
            <p className="text-[11px] text-muted-foreground">on this session</p>
          </div>
        </div>

        <div className="hidden h-8 w-px bg-border sm:block" />

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <ProgressRing value={percent} />
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-semibold text-foreground">
              {Math.round(percent)}% of the required watching done
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {isCompleted
                ? "Session complete — the quiz is unlocked."
                : looksReady
                  ? "Ready to complete this session."
                  : `${Math.round(remaining)}% more to unlock the quiz.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <AnimatePresence mode="wait" initial={false}>
            {isCompleted ? (
              <motion.div
                key="done"
                variants={unlockVariants}
                initial={reduceMotion ? false : "hidden"}
                animate="visible"
                className="flex items-center gap-3"
              >
                <span className="hidden items-center gap-1.5 text-sm font-medium text-success sm:flex">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Complete
                </span>
                <Link
                  href={withReturnTo(`/quiz/${subtopicId}`, returnTo)}
                  className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
                >
                  Take the quiz
                </Link>
              </motion.div>
            ) : (
              <motion.button
                key="gate"
                type="button"
                onClick={verify}
                disabled={!looksReady || verifying}
                variants={unlockVariants}
                initial={reduceMotion ? false : "hidden"}
                animate="visible"
                className={cn(
                  "flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
                  looksReady
                    ? "bg-primary text-white hover:bg-primary-dark"
                    : "cursor-not-allowed bg-muted text-muted-foreground"
                )}
              >
                {!looksReady && <Lock className="h-4 w-4" aria-hidden />}
                {verifying
                  ? "Checking…"
                  : looksReady
                    ? "Complete session"
                    : "Watch 80% to unlock"}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {rejection && (
        <div className="mx-auto max-w-6xl px-6 pb-3">
          <p role="alert" className="text-xs text-danger">
            {rejection}
          </p>
        </div>
      )}
    </div>
  );
}

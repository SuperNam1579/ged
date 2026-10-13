"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, CheckCircle, Info, RotateCcw, XCircle } from "lucide-react";
import { motion } from "motion/react";
import Button from "@/components/ui/Button";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { WEAKNESS_THRESHOLD } from "@/lib/ga/constants";
import { cn } from "@/lib/utils/cn";
import { returnLabel, safeReturnTo, withReturnTo } from "@/lib/utils/return-to";

/** A topic is passed at the line the planner calls weak below (60%). */
const PASS_SCORE = WEAKNESS_THRESHOLD;

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

// Deterministic burst — fixed angles/delays so server and client render
// identically (no Math.random() in render, which would cause a hydration
// mismatch on a "use client" page that's still SSR'd on first load).
const CONFETTI = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  const distance = 70 + (i % 3) * 18;
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    color: ["var(--success)", "var(--primary)", "var(--gold)"][i % 3],
    delay: (i % 5) * 0.03,
  };
});

function ScoreRing({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  const ringColor =
    pct >= 80 ? "var(--success)" : pct >= 60 ? "var(--primary)" : pct >= 40 ? "var(--warning)" : "var(--danger)";

  return (
    <div className="relative w-40 h-40 mx-auto">
      {pct >= 80 && CONFETTI.map((c, i) => (
        <motion.span
          key={i}
          className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full"
          style={{ background: c.color }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: c.x, y: c.y, opacity: 0, scale: 0.4 }}
          transition={{ duration: 0.9, delay: 0.3 + c.delay, ease: "easeOut" }}
        />
      ))}
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="12"
        />
        <motion.circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.15 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold text-foreground">
          <AnimatedNumber value={score} />/{max}
        </span>
        <span className="text-sm text-muted-foreground font-medium">Correct</span>
      </div>
    </div>
  );
}

function getLabel(pct: number): { label: string; color: string } {
  if (pct >= 80) return { label: "Strong", color: "text-green-600" };
  if (pct >= 60) return { label: "Developing", color: "text-primary" };
  if (pct >= 40) return { label: "Needs Work", color: "text-orange-600" };
  return { label: "Weak", color: "text-red-600" };
}

function QuizResultContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const subtopicId = params.subtopicId as string;

  const score = parseInt(searchParams.get("score") ?? "0", 10);
  const max = parseInt(searchParams.get("max") ?? "5", 10);
  // Forwarded from the quiz, which got it from whichever page started this.
  const returnTo = safeReturnTo(searchParams.get("from"), "/dashboard");
  const backLabel = returnLabel(returnTo);

  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const { label, color } = getLabel(pct);
  const passed = pct >= PASS_SCORE;

  // "Review material" opens this topic's first study session in the plan —
  // the start of its material. None (not in the plan) → the button is left out.
  const [reviewHref, setReviewHref] = useState<string | null>(null);
  useEffect(() => {
    if (passed) return;
    fetch("/api/sessions")
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((d: { sessions?: { id: string; subtopicId: string; kind: string; scheduledDate: string; order: number; partIndex?: number | null }[] }) => {
        const first = (d.sessions ?? [])
          .filter((s) => s.subtopicId === subtopicId && s.kind === "STUDY")
          .sort((a, b) => (a.partIndex ?? 0) - (b.partIndex ?? 0) || a.scheduledDate.localeCompare(b.scheduledDate) || a.order - b.order)[0];
        if (first) setReviewHref(withReturnTo(`/study/${first.id}`, returnTo));
      })
      .catch(() => {});
  }, [passed, subtopicId, returnTo]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <motion.div
        className="w-full max-w-lg"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {/* Card */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          {/* Header */}
          <div
            className={cn(
              "px-8 pt-10 pb-6 text-center",
              pct >= 80 ? "bg-green-50" : pct >= 60 ? "bg-primary-light" : "bg-orange-50"
            )}
          >
            <ScoreRing score={score} max={max} />
            <p className="mt-4 text-2xl font-bold text-foreground">
              <AnimatedNumber value={pct} format={(n) => `${n}%`} />
            </p>
            <motion.p
              className={cn("text-base font-semibold mt-1", color)}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 400, damping: 20 }}
            >
              {label}
            </motion.p>
          </div>

          {/* Body */}
          <div className="px-8 py-6">
            {/* Not passed: the plan doesn't change on its own (the planner
                plans once), so the next step is the learner's — go back over
                the material, retake, or add a review to their schedule. */}
            {!passed && (
              <div className="mb-5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-orange-900">
                    <p>
                      <strong>Not passed yet.</strong> You need {PASS_SCORE}% to pass this topic. Go back over the
                      material, then try the quiz again.
                    </p>
                    <p className="mt-1 text-orange-800">
                      Your schedule stays as it is. Want more time on this topic? Add a review session to a day in{" "}
                      <Link href="/schedule" className="font-semibold underline underline-offset-2">your schedule</Link>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Result summary */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">Summary</h3>
              <motion.div
                className="grid grid-cols-3 gap-3"
                initial="hidden"
                animate="visible"
                transition={{ staggerChildren: 0.08, delayChildren: 0.2 }}
              >
                <motion.div variants={fadeUp} className="text-center bg-green-50 rounded-xl py-3">
                  <p className="text-2xl font-bold text-green-700"><AnimatedNumber value={score} /></p>
                  <p className="text-xs text-green-600 font-medium mt-0.5">Correct</p>
                </motion.div>
                <motion.div variants={fadeUp} className="text-center bg-red-50 rounded-xl py-3">
                  <p className="text-2xl font-bold text-red-600"><AnimatedNumber value={max - score} /></p>
                  <p className="text-xs text-red-500 font-medium mt-0.5">Incorrect</p>
                </motion.div>
                <motion.div variants={fadeUp} className="text-center bg-background rounded-xl py-3">
                  <p className="text-2xl font-bold text-foreground"><AnimatedNumber value={pct} format={(n) => `${n}%`} /></p>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">Score</p>
                </motion.div>
              </motion.div>
            </div>

            {/* Question results */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">Questions at a glance</h3>
              <motion.div
                className="flex gap-2 flex-wrap"
                initial="hidden"
                animate="visible"
                transition={{ staggerChildren: 0.04, delayChildren: 0.3 }}
              >
                {Array.from({ length: max }, (_, i) => {
                  const correct = i < score;
                  return (
                    <motion.div
                      key={i}
                      variants={{ hidden: { opacity: 0, scale: 0 }, visible: { opacity: 1, scale: 1 } }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className={cn(
                        "flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold",
                        correct
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-600"
                      )}
                    >
                      {correct ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <XCircle className="w-5 h-5" />
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>

            {/* Feedback */}
            <div className="mb-6 bg-background rounded-xl px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {pct >= 80
                  ? "Excellent work! You have a strong grasp of this topic. Keep it up!"
                  : pct >= 60
                  ? "Good progress! A bit more practice and you'll have this topic mastered."
                  : pct >= 40
                  ? "You're developing your understanding. Focus on reviewing the key concepts."
                  : "This topic needs more attention. Review the learning material and try again."}
              </p>
            </div>

            {/* Actions */}
            {passed ? (
              <div className="flex gap-3">
                <Link href={returnTo} className="flex-1">
                  <Button className="w-full">Back to {backLabel}</Button>
                </Link>
                <Link href={withReturnTo(`/quiz/${subtopicId}`, returnTo)} className="flex-1">
                  <Button variant="secondary" className="w-full">Try Again</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  {reviewHref && (
                    <Link href={reviewHref} className="flex-1">
                      <Button className="w-full">
                        <BookOpen className="w-4 h-4 mr-2" /> Review material
                      </Button>
                    </Link>
                  )}
                  <Link href={withReturnTo(`/quiz/${subtopicId}`, returnTo)} className="flex-1">
                    <Button variant={reviewHref ? "secondary" : "primary"} className="w-full">
                      <RotateCcw className="w-4 h-4 mr-2" /> Retake quiz
                    </Button>
                  </Link>
                </div>
                <Link
                  href={returnTo}
                  className="block text-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Back to {backLabel}
                </Link>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function QuizResultPage() {
  return (
    <Suspense>
      <QuizResultContent />
    </Suspense>
  );
}

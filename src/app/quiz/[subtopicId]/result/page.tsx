"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Info } from "lucide-react";
import { motion } from "motion/react";
import Button from "@/components/ui/Button";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { cn } from "@/lib/utils/cn";

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
  if (pct >= 80) return { label: "Strong", color: "text-green-600 dark:text-green-400" };
  if (pct >= 60) return { label: "Developing", color: "text-primary" };
  if (pct >= 40) return { label: "Needs Work", color: "text-orange-600 dark:text-orange-400" };
  return { label: "Weak", color: "text-red-600 dark:text-red-400" };
}

function QuizResultContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const subtopicId = params.subtopicId as string;

  const score = parseInt(searchParams.get("score") ?? "0", 10);
  const max = parseInt(searchParams.get("max") ?? "5", 10);
  const gaRerun = searchParams.get("gaRerun") === "1";

  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const { label, color } = getLabel(pct);

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
              pct >= 80 ? "bg-green-50 dark:bg-green-500/10" : pct >= 60 ? "bg-primary-light" : "bg-orange-50 dark:bg-orange-500/10"
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
            {/* GA banner */}
            {gaRerun && (
              <div className="mb-5 flex items-start gap-3 bg-primary-light border border-primary rounded-xl px-4 py-3">
                <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-primary">
                  <strong>Your study plan has been updated</strong> based on your performance on this quiz.
                </p>
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
                <motion.div variants={fadeUp} className="text-center bg-green-50 dark:bg-green-500/10 rounded-xl py-3">
                  <p className="text-2xl font-bold text-green-700"><AnimatedNumber value={score} /></p>
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-0.5">Correct</p>
                </motion.div>
                <motion.div variants={fadeUp} className="text-center bg-red-50 dark:bg-red-500/10 rounded-xl py-3">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400"><AnimatedNumber value={max - score} /></p>
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
                          ? "bg-green-100 dark:bg-green-500/15 text-green-700"
                          : "bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400"
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
            <div className="flex gap-3">
              <Link href="/dashboard" className="flex-1">
                <Button variant="secondary" className="w-full">
                  Continue Studying
                </Button>
              </Link>
              <Link href={`/quiz/${subtopicId}`} className="flex-1">
                <Button className="w-full">
                  Try Again
                </Button>
              </Link>
            </div>
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

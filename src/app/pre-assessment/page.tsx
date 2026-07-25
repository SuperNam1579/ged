"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Sparkles, ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { cn } from "@/lib/utils/cn";
import type { QuestionData } from "@/types";

interface Assessment {
  id: string;
  subjectCode: string;
  subjectName: string;
  questions: QuestionData[];
}

interface SubjectResult {
  subjectCode: string;
  subjectName: string;
  rawScore: number;
  maxScore: number;
  score: number;
}

const SUBJECT_COLORS: Record<string, string> = {
  MATH: "bg-primary-light text-primary",
  RLA: "bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400",
  SS: "bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400",
  SCI: "bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400",
};

const SUBJECT_BAR_COLOR: Record<string, string> = {
  MATH: "var(--primary)",
  RLA: "#16A34A",
  SCI: "#7C3AED",
  SS: "#D97706",
};

const OPTION_LABELS = ["A", "B", "C", "D"];

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export default function PreAssessmentPage() {
  const router = useRouter();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Flat list of all questions: { assessmentIndex, questionIndex }
  const [currentAssessmentIdx, setCurrentAssessmentIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);

  // Answers: assessmentId -> { questionId -> optionId }
  const [answers, setAnswers] = useState<
    Record<string, Record<string, string>>
  >({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<SubjectResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    fetch("/api/csrf")
      .then((r) => r.json())
      .then((d: { csrfToken?: string }) => setCsrfToken(d.csrfToken ?? ""))
      .catch(() => {});
  }, []);

  const STORAGE_KEY = "ged-pre-assessment-v1";

  // Restore saved progress on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed.answers) setAnswers(parsed.answers);
      if (typeof parsed.currentAssessmentIdx === "number")
        setCurrentAssessmentIdx(parsed.currentAssessmentIdx);
      if (typeof parsed.currentQuestionIdx === "number")
        setCurrentQuestionIdx(parsed.currentQuestionIdx);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist progress on each answer change
  useEffect(() => {
    if (Object.values(answers).every((q) => Object.keys(q).length === 0)) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ answers, currentAssessmentIdx, currentQuestionIdx })
    );
  }, [answers, currentAssessmentIdx, currentQuestionIdx]);

  useEffect(() => {
    fetch("/api/assessment/pre")
      .then((r) => r.json())
      .then((data) => {
        if (data.assessments) {
          setAssessments(data.assessments);
          setAnswers((prev) => {
            const merged: Record<string, Record<string, string>> = { ...prev };
            data.assessments.forEach((a: Assessment) => {
              if (!merged[a.id]) {
                merged[a.id] = {};
              }
            });
            return merged;
          });
        } else {
          setError("Failed to load assessment questions.");
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load assessment. Please try again.");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-14 h-14 mx-auto mb-4">
            <div className="absolute inset-0 rounded-2xl bg-primary-light flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <div className="absolute -inset-1.5 rounded-2xl border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
          <p className="text-muted-foreground font-medium">Loading your assessment…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-red-600 dark:text-red-400 font-medium mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (analyzing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          className="text-center max-w-sm px-4"
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <div className="relative w-20 h-20 mx-auto mb-6">
            <motion.div
              className="absolute inset-0 rounded-full bg-primary-light flex items-center justify-center"
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="w-8 h-8 text-primary" />
            </motion.div>
            <div className="absolute -inset-2 rounded-full border-4 border-primary/25 border-t-primary animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            Analyzing your performance…
          </h2>
          <p className="text-muted-foreground text-sm">
            Our AI is reviewing your answers and setting up your personalized
            study plan. This will just take a moment.
          </p>
        </motion.div>
      </div>
    );
  }

  if (showResults) {
    const overallRaw = results.reduce((a, r) => a + r.rawScore, 0);
    const overallMax = results.reduce((a, r) => a + r.maxScore, 0);
    const overallPct = overallMax > 0 ? Math.round((overallRaw / overallMax) * 100) : 0;

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
        <motion.div
          className="w-full max-w-lg"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-8 pt-10 pb-6 text-center bg-primary-light">
              <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-7 h-7 text-primary" />
              </div>
              <p className="text-sm font-semibold text-primary mb-1">Your Starting Point</p>
              <p className="text-4xl font-extrabold text-foreground">
                <AnimatedNumber value={overallPct} format={(n) => `${n}%`} />
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {overallRaw} of {overallMax} correct across all subjects
              </p>
            </div>

            {/* Per-subject breakdown */}
            <div className="px-8 py-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">Subject Breakdown</h3>
              <motion.div
                className="space-y-4 mb-6"
                initial="hidden"
                animate="visible"
                transition={{ staggerChildren: 0.08, delayChildren: 0.2 }}
              >
                {results.map((r) => {
                  const pct = r.maxScore > 0 ? Math.round((r.rawScore / r.maxScore) * 100) : 0;
                  return (
                    <motion.div key={r.subjectCode} variants={fadeUp}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={cn("px-2 py-0.5 text-xs font-semibold rounded", SUBJECT_COLORS[r.subjectCode] ?? "bg-muted text-foreground")}>
                          {r.subjectName}
                        </span>
                        <span className="text-xs font-bold text-foreground">
                          <AnimatedNumber value={pct} format={(n) => `${n}%`} /> · {r.rawScore}/{r.maxScore}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: SUBJECT_BAR_COLOR[r.subjectCode] ?? "var(--primary)" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.25 }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>

              <div className="mb-6 bg-background rounded-xl px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  This is just your starting point — your AI study plan is built to close these gaps.
                  Every quiz you take from here sharpens it further.
                </p>
              </div>

              <Button
                size="lg"
                onClick={() => router.push("/dashboard")}
                className="w-full flex items-center justify-center gap-2"
              >
                Continue to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const totalQuestions = assessments.reduce(
    (sum, a) => sum + a.questions.length,
    0,
  );
  const answeredCount = Object.values(answers).reduce(
    (sum, q) => sum + Object.keys(q).length,
    0,
  );

  const currentAssessment = assessments[currentAssessmentIdx];
  if (!currentAssessment) return null;

  const currentQuestion = currentAssessment.questions[currentQuestionIdx];
  if (!currentQuestion) return null;

  const globalQuestionNumber =
    assessments
      .slice(0, currentAssessmentIdx)
      .reduce((sum, a) => sum + a.questions.length, 0) +
    currentQuestionIdx +
    1;

  const handleSelectOption = (optionId: string) => {
    setSelectedOption(optionId);
  };

  const handleNext = async () => {
    if (!selectedOption) return;

    // Record answer
    setAnswers((prev) => ({
      ...prev,
      [currentAssessment.id]: {
        ...prev[currentAssessment.id],
        [currentQuestion.id]: selectedOption,
      },
    }));

    const isLastQuestion =
      currentQuestionIdx === currentAssessment.questions.length - 1;
    const isLastAssessment = currentAssessmentIdx === assessments.length - 1;

    if (isLastQuestion) {
      // Submit this assessment
      const currentAnswers = {
        ...answers[currentAssessment.id],
        [currentQuestion.id]: selectedOption,
      };

      setSubmitting(true);
      try {
        const res = await fetch(`/api/assessment/${currentAssessment.id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({
            responses: Object.entries(currentAnswers).map(
              ([questionId, selectedOption]) => ({
                questionId,
                selectedOption, // ← match API contract
              }),
            ),
          }),
        });
        const data = await res.json().catch(() => null);
        if (data && typeof data.rawScore === "number") {
          setResults((prev) => [
            ...prev,
            {
              subjectCode: currentAssessment.subjectCode,
              subjectName: currentAssessment.subjectName,
              rawScore: data.rawScore,
              maxScore: data.maxScore,
              score: data.score,
            },
          ]);
        }
      } catch {
        // Continue regardless
      }
      setSubmitting(false);

      if (isLastAssessment) {
        // All done
        localStorage.removeItem(STORAGE_KEY);
        setAnalyzing(true);
        setTimeout(() => {
          setAnalyzing(false);
          setShowResults(true);
        }, 2200);
      } else {
        // Move to next assessment
        setCurrentAssessmentIdx((i) => i + 1);
        setCurrentQuestionIdx(0);
        setSelectedOption(null);
      }
    } else {
      setCurrentQuestionIdx((i) => i + 1);
      setSelectedOption(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-foreground">
              Pre-Assessment
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-semibold",
                SUBJECT_COLORS[currentAssessment.subjectCode] ??
                  "bg-muted text-foreground",
              )}
            >
              {currentAssessment.subjectName}
            </span>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="bg-card border-b border-border px-4 sm:px-6 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">
              Question {globalQuestionNumber} of {totalQuestions}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              {Math.round((answeredCount / totalQuestions) * 100)}%
            </span>
          </div>
          <ProgressBar
            value={(globalQuestionNumber / totalQuestions) * 100}
            showPercent={false}
            variant="blue"
            size="sm"
          />
        </div>
      </div>

      {/* Subject tabs */}
      <div className="bg-card border-b border-border px-4 sm:px-6 py-2 overflow-x-auto">
        <div className="max-w-2xl mx-auto flex gap-2">
          {assessments.map((a, i) => (
            <div
              key={a.id}
              className={cn(
                "flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold transition-colors",
                i === currentAssessmentIdx
                  ? cn(SUBJECT_COLORS[a.subjectCode] ?? "bg-primary-light text-primary", "ring-1 ring-inset ring-current/20")
                  : i < currentAssessmentIdx
                    ? "bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {i < currentAssessmentIdx && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}>
                  <Check className="w-3 h-3 shrink-0" />
                </motion.span>
              )}
              {a.subjectCode}
            </div>
          ))}
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 flex items-start justify-center px-4 py-6 sm:px-6 sm:py-10">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentAssessmentIdx}-${currentQuestionIdx}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <div className="bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-8 mb-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-4">
                  Question {currentQuestionIdx + 1} of{" "}
                  {currentAssessment.questions.length}
                </p>
                <p className="text-lg font-medium text-foreground leading-relaxed">
                  {currentQuestion.text}
                </p>
              </div>

              <div
                role="radiogroup"
                aria-label="Answer choices"
                className="space-y-3 mb-8"
              >
                {currentQuestion.options.map((option, i) => (
                  <motion.button
                    key={option.id}
                    role="radio"
                    aria-checked={selectedOption === option.id}
                    aria-label={`Option ${OPTION_LABELS[i]}: ${option.text}`}
                    onClick={() => handleSelectOption(option.id)}
                    whileTap={{ scale: 0.98 }}
                    onKeyDown={(e) => {
                      const total = currentQuestion.options.length;
                      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                        e.preventDefault();
                        handleSelectOption(currentQuestion.options[(i + 1) % total].id);
                      }
                      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                        e.preventDefault();
                        handleSelectOption(currentQuestion.options[(i - 1 + total) % total].id);
                      }
                    }}
                    className={cn(
                      "w-full text-left px-3 py-3 sm:px-5 sm:py-4 rounded-xl border-2 transition-all flex items-center gap-3 sm:gap-4",
                      selectedOption === option.id
                        ? "border-primary bg-primary-light shadow-sm"
                        : "border-border bg-card hover:border-border hover:bg-background",
                    )}
                  >
                    <span
                      className={cn(
                        "shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-sm font-bold",
                        selectedOption === option.id
                          ? "bg-primary text-white"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {OPTION_LABELS[i]}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        selectedOption === option.id
                          ? "text-primary"
                          : "text-foreground",
                      )}
                    >
                      {option.text}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={handleNext}
              disabled={!selectedOption || submitting}
              loading={submitting}
              className="px-8"
            >
              {currentAssessmentIdx === assessments.length - 1 &&
              currentQuestionIdx === currentAssessment.questions.length - 1
                ? "Finish Assessment"
                : "Next Question"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

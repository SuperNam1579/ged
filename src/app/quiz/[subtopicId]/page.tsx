"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, ArrowLeft, WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import { cn } from "@/lib/utils/cn";
import { postJson } from "@/lib/csrf-client";
import { returnLabel, safeReturnTo, withReturnTo } from "@/lib/utils/return-to";
import type { QuestionData } from "@/types";

const OPTION_LABELS = ["A", "B", "C", "D"];

interface QuizData {
  assessmentId: string;
  subjectCode: string;
  subjectName: string;
  subtopicName: string;
  questions: QuestionData[];
}

export default function QuizPage() {
  // useSearchParams needs a Suspense boundary during static generation.
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <QuizPageInner />
    </Suspense>
  );
}

function QuizPageInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  // A quiz can be started from the schedule, from a study session, or from the
  // progress page. Whichever it was travels with the learner to the result
  // screen so that finishing lands them back in the list they were working
  // through, rather than on a fixed page.
  const returnTo = safeReturnTo(searchParams.get("from"), "/dashboard");
  const backLabel = returnLabel(returnTo);
  const subtopicId = params.subtopicId as string;

  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set when submitting fails. The learner stays on the last question with
  // their answer selected, and the button retries.
  const [submitError, setSubmitError] = useState("");

  // The error box and the retry button under it sit below the answer list,
  // which on a short screen is below the fold. Centre the box when it appears,
  // which brings the button with it, so a failed submit can't look like a
  // button that did nothing.
  const submitErrorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (submitError) submitErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [submitError]);

  useEffect(() => {
    fetch(`/api/assessment/quiz/${subtopicId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setQuiz(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load quiz. Please try again.");
        setLoading(false);
      });
  }, [subtopicId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-red-600 font-medium mb-4">{error || "Quiz not found."}</p>
          <Link href={returnTo}>
            <Button variant="secondary">Back to {backLabel}</Button>
          </Link>
        </div>
      </div>
    );
  }

  // An assessment row with no questions would otherwise crash on
  // `currentQuestion.text` below and draw a NaN progress bar.
  if (quiz.questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-foreground font-medium mb-4">This quiz has no questions yet.</p>
          <Link href={returnTo}>
            <Button variant="secondary">Back to {backLabel}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalQuestions = quiz.questions.length;
  const currentQuestion = quiz.questions[currentIdx];
  const isLast = currentIdx === totalQuestions - 1;
  const progressValue = ((currentIdx + 1) / totalQuestions) * 100;

  const handleSelect = (optionId: string) => {
    setSelectedOption(optionId);
  };

  const handleNext = async () => {
    if (!selectedOption || submitting) return;

    const updatedAnswers = { ...answers, [currentQuestion.id]: selectedOption };
    setAnswers(updatedAnswers);

    if (!isLast) {
      setCurrentIdx((i) => i + 1);
      setSelectedOption(null);
      return;
    }

    // Submit quiz
    setSubmitting(true);
    setSubmitError("");
    try {
      const data = await postJson<{
        correctCount: number;
        maxScore: number;
        attemptId: string;
        triggered: { gaRerun?: boolean } | null;
      }>(`/api/assessment/${quiz.assessmentId}/submit`, {
        responses: Object.entries(updatedAnswers).map(([questionId, option]) => ({
          questionId,
          selectedOption: option,
        })),
      });

      router.push(
        withReturnTo(
          `/quiz/${subtopicId}/result?score=${data.correctCount}&max=${data.maxScore}&attemptId=${data.attemptId}&gaRerun=${data.triggered?.gaRerun ? "1" : "0"}`,
          returnTo
        )
      );
    } catch (err) {
      // Stay on the quiz. This used to navigate to the result page anyway —
      // on a dropped connection with `score` set to the number of questions
      // answered, so every failed submission showed a perfect score that was
      // never recorded; on a server error, with 0.
      setSubmitError(
        err instanceof TypeError
          ? "Couldn't reach the server. Check your connection and try again — your answers are still here."
          : err instanceof Error && err.message === "Unauthorized"
            ? "Your session has expired. Please sign in again."
            : "Your quiz couldn't be submitted. Please try again."
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={returnTo}
              aria-label={`Back to ${backLabel}`}
              className="text-muted-foreground hover:text-muted-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <span className="text-base font-semibold text-foreground">Quiz</span>
            </div>
          </div>
          <span className="text-sm text-muted-foreground font-medium">{quiz.subtopicName}</span>
        </div>
      </header>

      {/* Progress */}
      <div className="bg-card border-b border-border px-6 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">Question {currentIdx + 1} of {totalQuestions}</span>
            <span className="text-xs text-primary font-semibold">{Math.round(progressValue)}%</span>
          </div>
          <ProgressBar value={progressValue} showPercent={false} variant="blue" size="sm" />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIdx}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <div className="bg-card rounded-2xl border border-border shadow-sm p-8 mb-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-4">
                  {quiz.subjectCode} · {quiz.subtopicName}
                </p>
                <p className="text-xl font-semibold text-foreground leading-relaxed">
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
                    onClick={() => handleSelect(option.id)}
                    whileTap={{ scale: 0.98 }}
                    onKeyDown={(e) => {
                      const total = currentQuestion.options.length;
                      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                        e.preventDefault();
                        handleSelect(currentQuestion.options[(i + 1) % total].id);
                      }
                      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                        e.preventDefault();
                        handleSelect(currentQuestion.options[(i - 1 + total) % total].id);
                      }
                    }}
                    className={cn(
                      "w-full text-left px-5 py-4 rounded-xl border-2 transition-all flex items-center gap-4",
                      selectedOption === option.id
                        ? "border-primary bg-primary-light shadow-sm"
                        : "border-border bg-card hover:border-border hover:bg-background"
                    )}
                  >
                    <span
                      className={cn(
                        "shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                        selectedOption === option.id
                          ? "bg-primary text-white"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {OPTION_LABELS[i]}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-medium leading-relaxed",
                        selectedOption === option.id ? "text-primary" : "text-foreground"
                      )}
                    >
                      {option.text}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          {submitError && (
            <div
              role="alert"
              ref={submitErrorRef}
              className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>{submitError}</p>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={handleNext}
              disabled={!selectedOption || submitting}
              loading={submitting}
              className="px-8"
            >
              {submitError ? "Try Again" : isLast ? "Submit Quiz" : "Next Question"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

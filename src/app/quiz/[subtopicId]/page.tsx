"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, ArrowLeft } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import { cn } from "@/lib/utils/cn";
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
  const params = useParams();
  const router = useRouter();
  const subtopicId = params.subtopicId as string;

  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    fetch("/api/csrf")
      .then((r) => r.json())
      .then((d: { csrfToken?: string }) => setCsrfToken(d.csrfToken ?? ""))
      .catch(() => {});
  }, []);

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
          <p className="text-red-600 dark:text-red-400 font-medium mb-4">{error || "Quiz not found."}</p>
          <Link href="/dashboard">
            <Button variant="secondary">Back to Dashboard</Button>
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
    if (!selectedOption) return;

    const updatedAnswers = { ...answers, [currentQuestion.id]: selectedOption };
    setAnswers(updatedAnswers);

    if (!isLast) {
      setCurrentIdx((i) => i + 1);
      setSelectedOption(null);
      return;
    }

    // Submit quiz
    setSubmitting(true);
    try {
      const res = await fetch(`/api/assessment/${quiz.assessmentId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({
          responses: Object.entries(updatedAnswers).map(([questionId, selectedOption]) => ({
            questionId,
            selectedOption,
          })),
        }),
      });

      const data = await res.json();
      const score = data.correctCount ?? 0;
      const max = data.maxScore ?? totalQuestions;

      router.push(`/quiz/${subtopicId}/result?score=${score}&max=${max}&attemptId=${data.attemptId ?? ""}&gaRerun=${data.triggered?.gaRerun ? "1" : "0"}`);
    } catch {
      // Even on error, navigate to result page with available data
      const score = Object.values(updatedAnswers).length;
      router.push(`/quiz/${subtopicId}/result?score=${score}&max=${totalQuestions}&attemptId=&gaRerun=0`);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-muted-foreground hover:text-muted-foreground transition-colors">
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

          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={handleNext}
              disabled={!selectedOption || submitting}
              loading={submitting}
              className="px-8"
            >
              {isLast ? "Submit Quiz" : "Next Question"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

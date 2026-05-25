"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import { cn } from "@/lib/utils/cn";
import type { QuestionData } from "@/types";

interface Assessment {
  id: string;
  subjectCode: string;
  subjectName: string;
  questions: QuestionData[];
}

const SUBJECT_COLORS: Record<string, string> = {
  MATH: "bg-blue-100 text-blue-700",
  RLA: "bg-green-100 text-green-700",
  SS: "bg-orange-100 text-orange-700",
  SCI: "bg-purple-100 text-purple-700",
};

const OPTION_LABELS = ["A", "B", "C", "D"];

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading assessment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-red-600 font-medium mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (analyzing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Analyzing your performance...
          </h2>
          <p className="text-gray-500 text-sm">
            Our AI is reviewing your answers and setting up your personalized
            study plan. This will just take a moment.
          </p>
        </div>
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
        await fetch(`/api/assessment/${currentAssessment.id}/submit`, {
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
      } catch {
        // Continue regardless
      }
      setSubmitting(false);

      if (isLastAssessment) {
        // All done
        localStorage.removeItem(STORAGE_KEY);
        setAnalyzing(true);
        setTimeout(() => {
          router.push("/dashboard");
        }, 2500);
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">
              Pre-Assessment
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-semibold",
                SUBJECT_COLORS[currentAssessment.subjectCode] ??
                  "bg-gray-100 text-gray-700",
              )}
            >
              {currentAssessment.subjectName}
            </span>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">
              Question {globalQuestionNumber} of {totalQuestions}
            </span>
            <span className="text-xs text-gray-500 font-medium">
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
      <div className="bg-white border-b border-gray-100 px-6 py-2">
        <div className="max-w-2xl mx-auto flex gap-2">
          {assessments.map((a, i) => (
            <div
              key={a.id}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium",
                i === currentAssessmentIdx
                  ? (SUBJECT_COLORS[a.subjectCode] ??
                      "bg-blue-100 text-blue-700")
                  : i < currentAssessmentIdx
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-400",
              )}
            >
              {i < currentAssessmentIdx ? "✓ " : ""}
              {a.subjectCode}
            </div>
          ))}
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-4">
              Question {currentQuestionIdx + 1} of{" "}
              {currentAssessment.questions.length}
            </p>
            <p className="text-lg font-medium text-gray-900 leading-relaxed">
              {currentQuestion.text}
            </p>
          </div>

          <div
            role="radiogroup"
            aria-label="Answer choices"
            className="space-y-3 mb-8"
          >
            {currentQuestion.options.map((option, i) => (
              <button
                key={option.id}
                role="radio"
                aria-checked={selectedOption === option.id}
                aria-label={`Option ${OPTION_LABELS[i]}: ${option.text}`}
                onClick={() => handleSelectOption(option.id)}
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
                  "w-full text-left px-5 py-4 rounded-xl border-2 transition-all flex items-center gap-4",
                  selectedOption === option.id
                    ? "border-blue-500 bg-blue-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
                )}
              >
                <span
                  className={cn(
                    "shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                    selectedOption === option.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600",
                  )}
                >
                  {OPTION_LABELS[i]}
                </span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    selectedOption === option.id
                      ? "text-blue-900"
                      : "text-gray-700",
                  )}
                >
                  {option.text}
                </span>
              </button>
            ))}
          </div>

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

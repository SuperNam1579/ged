"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Info } from "lucide-react";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

function ScoreRing({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  const ringColor =
    pct >= 80 ? "#22c55e" : pct >= 60 ? "#3b82f6" : pct >= 40 ? "#f97316" : "#ef4444";

  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth="12"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold text-gray-900">{score}/{max}</span>
        <span className="text-sm text-gray-500 font-medium">Correct</span>
      </div>
    </div>
  );
}

function getLabel(pct: number): { label: string; color: string } {
  if (pct >= 80) return { label: "Strong", color: "text-green-600" };
  if (pct >= 60) return { label: "Developing", color: "text-blue-600" };
  if (pct >= 40) return { label: "Needs Work", color: "text-orange-600" };
  return { label: "Weak", color: "text-red-600" };
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div
            className={cn(
              "px-8 pt-10 pb-6 text-center",
              pct >= 80 ? "bg-green-50" : pct >= 60 ? "bg-blue-50" : "bg-orange-50"
            )}
          >
            <ScoreRing score={score} max={max} />
            <p className="mt-4 text-2xl font-bold text-gray-900">{pct}%</p>
            <p className={cn("text-base font-semibold mt-1", color)}>{label}</p>
          </div>

          {/* Body */}
          <div className="px-8 py-6">
            {/* GA banner */}
            {gaRerun && (
              <div className="mb-5 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">
                  <strong>Your study plan has been updated</strong> based on your performance on this quiz.
                </p>
              </div>
            )}

            {/* Result summary */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Summary</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center bg-green-50 rounded-xl py-3">
                  <p className="text-2xl font-bold text-green-700">{score}</p>
                  <p className="text-xs text-green-600 font-medium mt-0.5">Correct</p>
                </div>
                <div className="text-center bg-red-50 rounded-xl py-3">
                  <p className="text-2xl font-bold text-red-600">{max - score}</p>
                  <p className="text-xs text-red-500 font-medium mt-0.5">Incorrect</p>
                </div>
                <div className="text-center bg-gray-50 rounded-xl py-3">
                  <p className="text-2xl font-bold text-gray-900">{pct}%</p>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">Score</p>
                </div>
              </div>
            </div>

            {/* Question results */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Questions at a glance</h3>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: max }, (_, i) => {
                  const correct = i < score;
                  return (
                    <div
                      key={i}
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
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Feedback */}
            <div className="mb-6 bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-sm text-gray-600">
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
      </div>
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

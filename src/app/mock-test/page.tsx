"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, CheckSquare, Square, Clock, AlertCircle } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useAuth } from "@/lib/hooks/useAuth";

const SUBJECTS = [
  {
    code: "MATH",
    name: "Mathematical Reasoning",
    description: "Number operations, algebra, functions, geometry, and data analysis",
    duration: 30,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
  },
  {
    code: "RLA",
    name: "Reasoning Through Language Arts",
    description: "Reading comprehension, writing, and language conventions",
    duration: 30,
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
  },
  {
    code: "SS",
    name: "Social Studies",
    description: "Civics, US history, economics, and geography",
    duration: 30,
    color: "text-orange-600",
    bg: "bg-orange-50 border-orange-200",
  },
  {
    code: "SCI",
    name: "Science",
    description: "Life science, physical science, and earth & space science",
    duration: 30,
    color: "text-purple-600",
    bg: "bg-purple-50 border-purple-200",
  },
];

export default function MockTestPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(["MATH", "RLA", "SS", "SCI"]);
  const [starting, setStarting] = useState(false);

  const toggleSubject = (code: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const totalTime = selectedSubjects.length * 30;

  const handleStart = async () => {
    if (selectedSubjects.length === 0) return;
    setStarting(true);
    router.push(`/mock-test/session?subjects=${selectedSubjects.join(",")}`);
  };

  return (
    <MainLayout userName={user?.name}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Mock GED Test</h1>
          </div>
          <p className="text-gray-600 leading-relaxed">
            Simulate the real GED exam experience. Select which subjects to include, then answer
            10 questions per subject under timed conditions. Your results will update your proficiency
            scores and may trigger plan adjustments.
          </p>
        </div>

        {/* Info bar */}
        <div className="flex items-center gap-6 p-4 bg-blue-50 border border-blue-100 rounded-xl mb-8">
          <div className="text-center">
            <p className="text-xl font-bold text-blue-900">{selectedSubjects.length * 10}</p>
            <p className="text-xs text-blue-600">Questions</p>
          </div>
          <div className="w-px h-8 bg-blue-200" />
          <div className="text-center">
            <p className="text-xl font-bold text-blue-900">{totalTime}</p>
            <p className="text-xs text-blue-600">Minutes</p>
          </div>
          <div className="w-px h-8 bg-blue-200" />
          <div className="text-center">
            <p className="text-xl font-bold text-blue-900">145</p>
            <p className="text-xs text-blue-600">Passing Score</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-blue-600">
            <Clock className="w-3.5 h-3.5" />
            ~{totalTime} min total
          </div>
        </div>

        {/* Subject selection */}
        <h2 className="font-semibold text-gray-900 mb-4">Select subjects to include</h2>
        <div className="space-y-3 mb-8">
          {SUBJECTS.map((subject) => {
            const isSelected = selectedSubjects.includes(subject.code);
            return (
              <button
                key={subject.code}
                onClick={() => toggleSubject(subject.code)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                  isSelected ? subject.bg + " border-current" : "bg-white border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="shrink-0">
                  {isSelected ? (
                    <CheckSquare className={`w-5 h-5 ${subject.color}`} />
                  ) : (
                    <Square className="w-5 h-5 text-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${isSelected ? "text-gray-900" : "text-gray-700"}`}>
                    {subject.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{subject.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-gray-400">10 questions</p>
                  <p className="text-xs text-gray-400">{subject.duration} min</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Warning */}
        {selectedSubjects.length === 0 && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-6">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-700">Select at least one subject to continue.</p>
          </div>
        )}

        {/* Start button */}
        <Card>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800">Ready to begin?</p>
              <p className="text-sm text-gray-500">
                {selectedSubjects.length} subject{selectedSubjects.length !== 1 ? "s" : ""} · {selectedSubjects.length * 10} questions · ~{totalTime} min
              </p>
            </div>
            <Button
              onClick={handleStart}
              loading={starting}
              disabled={selectedSubjects.length === 0}
              size="lg"
            >
              Start Mock Test
            </Button>
          </CardBody>
        </Card>
      </div>
    </MainLayout>
  );
}

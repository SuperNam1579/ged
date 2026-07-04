"use client";

import { useState, useMemo } from "react";
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
    color: "text-primary",
    bg: "bg-primary-light border-primary",
  },
  {
    code: "RLA",
    name: "Reasoning Through Language Arts",
    description: "Reading comprehension, writing, and language conventions",
    duration: 30,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30",
  },
  {
    code: "SS",
    name: "Social Studies",
    description: "Civics, US history, economics, and geography",
    duration: 30,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30",
  },
  {
    code: "SCI",
    name: "Science",
    description: "Life science, physical science, and earth & space science",
    duration: 30,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30",
  },
];

export default function MockTestPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  // null = user hasn't changed the default yet → treat as "all available".
  const [selectedOverride, setSelectedOverride] = useState<string[] | null>(null);
  const [starting, setStarting] = useState(false);

  // Only offer the subjects the user chose in onboarding (fall back to all four
  // for legacy accounts that never saved a selection).
  const chosenCodes = useMemo(() => {
    const raw = (user?.preferences as { selectedSubjectCodes?: string[] } | null)?.selectedSubjectCodes;
    return raw && raw.length > 0 ? raw : null;
  }, [user]);

  const availableSubjects = useMemo(
    () => (chosenCodes ? SUBJECTS.filter((s) => chosenCodes.includes(s.code)) : SUBJECTS),
    [chosenCodes]
  );

  // Effective selection defaults to every available subject until the user
  // deselects one — derived during render, so no effect/setState churn.
  const selectedSubjects = selectedOverride ?? availableSubjects.map((s) => s.code);

  const toggleSubject = (code: string) => {
    setSelectedOverride((prev) => {
      const base = prev ?? availableSubjects.map((s) => s.code);
      return base.includes(code) ? base.filter((c) => c !== code) : [...base, code];
    });
  };

  const totalTime = selectedSubjects.length * 30;

  const handleStart = async () => {
    if (selectedSubjects.length === 0) return;
    setStarting(true);
    router.push(`/mock-test/session?subjects=${selectedSubjects.join(",")}`);
  };

  // Wait for the user (and their subject selection) to load before rendering,
  // so we don't briefly show all four subjects and then narrow to the chosen ones.
  if (authLoading) {
    return (
      <MainLayout userName={user?.name}>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout userName={user?.name}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Mock GED Test</h1>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Simulate the real GED exam experience. Select which subjects to include, then answer
            10 questions per subject under timed conditions. Your results will update your proficiency
            scores and may trigger plan adjustments.
          </p>
        </div>

        {/* Info bar */}
        <div className="flex items-center gap-6 p-4 bg-primary-light border border-primary rounded-xl mb-8">
          <div className="text-center">
            <p className="text-xl font-bold text-primary">{selectedSubjects.length * 10}</p>
            <p className="text-xs text-primary">Questions</p>
          </div>
          <div className="w-px h-8 bg-primary-light" />
          <div className="text-center">
            <p className="text-xl font-bold text-primary">{totalTime}</p>
            <p className="text-xs text-primary">Minutes</p>
          </div>
          <div className="w-px h-8 bg-primary-light" />
          <div className="text-center">
            <p className="text-xl font-bold text-primary">145</p>
            <p className="text-xs text-primary">Passing Score</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-primary">
            <Clock className="w-3.5 h-3.5" />
            ~{totalTime} min total
          </div>
        </div>

        {/* Subject selection */}
        <h2 className="font-semibold text-foreground mb-4">Select subjects to include</h2>
        <div className="space-y-3 mb-8">
          {availableSubjects.map((subject) => {
            const isSelected = selectedSubjects.includes(subject.code);
            return (
              <button
                key={subject.code}
                onClick={() => toggleSubject(subject.code)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                  isSelected ? subject.bg + " border-current" : "bg-card border-border hover:border-border"
                }`}
              >
                <div className="shrink-0">
                  {isSelected ? (
                    <CheckSquare className={`w-5 h-5 ${subject.color}`} />
                  ) : (
                    <Square className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${isSelected ? "text-foreground" : "text-foreground"}`}>
                    {subject.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{subject.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-muted-foreground">10 questions</p>
                  <p className="text-xs text-muted-foreground">{subject.duration} min</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Warning */}
        {selectedSubjects.length === 0 && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg mb-6">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-400">Select at least one subject to continue.</p>
          </div>
        )}

        {/* Start button */}
        <Card>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">Ready to begin?</p>
              <p className="text-sm text-muted-foreground">
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

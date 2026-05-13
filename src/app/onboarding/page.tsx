"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Target, Calendar, Clock, CheckCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import { cn } from "@/lib/utils/cn";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const GOALS = [
  {
    value: "PASS",
    score: 145,
    label: "Pass the GED",
    description: "Minimum passing score. Get your GED diploma and open new opportunities.",
    color: "border-green-500 bg-green-50",
    badge: "bg-green-100 text-green-700",
  },
  {
    value: "COLLEGE_READY",
    score: 165,
    label: "College Ready",
    description: "Demonstrate college readiness to skip remedial courses.",
    color: "border-blue-500 bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
  },
  {
    value: "COLLEGE_READY_CREDIT",
    score: 175,
    label: "College Credit",
    description: "Score high enough to earn college credit for completed courses.",
    color: "border-purple-500 bg-purple-50",
    badge: "bg-purple-100 text-purple-700",
  },
];

interface OnboardingData {
  studyGoal: string;
  targetScore: number;
  examDate: string;
  hoursPerDay: number;
  availability: Record<string, boolean>;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [data, setData] = useState<OnboardingData>({
    studyGoal: "",
    targetScore: 145,
    examDate: "",
    hoursPerDay: 2,
    availability: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    },
  });

  const totalSteps = 4;
  const progressValue = (step / totalSteps) * 100;

  const canProceed = () => {
    if (step === 1) return data.studyGoal !== "";
    if (step === 2) return data.examDate !== "";
    if (step === 3) return Object.values(data.availability).some(Boolean);
    return true;
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const toggleDay = (key: string) => {
    setData((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        [key]: !prev.availability[key],
      },
    }));
  };

  const handleFinish = async () => {
    setError("");
    setLoading(true);

    try {
      const prefRes = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyGoal: data.studyGoal,
          targetScore: data.targetScore,
          targetExamDate: data.examDate,
          hoursPerDay: data.hoursPerDay,
          availability: data.availability,
        }),
      });

      if (!prefRes.ok) {
        const d = await prefRes.json();
        throw new Error(d.error ?? "Failed to save preferences");
      }

      const gaRes = await fetch("/api/ga/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggerReason: "INITIAL" }),
      });

      if (!gaRes.ok) {
        const d = await gaRes.json();
        throw new Error(d.error ?? "Failed to generate study plan");
      }

      router.push("/pre-assessment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const selectedGoal = GOALS.find((g) => g.value === data.studyGoal);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">GED Prep</span>
        </div>
      </header>

      {/* Progress */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">Step {step} of {totalSteps}</span>
            <span className="text-xs text-gray-500 font-medium">{Math.round(progressValue)}% complete</span>
          </div>
          <ProgressBar value={progressValue} showPercent={false} variant="blue" size="sm" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          {/* Step 1: Goal */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-6 h-6 text-blue-600" />
                <span className="text-sm font-medium text-blue-600 uppercase tracking-wide">Step 1</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">What's your target score?</h1>
              <p className="text-gray-500 mb-8">Choose the score level you want to achieve. You can always adjust this later.</p>

              <div className="space-y-4">
                {GOALS.map((goal) => (
                  <button
                    key={goal.value}
                    onClick={() => setData((prev) => ({ ...prev, studyGoal: goal.value, targetScore: goal.score }))}
                    className={cn(
                      "w-full text-left p-5 rounded-xl border-2 transition-all",
                      data.studyGoal === goal.value
                        ? goal.color
                        : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base font-semibold text-gray-900">{goal.label}</span>
                      <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full", goal.badge)}>
                        {goal.score}+ score
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{goal.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Exam Date & Hours */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-6 h-6 text-blue-600" />
                <span className="text-sm font-medium text-blue-600 uppercase tracking-wide">Step 2</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">When is your exam?</h1>
              <p className="text-gray-500 mb-8">We'll use this to create a realistic study schedule that fits your timeline.</p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Target exam date
                  </label>
                  <input
                    type="date"
                    value={data.examDate}
                    min={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                    onChange={(e) => setData((prev) => ({ ...prev, examDate: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Hours available to study per day
                    <span className="ml-2 text-blue-600 font-bold">{data.hoursPerDay}h</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={8}
                    step={0.5}
                    value={data.hoursPerDay}
                    onChange={(e) => setData((prev) => ({ ...prev, hoursPerDay: parseFloat(e.target.value) }))}
                    className="w-full accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>1 hour</span>
                    <span>8 hours</span>
                  </div>
                  <div className="mt-3 bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-700">
                    <Clock className="inline w-4 h-4 mr-1.5 -mt-0.5" />
                    {data.hoursPerDay} hour{data.hoursPerDay !== 1 ? "s" : ""} per study day — your plan will be optimized to fit this schedule.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Study Days */}
          {step === 3 && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-6 h-6 text-blue-600" />
                <span className="text-sm font-medium text-blue-600 uppercase tracking-wide">Step 3</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Which days can you study?</h1>
              <p className="text-gray-500 mb-8">Select all the days you're typically available to study each week.</p>

              <div className="grid grid-cols-7 gap-2">
                {DAYS.map((day, i) => {
                  const key = DAY_KEYS[i];
                  const active = data.availability[key];
                  return (
                    <button
                      key={key}
                      onClick={() => toggleDay(key)}
                      className={cn(
                        "py-4 rounded-xl text-sm font-semibold transition-all border-2",
                        active
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <p className="mt-4 text-sm text-gray-500">
                {Object.values(data.availability).filter(Boolean).length} day
                {Object.values(data.availability).filter(Boolean).length !== 1 ? "s" : ""} selected per week
              </p>
            </div>
          )}

          {/* Step 4: Summary */}
          {step === 4 && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <span className="text-sm font-medium text-green-600 uppercase tracking-wide">Step 4</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">All set! Let's build your study plan</h1>
              <p className="text-gray-500 mb-8">Here's a summary of your study preferences. Our AI will use these to generate your personalized plan.</p>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mb-8">
                <div className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Study Goal</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedGoal?.label}</p>
                  </div>
                  <span className="text-sm font-bold text-blue-600">{data.targetScore}+ score</span>
                </div>
                <div className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Exam Date</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {data.examDate ? new Date(data.examDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Not set"}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-blue-600">
                    {data.examDate ? Math.ceil((new Date(data.examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0} days away
                  </span>
                </div>
                <div className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Daily Study Time</p>
                    <p className="text-sm font-semibold text-gray-900">{data.hoursPerDay} hour{data.hoursPerDay !== 1 ? "s" : ""} per day</p>
                  </div>
                </div>
                <div className="px-5 py-4">
                  <p className="text-xs text-gray-500 mb-2">Study Days</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS.map((day, i) => {
                      const key = DAY_KEYS[i];
                      const active = data.availability[key];
                      return (
                        <span
                          key={key}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-xs font-medium",
                            active ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400 line-through"
                          )}
                        >
                          {day}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <Button
                size="lg"
                onClick={handleFinish}
                loading={loading}
                className="w-full"
              >
                Generate My Study Plan
              </Button>
              <p className="mt-3 text-center text-xs text-gray-400">
                This will take a few seconds while our AI builds your personalized plan.
              </p>
            </div>
          )}

          {/* Navigation */}
          {step < 4 && (
            <div className="flex items-center justify-between mt-10">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={step === 1}
                className={step === 1 ? "invisible" : ""}
              >
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
              >
                Continue
              </Button>
            </div>
          )}
          {step === 4 && (
            <div className="mt-4">
              <button
                onClick={handleBack}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← Go back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, Check, Sparkles, ArrowRight,
  Calculator, BookText, FlaskConical, Landmark,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Button from "@/components/ui/Button";
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
  RLA: "bg-green-100 text-green-700",
  SS: "bg-orange-100 text-orange-700",
  SCI: "bg-purple-100 text-purple-700",
};

const SUBJECT_BAR_COLOR: Record<string, string> = {
  MATH: "var(--primary)",
  RLA: "#16A34A",
  SCI: "#7C3AED",
  SS: "#D97706",
};

// Paired with SUBJECT_BAR_COLOR for the one primary Button that gets themed
// (the section-intro "Start" button). Button's own classes read the raw
// `--primary`/`--primary-dark` variables for both its fill and its drop
// shadow, so overriding only `background` inline leaves a blue-tinted shadow
// under a green or purple button. Setting both variables together keeps the
// shadow in the same family as the fill. Values are the Tailwind 600/700 step
// of each hue, matching the base colors above.
const SUBJECT_BUTTON_VARS: Record<string, React.CSSProperties> = {
  MATH: {} as React.CSSProperties, // default --primary/--primary-dark already match
  RLA: { "--primary": "#16A34A", "--primary-dark": "#15803D" } as React.CSSProperties,
  SCI: { "--primary": "#7C3AED", "--primary-dark": "#6D28D9" } as React.CSSProperties,
  SS: { "--primary": "#D97706", "--primary-dark": "#B45309" } as React.CSSProperties,
};

// One glyph per subject so a learner can recognise the section at a glance
// without reading the label — the shape becomes the memory hook over a 4-part
// assessment the same way it does on the dashboard's subject cards.
const SUBJECT_ICONS: Record<string, typeof BookOpen> = {
  MATH: Calculator,
  RLA: BookText,
  SCI: FlaskConical,
  SS: Landmark,
};

const OPTION_LABELS = ["A", "B", "C", "D"];
const STORAGE_KEY = "ged-pre-assessment-v1";

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

interface SavedProgress {
  answers: Record<string, Record<string, string>>;
  currentAssessmentIdx: number;
  currentQuestionIdx: number;
}

/**
 * Reads whatever progress was saved from a previous visit, once, before the
 * first paint — the initial state a `useState` lazy initializer computes
 * rather than something an effect corrects after the fact.
 *
 * `window` is absent during the server render Next.js still performs for a
 * "use client" page, so the guard isn't optional: without it this throws
 * during that pass instead of just returning null.
 */
function loadSavedProgress(): SavedProgress | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved) as SavedProgress;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * Icon-and-line stepper across the top of the assessment: one node per
 * subject, connected by a track that fills in as sections are finished.
 *
 * Shown on both the section-intro screen and the question screen so the
 * learner's position — which subject, how many are left — reads the same way
 * in both places rather than only existing on one of them.
 */
function SubjectStepper({
  assessments,
  currentIdx,
  size = "compact",
}: {
  assessments: Assessment[];
  currentIdx: number;
  /**
   * "compact" for the question screen, where the stepper is orientation the
   * learner glances at between questions; "full" for the section-intro screen,
   * where it is the main thing on the page and can afford the room.
   */
  size?: "compact" | "full";
}) {
  const full = size === "full";

  return (
    <div className="flex items-center">
      {assessments.map((a, i) => {
        const Icon = SUBJECT_ICONS[a.subjectCode] ?? BookOpen;
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        const color = SUBJECT_BAR_COLOR[a.subjectCode] ?? "var(--primary)";

        return (
          <div key={a.id} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: isCurrent ? 1.1 : 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-full transition-colors",
                  full ? "h-10 w-10" : "h-7 w-7",
                  !isDone && !isCurrent && "bg-muted text-muted-foreground"
                )}
                style={
                  isDone
                    ? { background: "#16A34A", color: "white" }
                    : isCurrent
                      ? { background: color, color: "white", boxShadow: `0 0 0 3px var(--card), 0 0 0 5px ${color}` }
                      : undefined
                }
              >
                {isDone ? (
                  <Check className={full ? "h-4 w-4" : "h-3.5 w-3.5"} />
                ) : (
                  <Icon className={full ? "h-4 w-4" : "h-3.5 w-3.5"} />
                )}
              </motion.div>

              {/* The label sits beside the icon rather than under it: stacked,
                  it forced the whole band taller and left the code floating
                  under a circle it wasn't visually attached to. Only the
                  current subject is labelled on the compact stepper — the rest
                  are identifiable by their icon and would otherwise crowd the
                  row on a four-subject assessment at phone width. */}
              {(full || isCurrent) && (
                <span
                  className={cn(
                    "text-[11px] font-bold uppercase tracking-wide whitespace-nowrap",
                    isCurrent ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {a.subjectCode}
                </span>
              )}
            </div>

            {i < assessments.length - 1 && (
              <div className="mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-border">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "#16A34A" }}
                  initial={false}
                  animate={{ width: isDone ? "100%" : "0%" }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PreAssessmentPage() {
  const router = useRouter();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Read once, lazily, before first paint — see loadSavedProgress().
  const [savedProgress] = useState(loadSavedProgress);

  // Flat list of all questions: { assessmentIndex, questionIndex }
  const [currentAssessmentIdx, setCurrentAssessmentIdx] = useState(
    savedProgress?.currentAssessmentIdx ?? 0
  );
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(
    savedProgress?.currentQuestionIdx ?? 0
  );

  // Answers: assessmentId -> { questionId -> optionId }
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>(
    savedProgress?.answers ?? {}
  );
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<SubjectResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [csrfToken, setCsrfToken] = useState("");

  // Indexes of assessments whose section-intro card has been dismissed. Not
  // persisted: reappearing after a reload mid-transition is a mild reminder,
  // not a bug — the alternative is silently skipping the one screen that
  // states which subject is starting.
  const [dismissedIntroFor, setDismissedIntroFor] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch("/api/csrf")
      .then((r) => r.json())
      .then((d: { csrfToken?: string }) => setCsrfToken(d.csrfToken ?? ""))
      .catch(() => {});
  }, []);

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
          <p className="text-red-600 font-medium mb-4">{error}</p>
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

  const currentAssessment = assessments[currentAssessmentIdx];
  if (!currentAssessment) return null;

  const currentQuestion = currentAssessment.questions[currentQuestionIdx];
  if (!currentQuestion) return null;

  // Progress is measured against the section, not the whole assessment. A
  // single "Question 11 of 20" bar reads as one twenty-question exam, so a
  // learner eleven questions into Math has no way to see they are two
  // questions from finishing it — the number that decides whether to keep
  // going or take a break.
  const sectionTotal = currentAssessment.questions.length;
  const sectionNumber = currentQuestionIdx + 1;

  const subjectColor = SUBJECT_BAR_COLOR[currentAssessment.subjectCode] ?? "var(--primary)";
  const SubjectIcon = SUBJECT_ICONS[currentAssessment.subjectCode] ?? BookOpen;

  // Gate the very first question of a subject behind an explicit "Start"
  // screen — the boundary between subjects is the one place a learner most
  // needs telling apart, and a card that fades in like every other question
  // doesn't announce that anything changed.
  const showingIntro =
    currentQuestionIdx === 0 && !dismissedIntroFor.has(currentAssessmentIdx);

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

  if (showingIntro) {
    const isFirstSection = currentAssessmentIdx === 0;
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="bg-card border-b border-border px-4 sm:px-6 py-4">
          <div className="max-w-2xl mx-auto flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-foreground">Pre-Assessment</span>
          </div>
        </header>

        <div className="bg-card border-b border-border px-4 sm:px-6 py-4">
          <div className="max-w-2xl mx-auto">
            <SubjectStepper assessments={assessments} currentIdx={currentAssessmentIdx} size="full" />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 py-10">
          <motion.div
            key={currentAssessmentIdx}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="w-full max-w-md text-center"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5">
              Section {currentAssessmentIdx + 1} of {assessments.length}
            </p>

            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: subjectColor }}
            >
              <SubjectIcon className="w-9 h-9 text-white" />
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-2">
              {currentAssessment.subjectName}
            </h1>
            <p className="text-muted-foreground text-sm mb-8">
              {currentAssessment.questions.length} question
              {currentAssessment.questions.length === 1 ? "" : "s"} in this section
            </p>

            <Button
              size="lg"
              onClick={() => setDismissedIntroFor((prev) => new Set(prev).add(currentAssessmentIdx))}
              className="px-8 flex items-center justify-center gap-2 mx-auto"
              style={SUBJECT_BUTTON_VARS[currentAssessment.subjectCode]}
            >
              {isFirstSection ? "Start Assessment" : `Start ${currentAssessment.subjectName}`}
              <ArrowRight className="w-4 h-4" />
            </Button>

            {!isFirstSection && (
              <p className="text-xs text-muted-foreground mt-5">
                {currentAssessmentIdx} of {assessments.length} sections complete
              </p>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-foreground hidden sm:block">
              Pre-Assessment
            </span>
          </div>
          <span
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white"
            style={{ background: subjectColor }}
          >
            <SubjectIcon className="w-3.5 h-3.5" />
            {currentAssessment.subjectName}
          </span>
        </div>
      </header>

      {/* Stepper and section progress share one band. They were separate rows
          with their own rules, which stacked four horizontal dividers above the
          question — and both were saying "where am I", just at different
          scales. */}
      <div className="bg-card border-b border-border px-4 sm:px-6 py-3">
        <div className="max-w-2xl mx-auto">
          <SubjectStepper assessments={assessments} currentIdx={currentAssessmentIdx} />

          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Question {sectionNumber} of {sectionTotal}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full"
                style={{ background: subjectColor }}
                initial={false}
                animate={{ width: `${(sectionNumber / sectionTotal) * 100}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 22 }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              {totalQuestions} total
            </span>
          </div>
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
              <div
                className="bg-card rounded-2xl border border-border border-t-4 shadow-sm p-4 sm:p-8 mb-6"
                style={{ borderTopColor: subjectColor }}
              >
                {/* Number only — the subject is already named twice above, in
                    the header pill and the stepper. */}
                <p
                  className="text-xs uppercase tracking-wide font-bold mb-4"
                  style={{ color: subjectColor }}
                >
                  Question {sectionNumber} of {sectionTotal}
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

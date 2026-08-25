"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import SubjectBadge from "@/components/ui/SubjectBadge";
import Toast from "@/components/ui/Toast";
import AnimatedNumber from "@/components/ui/AnimatedNumber";

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

interface Option {
  id: string;
  text: string;
}

interface Question {
  id: string;
  text: string;
  options: Option[];
  subtopicId: string;
}

interface SubjectAssessment {
  id: string;
  title: string;
  subject: { code: string; name: string };
  questions: Question[];
}

interface Response {
  questionId: string;
  selectedOption: string;
}

interface MockResult {
  subjectCode: string;
  subjectName: string;
  assessmentId: string;
  score: number;
  rawScore: number;
  maxScore: number;
  triggered?: { gaRerun: boolean; reason?: string } | null;
}

function MockSessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const subjects = searchParams.get("subjects")?.split(",") ?? ["MATH", "RLA", "SS", "SCI"];

  const [assessments, setAssessments] = useState<SubjectAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentAssessmentIndex, setCurrentAssessmentIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, Response[]>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showErrorToast, setShowErrorToast] = useState(false);
  const flashError = (msg: string) => {
    setSubmitError(msg);
    setShowErrorToast(true);
    setTimeout(() => setShowErrorToast(false), 4000);
  };
  const [results, setResults] = useState<MockResult[]>([]);
  const [done, setDone] = useState(false);
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    fetch("/api/csrf")
      .then((r) => r.json())
      .then((d: { csrfToken?: string }) => setCsrfToken(d.csrfToken ?? ""))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/assessment/mock?subjects=${subjects.join(",")}`)
      .then((r) => r.json())
      .then((data) => {
        setAssessments(data.assessments ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-muted-foreground">Loading mock test...</p>
        </div>
      </div>
    );
  }

  if (assessments.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">No assessments available. Please seed the database first.</p>
        <Link href="/mock-test"><Button variant="secondary">Back</Button></Link>
      </div>
    );
  }

  if (done) {
    const totalScore = results.reduce((a, r) => a + r.score, 0) / results.length;
    const triggered = results.some((r) => r.triggered?.gaRerun);

    return (
      <div className="min-h-screen bg-background py-10 px-6">
        <motion.div
          className="max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <div className="bg-card rounded-2xl border border-border shadow-sm p-8 text-center mb-6">
            <motion.div
              className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-white ${
                totalScore >= 70 ? "bg-green-500" : totalScore >= 50 ? "bg-orange-500" : "bg-red-500"
              }`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
            >
              <AnimatedNumber value={Math.round(totalScore)} format={(n) => `${n}%`} />
            </motion.div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Mock Test Complete</h1>
            <p className="text-muted-foreground">Here&apos;s how you performed across all subjects.</p>
          </div>

          {/* Nothing here runs the genetic algorithm, so the plan has not
              changed. The old copy claimed it had, and also told the user to
              sign in again, which was never required. */}
          {triggered && (
            <div className="bg-primary-light border border-primary rounded-xl p-4 mb-6 text-sm text-primary">
              <p>
                <strong>This mock test flagged some gaps.</strong> Your dashboard can rebuild your
                schedule around them.
              </p>
              <Link href="/dashboard" className="inline-block mt-1 font-bold hover:underline">
                Go to dashboard →
              </Link>
            </div>
          )}

          <motion.div
            className="space-y-4 mb-8"
            initial="hidden"
            animate="visible"
            transition={{ staggerChildren: 0.08, delayChildren: 0.3 }}
          >
            {results.map((r) => {
              const gedScore = Math.round(100 + r.score);
              const isPassing = gedScore >= 145;
              return (
                <motion.div key={r.subjectCode} variants={fadeUp} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <SubjectBadge code={r.subjectCode} className="mb-2" />
                      <p className="font-semibold text-foreground">{r.subjectName}</p>
                      <p className="text-sm text-muted-foreground">
                        {r.rawScore}/{r.maxScore} correct · Est. GED: {gedScore}/200
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${isPassing ? "text-green-600" : "text-red-500"}`}>
                        <AnimatedNumber value={Math.round(r.score)} format={(n) => `${n}%`} />
                      </p>
                      <p className={`text-xs font-medium ${isPassing ? "text-green-600" : "text-red-500"}`}>
                        {isPassing ? "Passing" : "Below Passing"}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          <div className="flex gap-3 justify-center">
            <Link href="/dashboard"><Button variant="secondary">Dashboard</Button></Link>
            <Link href="/progress"><Button>View Progress</Button></Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const assessment = assessments[currentAssessmentIndex];
  const question = assessment.questions[currentQuestionIndex];
  const totalQuestions = assessments.reduce((a, ax) => a + ax.questions.length, 0);
  // `responses[assessment.id]` already includes every question answered so far
  // in the current assessment (it's pushed to before advancing the index), so
  // adding `currentQuestionIndex` on top double-counted the current assessment
  // and could push progress past 100%.
  const answeredSoFar = Object.values(responses).reduce((a, r) => a + r.length, 0);
  const globalProgress = Math.min(100, Math.round((answeredSoFar / totalQuestions) * 100));

  const handleNext = async () => {
    if (!selected) return;

    const assessmentResponses = responses[assessment.id] ?? [];
    const newResponses = [...assessmentResponses, { questionId: question.id, selectedOption: selected }];
    const updatedResponses = { ...responses, [assessment.id]: newResponses };
    setResponses(updatedResponses);
    setSelected(null);

    const isLastQuestion = currentQuestionIndex === assessment.questions.length - 1;
    const isLastAssessment = currentAssessmentIndex === assessments.length - 1;

    if (!isLastQuestion) {
      setCurrentQuestionIndex((q) => q + 1);
      return;
    }

    // Submit this assessment
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/assessment/${assessment.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ responses: newResponses }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        flashError(d.error ?? "Failed to submit. Please try again.");
        return;
      }
      const data = await res.json();
      const result: MockResult = {
        subjectCode: assessment.subject.code,
        subjectName: assessment.subject.name,
        assessmentId: assessment.id,
        score: data.score,
        rawScore: data.rawScore,
        maxScore: data.maxScore,
        triggered: data.triggered,
      };
      const newResults = [...results, result];
      setResults(newResults);

      if (isLastAssessment) {
        setDone(true);
      } else {
        setCurrentAssessmentIndex((a) => a + 1);
        setCurrentQuestionIndex(0);
      }
    } catch {
      flashError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/mock-test" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Exit Test
          </Link>
          <div className="flex items-center gap-3">
            <SubjectBadge code={assessment.subject.code} name={assessment.subject.name} />
            <span className="text-sm text-muted-foreground">
              Q{currentQuestionIndex + 1}/{assessment.questions.length}
            </span>
          </div>
        </div>
        {/* Global progress bar */}
        <div className="max-w-2xl mx-auto mt-3">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-1.5 bg-primary rounded-full"
              initial={false}
              animate={{ width: `${globalProgress}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-right">{globalProgress}% complete</p>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center px-6 py-10">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentAssessmentIndex}-${currentQuestionIndex}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <div className="bg-card rounded-xl border border-border shadow-sm p-8 mb-6">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">
                  {assessment.title}
                </p>
                <h2 className="text-lg font-semibold text-foreground leading-relaxed">{question.text}</h2>
              </div>

              <div
                role="radiogroup"
                aria-label="Answer choices"
                className="space-y-3"
              >
                {question.options.map((option: Option, i: number) => (
                  <motion.button
                    key={option.id}
                    role="radio"
                    aria-checked={selected === option.id}
                    aria-label={`Option ${option.id}: ${option.text}`}
                    onClick={() => setSelected(option.id)}
                    whileTap={{ scale: 0.98 }}
                    onKeyDown={(e) => {
                      const total = question.options.length;
                      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                        e.preventDefault();
                        setSelected(question.options[(i + 1) % total].id);
                      }
                      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                        e.preventDefault();
                        setSelected(question.options[(i - 1 + total) % total].id);
                      }
                    }}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all font-medium text-sm ${
                      selected === option.id
                        ? "border-primary bg-primary-light text-primary"
                        : "border-border bg-card text-foreground hover:border-primary"
                    }`}
                  >
                    <span className="inline-flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${
                        selected === option.id ? "border-primary bg-primary text-white" : "border-border text-muted-foreground"
                      }`}>
                        {option.id}
                      </span>
                      {option.text}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex flex-col items-end gap-3">
            {submitError && (
              <p className="text-red-600 text-sm">{submitError}</p>
            )}
            <Button
              onClick={handleNext}
              disabled={!selected}
              loading={submitting}
              size="lg"
              className="flex items-center gap-2 min-w-32"
            >
              {currentQuestionIndex < assessment.questions.length - 1 || currentAssessmentIndex < assessments.length - 1
                ? <><span>Next</span><ChevronRight className="w-4 h-4" /></>
                : "Finish Test"
              }
            </Button>
          </div>
        </div>
      </main>

      <Toast message={submitError} show={showErrorToast} variant="error" />
    </div>
  );
}

export default function MockSessionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>}>
      <MockSessionContent />
    </Suspense>
  );
}

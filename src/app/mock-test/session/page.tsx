"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import SubjectBadge from "@/components/ui/SubjectBadge";

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
  const [results, setResults] = useState<MockResult[]>([]);
  const [done, setDone] = useState(false);

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
          <p className="text-gray-500">Loading mock test...</p>
        </div>
      </div>
    );
  }

  if (assessments.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">No assessments available. Please seed the database first.</p>
        <Link href="/mock-test"><Button variant="secondary">Back</Button></Link>
      </div>
    );
  }

  if (done) {
    const totalScore = results.reduce((a, r) => a + r.score, 0) / results.length;
    const triggered = results.some((r) => r.triggered?.gaRerun);

    return (
      <div className="min-h-screen bg-gray-50 py-10 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center mb-6">
            <div
              className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-white ${
                totalScore >= 70 ? "bg-green-500" : totalScore >= 50 ? "bg-orange-500" : "bg-red-500"
              }`}
            >
              {Math.round(totalScore)}%
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Mock Test Complete</h1>
            <p className="text-gray-500">Here's how you performed across all subjects.</p>
          </div>

          {triggered && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
              <strong>Your study plan has been updated</strong> based on your mock test performance. Log in next time to see your revised schedule.
            </div>
          )}

          <div className="space-y-4 mb-8">
            {results.map((r) => {
              const gedScore = Math.round(100 + r.score);
              const isPassing = gedScore >= 145;
              return (
                <div key={r.subjectCode} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <SubjectBadge code={r.subjectCode} className="mb-2" />
                      <p className="font-semibold text-gray-800">{r.subjectName}</p>
                      <p className="text-sm text-gray-500">
                        {r.rawScore}/{r.maxScore} correct · Est. GED: {gedScore}/200
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${isPassing ? "text-green-600" : "text-red-500"}`}>
                        {Math.round(r.score)}%
                      </p>
                      <p className={`text-xs font-medium ${isPassing ? "text-green-600" : "text-red-500"}`}>
                        {isPassing ? "Passing" : "Below Passing"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 justify-center">
            <Link href="/dashboard"><Button variant="secondary">Dashboard</Button></Link>
            <Link href="/progress"><Button>View Progress</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  const assessment = assessments[currentAssessmentIndex];
  const question = assessment.questions[currentQuestionIndex];
  const totalQuestions = assessments.reduce((a, ax) => a + ax.questions.length, 0);
  const answeredSoFar =
    Object.values(responses).reduce((a, r) => a + r.length, 0) + (currentQuestionIndex);
  const globalProgress = Math.round((answeredSoFar / totalQuestions) * 100);

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
    try {
      const res = await fetch(`/api/assessment/${assessment.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: newResponses }),
      });
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
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/mock-test" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Exit Test
          </Link>
          <div className="flex items-center gap-3">
            <SubjectBadge code={assessment.subject.code} name={assessment.subject.name} />
            <span className="text-sm text-gray-500">
              Q{currentQuestionIndex + 1}/{assessment.questions.length}
            </span>
          </div>
        </div>
        {/* Global progress bar */}
        <div className="max-w-2xl mx-auto mt-3">
          <div className="h-1.5 bg-gray-100 rounded-full">
            <div
              className="h-1.5 bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${globalProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1 text-right">{globalProgress}% complete</p>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center px-6 py-10">
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 mb-6">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-3">
              {assessment.title}
            </p>
            <h2 className="text-lg font-semibold text-gray-900 leading-relaxed">{question.text}</h2>
          </div>

          <div className="space-y-3">
            {question.options.map((option: Option) => (
              <button
                key={option.id}
                onClick={() => setSelected(option.id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all font-medium text-sm ${
                  selected === option.id
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : "border-gray-200 bg-white text-gray-700 hover:border-blue-200"
                }`}
              >
                <span className="inline-flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    selected === option.id ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300 text-gray-500"
                  }`}>
                    {option.id}
                  </span>
                  {option.text}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-8 flex justify-end">
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

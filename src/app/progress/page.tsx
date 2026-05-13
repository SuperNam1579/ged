"use client";

import { useEffect, useState } from "react";
import { TrendingUp, AlertTriangle, BookOpen } from "lucide-react";
import Link from "next/link";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import Button from "@/components/ui/Button";
import SubjectBadge from "@/components/ui/SubjectBadge";
import Spinner from "@/components/ui/Spinner";
import FitnessConvergenceChart from "@/components/charts/FitnessConvergenceChart";
import { useAuth } from "@/lib/hooks/useAuth";
import { format } from "date-fns";

interface ProficiencyEntry {
  subtopicId: string;
  subtopicName: string;
  topicName: string;
  subjectCode: string;
  subjectName: string;
  score: number;
  attemptCount: number;
  lastUpdated: string;
}

interface SubjectSummary {
  id: string;
  name: string;
  code: string;
  passingScore: number;
  proficiencyScore: number;
}

interface AttemptEntry {
  id: string;
  assessmentType: string;
  title: string;
  subjectCode?: string;
  subjectName?: string;
  score: number;
  rawScore: number;
  maxScore: number;
  completedAt: string;
}

interface GALog {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  worstFitness: number;
}

const SUBJECT_COLORS: Record<string, string> = {
  MATH: "bg-blue-500",
  RLA: "bg-green-500",
  SS: "bg-orange-500",
  SCI: "bg-purple-500",
};

export default function ProgressPage() {
  const { user, loading: authLoading } = useAuth();
  const [proficiencies, setProficiencies] = useState<ProficiencyEntry[]>([]);
  const [subjectSummaries, setSubjectSummaries] = useState<SubjectSummary[]>([]);
  const [attempts, setAttempts] = useState<AttemptEntry[]>([]);
  const [gaLogs, setGaLogs] = useState<GALog[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    Promise.all([
      fetch("/api/proficiency").then((r) => r.json()),
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/attempts").then((r) => r.json()),
      fetch("/api/ga/logs").then((r) => r.json()),
    ]).then(([profData, dashData, attemptsData, gaData]) => {
      setProficiencies(profData.proficiencies ?? []);
      setSubjectSummaries(dashData.subjectSummaries ?? []);
      setOverallProgress(dashData.overallProgress ?? 0);
      setAttempts(attemptsData.attempts ?? []);
      setGaLogs(gaData.logs ?? []);
      setLoading(false);
    });
  }, [authLoading]);

  const weakestSubtopics = [...proficiencies]
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  if (authLoading || loading) {
    return (
      <MainLayout userName={user?.name}>
        <div className="flex-1 flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout userName={user?.name}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">My Progress</h1>
          <p className="text-gray-500 mt-1">Track your proficiency and identify areas for improvement.</p>
        </div>

        {/* Overall progress */}
        <Card className="mb-6">
          <CardBody>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Overall Plan Completion</h2>
                <p className="text-sm text-gray-500">Sessions completed vs scheduled</p>
              </div>
            </div>
            <ProgressBar value={overallProgress} label="Completion Rate" size="lg" />
          </CardBody>
        </Card>

        {/* Subject breakdown */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Subject Proficiency</h2>
            <p className="text-sm text-gray-500 mt-0.5">Estimated GED score = 100 + proficiency score (Passing: 145/200)</p>
          </CardHeader>
          <CardBody className="space-y-6">
            {subjectSummaries.map((subject) => {
              const gedScore = 100 + subject.proficiencyScore;
              const isPassing = gedScore >= 145;
              return (
                <div key={subject.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-3 h-3 rounded-full ${SUBJECT_COLORS[subject.code] ?? "bg-gray-400"}`} />
                      <span className="font-medium text-gray-800 text-sm">{subject.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isPassing ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        GED est. {gedScore}/200
                      </span>
                    </div>
                  </div>
                  <ProgressBar value={subject.proficiencyScore} showPercent={false} />
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-400">0</span>
                    <span className="text-xs text-gray-500 font-medium">{subject.proficiencyScore}% proficiency</span>
                    <span className="text-xs text-gray-400">100</span>
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Weakest subtopics */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <h2 className="font-semibold text-gray-900">Needs Most Work</h2>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {weakestSubtopics.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-gray-500">
                  Complete some quizzes to see your weak areas.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {weakestSubtopics.map((st) => (
                    <div key={st.subtopicId} className="flex items-center justify-between px-6 py-3.5">
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <SubjectBadge code={st.subjectCode} />
                        </div>
                        <p className="text-sm font-medium text-gray-800 truncate">{st.subtopicName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                            <div
                              className="h-1.5 bg-red-400 rounded-full"
                              style={{ width: `${st.score}%` }}
                            />
                          </div>
                          <span className="text-xs text-red-600 font-medium flex-shrink-0">{Math.round(st.score)}%</span>
                        </div>
                      </div>
                      <Link href={`/quiz/${st.subtopicId}`}>
                        <Button size="sm" variant="secondary">Practice</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Recent attempts */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-500" />
                <h2 className="font-semibold text-gray-900">Recent Assessments</h2>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {attempts.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-gray-500">
                  No assessments completed yet.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {attempts.slice(0, 6).map((a) => (
                    <div key={a.id} className="flex items-center justify-between px-6 py-3.5">
                      <div>
                        {a.subjectCode && <SubjectBadge code={a.subjectCode} className="mb-1" />}
                        <p className="text-sm font-medium text-gray-800">{a.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {a.completedAt ? format(new Date(a.completedAt), "MMM d, yyyy") : ""}
                        </p>
                      </div>
                      <span className={`text-base font-bold ${a.score >= 70 ? "text-green-600" : a.score >= 50 ? "text-orange-500" : "text-red-500"}`}>
                        {Math.round(a.score)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* GA Convergence chart */}
        {gaLogs.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">Study Plan Optimization (GA Convergence)</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Fitness evolution across generations — shows how the genetic algorithm improved your study plan.
              </p>
            </CardHeader>
            <CardBody>
              <FitnessConvergenceChart data={gaLogs} />
            </CardBody>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

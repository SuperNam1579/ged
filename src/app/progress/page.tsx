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
import dynamic from "next/dynamic";

const FitnessConvergenceChart = dynamic(
  () => import("@/components/charts/FitnessConvergenceChart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-60 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    ),
  }
);
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
  coveragePercent: number;
  attemptedCount: number;
  totalCount: number;
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
  MATH: "bg-primary",
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
    }).catch(() => {}).finally(() => {
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">My Progress</h1>
          <p className="text-muted-foreground mt-1">Track your proficiency and identify areas for improvement.</p>
        </div>

        {/* Overall progress */}
        <Card className="mb-6">
          <CardBody>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Overall Plan Completion</h2>
                <p className="text-sm text-muted-foreground">Sessions completed vs scheduled</p>
              </div>
            </div>
            <ProgressBar value={overallProgress} label="Completion Rate" size="lg" />
          </CardBody>
        </Card>

        {/* Subject breakdown */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="font-semibold text-foreground">Subject Proficiency</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Estimated GED score = 100 + proficiency score (Passing: 145/200)</p>
          </CardHeader>
          <CardBody className="space-y-6">
            {subjectSummaries.map((subject) => {
              const gedScore = 100 + subject.proficiencyScore;
              const isPassing = gedScore >= 145;
              const hasAttempts = subject.attemptedCount > 0;
              return (
                <div key={subject.id}>
                  {/* Subject header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-3 h-3 rounded-full ${SUBJECT_COLORS[subject.code] ?? "bg-muted-foreground"}`} />
                      <span className="font-semibold text-foreground text-sm">{subject.name}</span>
                    </div>
                    {hasAttempts ? (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isPassing ? "bg-green-100 dark:bg-green-500/15 text-green-700" : "bg-red-100 dark:bg-red-500/15 text-red-700"}`}>
                        GED est. {gedScore}/200
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No attempts yet</span>
                    )}
                  </div>

                  {/* Score row */}
                  <div className="mb-2.5">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Score on attempted</span>
                      <span className={`text-xs font-bold ${
                        !hasAttempts ? "text-muted-foreground" :
                        subject.proficiencyScore >= 70 ? "text-green-600 dark:text-green-400" :
                        subject.proficiencyScore >= 50 ? "text-orange-500" : "text-red-500"
                      }`}>
                        {hasAttempts ? `${subject.proficiencyScore}%` : "—"}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          subject.proficiencyScore >= 70 ? "bg-green-500" :
                          subject.proficiencyScore >= 50 ? "bg-orange-400" : "bg-red-400"
                        }`}
                        style={{ width: `${subject.proficiencyScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Coverage row */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Curriculum covered</span>
                      <span className="text-xs text-muted-foreground">
                        {subject.attemptedCount} / {subject.totalCount} subtopics
                        <span className="ml-1 text-primary font-semibold">({subject.coveragePercent}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${subject.coveragePercent}%` }}
                      />
                    </div>
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
                <h2 className="font-semibold text-foreground">Needs Most Work</h2>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {weakestSubtopics.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                  Complete some quizzes to see your weak areas.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {weakestSubtopics.map((st) => (
                    <div key={st.subtopicId} className="flex items-center justify-between px-6 py-3.5">
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <SubjectBadge code={st.subjectCode} />
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">{st.subtopicName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-muted rounded-full">
                            <div
                              className="h-1.5 bg-red-400 rounded-full"
                              style={{ width: `${st.score}%` }}
                            />
                          </div>
                          <span className="text-xs text-red-600 dark:text-red-400 font-medium shrink-0">{Math.round(st.score)}%</span>
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
                <BookOpen className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-foreground">Recent Assessments</h2>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {attempts.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                  No assessments completed yet.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {attempts.slice(0, 6).map((a) => (
                    <div key={a.id} className="flex items-center justify-between px-6 py-3.5">
                      <div>
                        {a.subjectCode && <SubjectBadge code={a.subjectCode} className="mb-1" />}
                        <p className="text-sm font-medium text-foreground">{a.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {a.completedAt ? format(new Date(a.completedAt), "MMM d, yyyy") : ""}
                        </p>
                      </div>
                      <span className={`text-base font-bold ${a.score >= 70 ? "text-green-600 dark:text-green-400" : a.score >= 50 ? "text-orange-500" : "text-red-500"}`}>
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
              <h2 className="font-semibold text-foreground">Study Plan Optimization (GA Convergence)</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
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

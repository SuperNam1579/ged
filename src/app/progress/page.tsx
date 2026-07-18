"use client";

import { useEffect, useState } from "react";
import { TrendingUp, AlertTriangle, BookOpen, Award, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import Button from "@/components/ui/Button";
import SubjectBadge from "@/components/ui/SubjectBadge";
import Spinner from "@/components/ui/Spinner";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import Reveal from "@/components/ui/Reveal";
import dynamic from "next/dynamic";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

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

function StatTile({
  icon: Icon, iconClass, label, value, sub,
}: { icon: typeof TrendingUp; iconClass: string; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <motion.div variants={fadeUp} className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="text-xl font-bold text-foreground leading-tight">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </motion.div>
  );
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

  const attemptedSubjects = subjectSummaries.filter((s) => s.attemptedCount > 0);
  const subjectsPassing = attemptedSubjects.filter((s) => 100 + s.proficiencyScore >= 145).length;
  const avgScore = attemptedSubjects.length
    ? Math.round(attemptedSubjects.reduce((a, s) => a + s.proficiencyScore, 0) / attemptedSubjects.length)
    : null;

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

        {/* Stat tiles */}
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: 0.06 }}
        >
          <StatTile
            icon={TrendingUp}
            iconClass="text-primary"
            label="Overall Completion"
            value={<AnimatedNumber value={Math.round(overallProgress)} format={(n) => `${n}%`} />}
            sub="Sessions done"
          />
          <StatTile
            icon={ClipboardCheck}
            iconClass="text-purple-500"
            label="Assessments Taken"
            value={<AnimatedNumber value={attempts.length} />}
          />
          <StatTile
            icon={Award}
            iconClass="text-green-500"
            label="Subjects Passing"
            value={<><AnimatedNumber value={subjectsPassing} /> / {attemptedSubjects.length || subjectSummaries.length}</>}
            sub="Est. 145+/200"
          />
          <StatTile
            icon={AlertTriangle}
            iconClass="text-orange-500"
            label="Avg Score"
            value={avgScore !== null ? <AnimatedNumber value={avgScore} format={(n) => `${n}%`} /> : "—"}
            sub="On attempted subjects"
          />
        </motion.div>

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
            {subjectSummaries.map((subject, i) => {
              const gedScore = 100 + subject.proficiencyScore;
              const isPassing = gedScore >= 145;
              const hasAttempts = subject.attemptedCount > 0;
              return (
                <motion.div
                  key={subject.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                >
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
                      <motion.div
                        className={`h-full rounded-full ${
                          subject.proficiencyScore >= 70 ? "bg-green-500" :
                          subject.proficiencyScore >= 50 ? "bg-orange-400" : "bg-red-400"
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${subject.proficiencyScore}%` }}
                        transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.1 + i * 0.06 }}
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
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${subject.coveragePercent}%` }}
                        transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.15 + i * 0.06 }}
                      />
                    </div>
                  </div>
                </motion.div>
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
                <div className="px-6 py-10 text-center">
                  <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Complete some quizzes to see your weak areas.</p>
                </div>
              ) : (
                <motion.div
                  className="divide-y divide-border"
                  initial="hidden"
                  animate="visible"
                  transition={{ staggerChildren: 0.06 }}
                >
                  {weakestSubtopics.map((st) => (
                    <motion.div key={st.subtopicId} variants={fadeUp} className="flex items-center justify-between px-6 py-3.5">
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <SubjectBadge code={st.subjectCode} />
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">{st.subtopicName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              className="h-1.5 bg-red-400 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${st.score}%` }}
                              transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.2 }}
                            />
                          </div>
                          <span className="text-xs text-red-600 dark:text-red-400 font-medium shrink-0">{Math.round(st.score)}%</span>
                        </div>
                      </div>
                      <Link href={`/quiz/${st.subtopicId}`}>
                        <Button size="sm" variant="secondary">Practice</Button>
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
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
                <div className="px-6 py-10 text-center">
                  <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No assessments completed yet.</p>
                </div>
              ) : (
                <motion.div
                  className="divide-y divide-border"
                  initial="hidden"
                  animate="visible"
                  transition={{ staggerChildren: 0.06 }}
                >
                  {attempts.slice(0, 6).map((a) => (
                    <motion.div key={a.id} variants={fadeUp} className="flex items-center justify-between px-6 py-3.5">
                      <div>
                        {a.subjectCode && <SubjectBadge code={a.subjectCode} className="mb-1" />}
                        <p className="text-sm font-medium text-foreground">{a.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {a.completedAt ? format(new Date(a.completedAt), "MMM d, yyyy") : ""}
                        </p>
                      </div>
                      <span className={`text-base font-bold ${a.score >= 70 ? "text-green-600 dark:text-green-400" : a.score >= 50 ? "text-orange-500" : "text-red-500"}`}>
                        <AnimatedNumber value={Math.round(a.score)} format={(n) => `${n}%`} />
                      </span>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* GA Convergence chart */}
        {gaLogs.length > 0 && (
          <Reveal amount={0.3}>
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
          </Reveal>
        )}
      </div>
    </MainLayout>
  );
}

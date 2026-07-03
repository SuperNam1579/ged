"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Calendar, TrendingUp, Play, AlertCircle, BookOpen, Info } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import Badge from "@/components/ui/Badge";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { useAuth } from "@/lib/hooks/useAuth";
import { cn } from "@/lib/utils/cn";
import type { DashboardStats, StudySessionWithSubtopic } from "@/types";

const SUBJECT_COLORS: Record<string, string> = {
  MATH: "bg-primary-light text-primary",
  RLA: "bg-green-100 dark:bg-green-500/15 text-green-700",
  SS: "bg-orange-100 dark:bg-orange-500/15 text-orange-700",
  SCI: "bg-primary-light text-accent",
};

const SUBJECT_BADGE_VARIANT: Record<string, "info" | "success" | "warning" | "danger" | "default"> = {
  MATH: "info",
  RLA: "success",
  SS: "warning",
  SCI: "default",
};

function DifficultyDots({ level }: { level: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((d) => (
        <div
          key={d}
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            d <= level ? "bg-primary" : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}

function SessionCard({ session }: { session: StudySessionWithSubtopic }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary hover:shadow-sm transition-all">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={SUBJECT_BADGE_VARIANT[session.subjectCode] ?? "default"}>
            {session.subjectCode}
          </Badge>
          <DifficultyDots level={session.difficultyLevel} />
        </div>
        <p className="text-sm font-semibold text-foreground truncate">{session.subtopicName}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{session.topicName} · {session.durationMins} min</p>
      </div>
      <Link href={`/study/${session.id}`}>
        <Button size="sm" variant="primary" className="flex items-center gap-1.5 shrink-0">
          <Play className="w-3.5 h-3.5" />
          Start
        </Button>
      </Link>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    fetch("/api/user/preferences")
      .then((r) => r.json())
      .then((data) => { if (!data.preferences) router.replace("/onboarding"); })
      .catch(() => {});
  }, [authLoading, router]);

  useEffect(() => {
    if (authLoading) return;
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setStats(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load dashboard. Please refresh.");
        setLoading(false);
      });
  }, [authLoading]);

  if (authLoading || loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen px-6">
          <div className="text-center max-w-sm">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="text-foreground font-medium mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Refresh</Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const todaySessions = stats?.todaySessions ?? [];
  const subjectSummaries = stats?.subjectSummaries ?? [];

  const daysUntilExam = stats?.daysUntilExam ?? 0;
  const lastUpdate = stats?.lastPlanUpdate;

  return (
    <MainLayout userName={user?.name} daysUntilExam={daysUntilExam}>
      <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-5xl mx-auto w-full">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">
            {user?.name ? `Good day, ${user.name.split(" ")[0]}!` : "Dashboard"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Here's what's on your study plan today.</p>
        </div>

        {/* Plan update banner */}
        {lastUpdate && lastUpdate.reason !== "INITIAL" && (
          <div className="mb-6 flex items-start gap-3 bg-primary-light border border-primary rounded-xl px-5 py-4">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-primary">Your study plan was updated</p>
              <p className="text-xs text-primary mt-0.5">
                Reason: {lastUpdate.reason.replace(/_/g, " ")} ·{" "}
                {new Date(lastUpdate.generatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Overall Progress"
            value={`${Math.round(stats?.overallProgress ?? 0)}%`}
            sub="across all subjects"
            icon={TrendingUp}
            color="bg-primary-light text-primary"
          />
          <StatCard
            label="Days Until Exam"
            value={daysUntilExam}
            sub="keep up the pace!"
            icon={Calendar}
            color="bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400"
          />
          <StatCard
            label="Today's Sessions"
            value={todaySessions.length}
            sub={todaySessions.length === 1 ? "session scheduled" : "sessions scheduled"}
            icon={BookOpen}
            color="bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"
          />
          <StatCard
            label="Plan Version"
            value={`v${stats?.currentPlanVersion ?? 1}`}
            sub="AI-optimized"
            icon={ClipboardList}
            color="bg-primary-light text-accent"
          />
        </div>

        {/* Overall progress bar */}
        <div className="mb-8 bg-card rounded-xl border border-border p-5">
          <p className="text-sm font-semibold text-foreground mb-3">Overall GED Readiness</p>
          <ProgressBar value={stats?.overallProgress ?? 0} variant="blue" size="lg" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Today's Sessions */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">Today's Study Sessions</h2>
                  <Badge variant="info">{todaySessions.length} sessions</Badge>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                {todaySessions.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">No sessions for today</p>
                    <p className="text-xs text-muted-foreground mt-1">Check your schedule for upcoming sessions</p>
                    <Link href="/schedule">
                      <Button variant="secondary" size="sm" className="mt-4">
                        View Schedule
                      </Button>
                    </Link>
                  </div>
                ) : (
                  todaySessions.map((session) => (
                    <SessionCard key={session.id} session={session} />
                  ))
                )}
              </CardBody>
            </Card>
          </div>

          {/* Subject Progress */}
          <div>
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold text-foreground">Subject Progress</h2>
              </CardHeader>
              <CardBody className="space-y-5">
                {subjectSummaries.map((subject) => (
                  <div key={subject.code}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("px-2 py-0.5 rounded text-xs font-semibold", SUBJECT_COLORS[subject.code] ?? "bg-muted text-foreground")}>
                          {subject.code}
                        </span>
                        {subject.attemptedCount > 0 && subject.proficiencyScore < 60 && (
                          <span className="text-xs text-orange-500 font-medium">Needs work</span>
                        )}
                      </div>
                      {subject.attemptedCount === 0 && (
                        <span className="text-xs text-muted-foreground italic">Not started</span>
                      )}
                    </div>

                    {/* Score bar */}
                    <div className="mb-1.5">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-muted-foreground">Score</span>
                        <span className={cn(
                          "text-xs font-semibold",
                          subject.attemptedCount === 0 ? "text-muted-foreground" :
                          subject.proficiencyScore >= 70 ? "text-green-600 dark:text-green-400" :
                          subject.proficiencyScore >= 50 ? "text-orange-500" : "text-red-500"
                        )}>
                          {subject.attemptedCount === 0 ? "—" : `${subject.proficiencyScore}%`}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all",
                            subject.proficiencyScore >= 70 ? "bg-green-500" :
                            subject.proficiencyScore >= 50 ? "bg-orange-400" : "bg-red-400"
                          )}
                          style={{ width: `${subject.proficiencyScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Coverage bar */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-muted-foreground">Coverage</span>
                        <span className="text-xs text-muted-foreground">
                          {subject.attemptedCount}/{subject.totalCount}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${subject.coveragePercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-base font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href="/mock-test">
              <div className="bg-card rounded-xl border border-border p-5 hover:border-primary hover:shadow-sm transition-all cursor-pointer group">
                <ClipboardList className="w-6 h-6 text-primary mb-3 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-semibold text-foreground">Take Mock Test</p>
                <p className="text-xs text-muted-foreground mt-0.5">Simulate GED exam conditions</p>
              </div>
            </Link>
            <Link href="/schedule">
              <div className="bg-card rounded-xl border border-border p-5 hover:border-primary hover:shadow-sm transition-all cursor-pointer group">
                <Calendar className="w-6 h-6 text-orange-500 mb-3 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-semibold text-foreground">View Full Schedule</p>
                <p className="text-xs text-muted-foreground mt-0.5">See your upcoming study plan</p>
              </div>
            </Link>
            <Link href="/progress">
              <div className="bg-card rounded-xl border border-border p-5 hover:border-primary hover:shadow-sm transition-all cursor-pointer group">
                <TrendingUp className="w-6 h-6 text-green-500 mb-3 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-semibold text-foreground">View My Progress</p>
                <p className="text-xs text-muted-foreground mt-0.5">Track scores & weak areas</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

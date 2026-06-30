"use client";

import { useEffect, useState } from "react";
import { addDays, format, startOfWeek, isSameDay, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, Circle, BookOpen } from "lucide-react";
import Link from "next/link";
import MainLayout from "@/components/layout/MainLayout";
import Spinner from "@/components/ui/Spinner";
import { useAuth } from "@/lib/hooks/useAuth";
import { cn } from "@/lib/utils/cn";

interface SessionEntry {
  id: string;
  subtopicId: string;
  subtopicName: string;
  subjectCode: string;
  subjectName: string;
  scheduledDate: string;
  durationMins: number;
  status: string;
  difficultyLevel: number;
}

const SUBJECT_COLOR: Record<string, { badge: string; dot: string }> = {
  MATH: { badge: "bg-blue-100 text-blue-700",   dot: "bg-blue-500" },
  RLA:  { badge: "bg-green-100 text-green-700",  dot: "bg-green-500" },
  SS:   { badge: "bg-amber-100 text-amber-700",  dot: "bg-amber-500" },
  SCI:  { badge: "bg-purple-100 text-purple-700", dot: "bg-purple-500" },
};

const SUBJECT_LABEL: Record<string, string> = {
  MATH: "Math",
  RLA:  "Language Arts",
  SS:   "Social Studies",
  SCI:  "Science",
};

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function SchedulePage() {
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  useEffect(() => {
    if (authLoading) return;
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data) => {
        setSessions(data.sessions ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [authLoading]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getSessionsForDay = (date: Date) =>
    sessions.filter((s) => isSameDay(parseISO(s.scheduledDate), date));

  const weekSessions = weekDays.flatMap((d) => getSessionsForDay(d));
  const weekTotalMins = weekSessions.reduce((a, s) => a + s.durationMins, 0);
  const weekCompleted = weekSessions.filter((s) => s.status === "COMPLETED").length;

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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-8">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Study Schedule</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <button
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* ── Week summary bar ────────────────────────────────────────── */}
        {weekSessions.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-800">
                This week — {fmtMins(weekTotalMins)} total
              </span>
              <span className="text-sm text-gray-500">
                {weekCompleted} / {weekSessions.length} sessions done
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-2 bg-green-500 rounded-full transition-all"
                style={{ width: `${weekSessions.length ? (weekCompleted / weekSessions.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Day rows ────────────────────────────────────────────────── */}
        {sessions.length === 0 ? (
          <div className="py-20 text-center">
            <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-3">No study plan found.</p>
            <Link href="/dashboard" className="text-blue-600 font-medium text-sm hover:underline">
              Generate your study plan →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {weekDays.map((day, i) => {
              const daySessions = getSessionsForDay(day);
              const isToday = isSameDay(day, new Date());
              const dayMins = daySessions.reduce((a, s) => a + s.durationMins, 0);
              const dayDone = daySessions.filter((s) => s.status === "COMPLETED").length;

              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-xl border bg-white transition-colors",
                    isToday
                      ? "border-blue-300 shadow-sm shadow-blue-100"
                      : "border-gray-200"
                  )}
                >
                  {/* Day header row */}
                  <div
                    className={cn(
                      "flex items-center gap-4 px-4 py-3 rounded-t-xl",
                      isToday ? "bg-blue-600" : daySessions.length > 0 ? "bg-gray-50" : "bg-white"
                    )}
                  >
                    <div className="w-16 shrink-0">
                      <p className={cn("text-xs font-semibold uppercase tracking-wider", isToday ? "text-blue-100" : "text-gray-400")}>
                        {format(day, "EEE")}
                      </p>
                      <p className={cn("text-xl font-bold leading-tight", isToday ? "text-white" : "text-gray-800")}>
                        {format(day, "d")}
                      </p>
                    </div>

                    {daySessions.length > 0 ? (
                      <div className="flex items-center gap-3 flex-1">
                        <span className={cn("text-sm font-medium", isToday ? "text-blue-100" : "text-gray-600")}>
                          {fmtMins(dayMins)}
                        </span>
                        <span className={cn("text-xs", isToday ? "text-blue-200" : "text-gray-400")}>
                          {dayDone}/{daySessions.length} done
                        </span>
                        {isToday && dayDone < daySessions.length && (
                          <span className="ml-auto text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">
                            Today
                          </span>
                        )}
                        {isToday && dayDone === daySessions.length && (
                          <span className="ml-auto text-xs bg-green-400/80 text-white px-2 py-0.5 rounded-full font-medium">
                            ✓ Done
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className={cn("text-sm", isToday ? "text-blue-200" : "text-gray-300")}>
                        Free
                      </span>
                    )}
                  </div>

                  {/* Sessions list */}
                  {daySessions.length > 0 && (
                    <div className="divide-y divide-gray-100">
                      {daySessions.map((s) => {
                        const colors = SUBJECT_COLOR[s.subjectCode] ?? { badge: "bg-gray-100 text-gray-600", dot: "bg-gray-400" };
                        const done = s.status === "COMPLETED";
                        return (
                          <Link key={s.id} href={`/study/${s.id}`}>
                            <div className={cn(
                              "flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors",
                              done && "opacity-50"
                            )}>
                              {/* Status icon */}
                              {done
                                ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                : <Circle className="w-4 h-4 text-gray-300 shrink-0" />
                              }

                              {/* Color dot */}
                              <div className={cn("w-2 h-2 rounded-full shrink-0", colors.dot)} />

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-sm font-medium text-gray-900 truncate", done && "line-through")}>
                                  {s.subtopicName}
                                </p>
                                <span className={cn("inline-block text-[11px] font-medium px-1.5 py-0.5 rounded-full mt-0.5", colors.badge)}>
                                  {SUBJECT_LABEL[s.subjectCode] ?? s.subjectCode}
                                </span>
                              </div>

                              {/* Duration */}
                              <div className="flex items-center gap-1 text-gray-400 shrink-0">
                                <Clock className="w-3 h-3" />
                                <span className="text-xs">{fmtMins(s.durationMins)}</span>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

"use client";

import { useEffect, useState } from "react";
import { addDays, format, startOfWeek, isSameDay, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/Card";
import SubjectBadge from "@/components/ui/SubjectBadge";
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

const SUBJECT_BG: Record<string, string> = {
  MATH: "bg-blue-50 border-blue-200 hover:border-blue-400",
  RLA: "bg-green-50 border-green-200 hover:border-green-400",
  SS: "bg-orange-50 border-orange-200 hover:border-orange-400",
  SCI: "bg-purple-50 border-purple-200 hover:border-purple-400",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SchedulePage() {
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

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

  const totalMinutesThisWeek = weekDays.reduce(
    (acc, d) => acc + getSessionsForDay(d).reduce((a, s) => a + s.durationMins, 0),
    0
  );

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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Study Schedule</h1>
            <p className="text-gray-500 mt-1">
              Week of {format(weekStart, "MMMM d, yyyy")} — {Math.round(totalMinutesThisWeek / 60)}h{" "}
              {totalMinutesThisWeek % 60}m scheduled
            </p>
          </div>

          <div className="flex items-center gap-2">
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

        {/* Legend */}
        <div className="flex items-center gap-4 mb-6">
          <span className="text-xs text-gray-500 font-medium">Subjects:</span>
          {[
            { code: "MATH", label: "Math", cls: "bg-blue-100 text-blue-700" },
            { code: "RLA", label: "Lang. Arts", cls: "bg-green-100 text-green-700" },
            { code: "SS", label: "Social Studies", cls: "bg-orange-100 text-orange-700" },
            { code: "SCI", label: "Science", cls: "bg-purple-100 text-purple-700" },
          ].map((s) => (
            <span key={s.code} className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.cls}`}>
              {s.label}
            </span>
          ))}
        </div>

        {/* Week grid — overflow-x-auto so small screens scroll rather than compress */}
        <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
        <div className="grid grid-cols-7 gap-3 min-w-150">
          {weekDays.map((day, i) => {
            const daySessions = getSessionsForDay(day);
            const isToday = isSameDay(day, new Date());
            const totalMins = daySessions.reduce((a, s) => a + s.durationMins, 0);

            return (
              <div key={i} className="min-h-50">
                {/* Day header */}
                <div className={cn("text-center mb-2 py-2 rounded-lg", isToday ? "bg-blue-600" : "bg-gray-50")}>
                  <p className={`text-xs font-medium ${isToday ? "text-blue-100" : "text-gray-500"}`}>
                    {DAY_LABELS[day.getDay()]}
                  </p>
                  <p className={`text-lg font-bold ${isToday ? "text-white" : "text-gray-800"}`}>
                    {format(day, "d")}
                  </p>
                  {totalMins > 0 && (
                    <p className={`text-xs mt-0.5 ${isToday ? "text-blue-200" : "text-gray-400"}`}>
                      {totalMins}m
                    </p>
                  )}
                </div>

                {/* Sessions */}
                <div className="space-y-1.5">
                  {daySessions.map((s) => (
                    <Link key={s.id} href={`/study/${s.id}`}>
                      <div
                        className={cn(
                          "p-2 rounded-lg border text-xs cursor-pointer transition-colors",
                          SUBJECT_BG[s.subjectCode] ?? "bg-gray-50 border-gray-200",
                          s.status === "COMPLETED" && "opacity-50 line-through"
                        )}
                      >
                        <div className="mb-1">
                          <SubjectBadge code={s.subjectCode} className="text-[10px] px-1.5 py-0" />
                        </div>
                        <p className="font-medium text-gray-800 leading-tight line-clamp-2">
                          {s.subtopicName}
                        </p>
                        <p className="flex items-center gap-0.5 text-gray-500 mt-1">
                          <Clock className="w-2.5 h-2.5" />
                          {s.durationMins}m
                        </p>
                      </div>
                    </Link>
                  ))}

                  {daySessions.length === 0 && (
                    <div className="h-12 border border-dashed border-gray-200 rounded-lg flex items-center justify-center">
                      <span className="text-xs text-gray-300">Free</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>{/* end overflow-x-auto */}

        {sessions.length === 0 && (
          <Card className="mt-8">
            <div className="py-16 text-center">
              <p className="text-gray-500 mb-4">No study plan found.</p>
              <Link href="/dashboard">
                <button className="text-blue-600 font-medium text-sm hover:underline">
                  Generate your study plan →
                </button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

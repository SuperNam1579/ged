"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Clock, CheckCircle, ExternalLink, ArrowLeft, ChevronRight } from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";
import { safeUrl } from "@/lib/utils/sanitize";
import type { StudySessionWithSubtopic } from "@/types";

const SUBJECT_BADGE_VARIANT: Record<string, "info" | "success" | "warning" | "danger" | "default"> = {
  MATH: "info",
  RLA: "success",
  SS: "warning",
  SCI: "default",
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function StudySessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<StudySessionWithSubtopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [csrfToken, setCsrfToken] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/csrf")
      .then((r) => r.json())
      .then((d: { csrfToken?: string }) => setCsrfToken(d.csrfToken ?? ""))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        if (cancelled) return;

        if (res.status === 404) {
          setError("Session not found.");
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setError("Failed to load session details.");
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setSession(data.session);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Network error loading session.");
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Start timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleComplete = async () => {
    if (completing || completed) return;
    setCompleting(true);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ elapsedSeconds: elapsed }),
      });
      if (res.ok || res.status === 409) {
        setCompleted(true);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    } catch {
      // network error — still mark UI as completed, will sync on next load
      setCompleted(true);
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-red-600 dark:text-red-400 font-medium mb-4">{error || "Session not found."}</p>
          <Link href="/dashboard">
            <Button variant="secondary">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-muted-foreground hover:text-muted-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <span className="text-base font-semibold text-foreground">Study Session</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={SUBJECT_BADGE_VARIANT[session.subjectCode] ?? "default"}>
              {session.subjectCode}
            </Badge>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">
              <Clock className="w-4 h-4" />
              <span className="font-mono font-medium">{formatTime(elapsed)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-3xl">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
            <span>{session.subjectName}</span>
            <ChevronRight className="w-3 h-3" />
            <span>{session.topicName}</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">{session.subtopicName}</span>
          </div>

          {/* Session title */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">{session.subtopicName}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {session.durationMins} min estimated
              </span>
              <span>·</span>
              <span>Difficulty {session.difficultyLevel}/5</span>
            </div>
          </div>

          {/* Completed state */}
          {completed ? (
            <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-2xl p-8 text-center mb-6">
              <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
              <h2 className="text-lg font-bold text-green-900 dark:text-green-300 mb-2">Session Complete!</h2>
              <p className="text-sm text-green-700 mb-6">
                Great work! You studied {session.subtopicName} for {formatTime(elapsed)}.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link href={`/quiz/${session.subtopicId}`}>
                  <Button size="lg">
                    Take Quiz
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="secondary" size="lg">
                    Back to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            /* Learning Resource */
            <div className="bg-card rounded-2xl border border-border shadow-sm p-8 mb-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide font-medium mb-5">
                <BookOpen className="w-4 h-4" />
                Learning Resource
              </div>

              <h2 className="text-xl font-bold text-foreground mb-3">{session.subtopicName}</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                This session covers <strong>{session.subtopicName}</strong> as part of the{" "}
                <strong>{session.topicName}</strong> topic in <strong>{session.subjectName}</strong>.
                Use the resource below to study this material at your own pace. Take your time and
                make sure you understand the concepts before taking the quiz.
              </p>

              {session.learningUrl ? (
                <a
                  href={safeUrl(session.learningUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors shadow-md shadow-blue-200"
                >
                  Open Learning Resource
                  <ExternalLink className="w-4 h-4" />
                </a>
              ) : (
                <div className="bg-background rounded-xl border border-dashed border-border p-6 text-center">
                  <p className="text-sm text-muted-foreground">No external resource linked for this subtopic.</p>
                  <p className="text-xs text-muted-foreground mt-1">Study from your textbook or notes, then take the quiz when ready.</p>
                </div>
              )}
            </div>
          )}

          {/* Tips */}
          {!completed && (
            <div className="bg-primary-light rounded-xl border border-primary px-5 py-4 mb-8">
              <p className="text-sm font-medium text-primary mb-1">Study tips</p>
              <ul className="text-xs text-primary space-y-1 list-disc list-inside">
                <li>Take notes while you study — it helps with memory retention.</li>
                <li>Don't rush. Understanding concepts is more valuable than speed.</li>
                <li>When you feel ready, take the quiz to test your knowledge.</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      {!completed && (
        <div className="bg-card border-t border-border px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Study for at least <strong>{session.durationMins} minutes</strong> before moving on.
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={handleComplete}
                loading={completing}
                disabled={completing || !csrfToken}
              >
                <CheckCircle className="w-4 h-4 mr-1.5" />
                Mark as Complete
              </Button>
              <Link href={`/quiz/${session.subtopicId}`}>
                <Button>
                  Take Quiz
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

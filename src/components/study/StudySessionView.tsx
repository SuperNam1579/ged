"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, ExternalLink, SkipForward } from "lucide-react";
import { postJson } from "@/lib/csrf-client";
import { cn } from "@/lib/utils/cn";
import { VideoPlayer, type VideoProgress } from "./VideoPlayer";
import { ResourceList } from "./ResourceList";
import { ProgressGate } from "./ProgressGate";
import { clipVariants, studySection, studyStagger } from "./studyMotion";
import { formatDuration, type StudyResource } from "./types";

interface StudySessionViewProps {
  sessionId: string;
  subtopicId: string;
  initialStatus: string;
  /** Seconds spent on this page, owned by the parent so it survives clip swaps. */
  elapsedSec: number;
  /** Where the learner came from, forwarded to the quiz link in the footer. */
  returnTo: string;
  /** Rendered instead of the player when the subtopic has no videos attached. */
  fallback?: ReactNode;
  /**
   * Fires once the resource list is known. The page uses this to decide whether
   * to keep its own manual completion control: with videos present, completion
   * belongs to the gate, and a second button that bypasses it would make the
   * 80% rule decorative.
   */
  onResourcesLoaded?: (count: number) => void;
  onCompleted?: () => void;
}

interface ResourcesResponse {
  resources: StudyResource[];
}

interface ProgressResponse {
  watchedSec: number;
  lastPosSec: number;
  requiredSec: number;
  durationSec: number;
  completedAt: string | null;
}

/**
 * The study screen: player on the left, lesson contents on the right, progress
 * footer across the bottom.
 *
 * Local progress is never treated as truth. Every heartbeat's response
 * overwrites the local figure with the server's, so a client-side count that
 * has drifted — or been tampered with — is corrected within ten seconds.
 */
export function StudySessionView({
  sessionId,
  subtopicId,
  initialStatus,
  elapsedSec,
  returnTo,
  fallback,
  onResourcesLoaded,
  onCompleted,
}: StudySessionViewProps) {
  const reduceMotion = useReducedMotion();

  const [resources, setResources] = useState<StudyResource[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // +1 when moving to a later clip, -1 when going back. Drives which way the
  // caption block slides so the motion matches the navigation.
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/subtopics/${subtopicId}/resources`)
      .then((res) => {
        if (!res.ok) throw new Error("Couldn't load the videos for this session.");
        return res.json() as Promise<ResourcesResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        setResources(data.resources);
        // Open on the first unfinished item, so returning to a session resumes
        // rather than restarts.
        const next = data.resources.find((r) => r.completedAt === null) ?? data.resources[0];
        setActiveId(next?.id ?? null);
        onResourcesLoaded?.(data.resources.length);
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // onResourcesLoaded is a render-scoped callback; re-running this effect for
    // a new identity would refetch on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtopicId]);

  const activeIndex = useMemo(
    () => resources.findIndex((r) => r.id === activeId),
    [resources, activeId]
  );
  const active = activeIndex >= 0 ? resources[activeIndex] : null;

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= resources.length) return;
      setDirection(index > activeIndex ? 1 : -1);
      setActiveId(resources[index].id);
    },
    [resources, activeIndex]
  );

  const selectById = useCallback(
    (id: string) => {
      const index = resources.findIndex((r) => r.id === id);
      goTo(index);
    },
    [resources, goTo]
  );

  const handleProgress = useCallback(
    async (progress: VideoProgress) => {
      if (!activeId) return;
      try {
        const saved = await postJson<ProgressResponse>(
          `/api/resources/${activeId}/progress`,
          progress,
          // The final beat fires as the tab is closing; without keepalive the
          // browser cancels it and that stretch of watching is lost.
          { keepalive: true }
        );

        setResources((prev) =>
          prev.map((r) =>
            r.id === activeId
              ? {
                  ...r,
                  watchedSec: saved.watchedSec,
                  lastPosSec: saved.lastPosSec,
                  completedAt: saved.completedAt,
                }
              : r
          )
        );
      } catch {
        // A dropped heartbeat isn't worth interrupting playback over: the next
        // one carries the same cumulative total, so nothing is permanently lost.
      }
    },
    [activeId]
  );

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
          role="status"
          aria-label="Loading videos"
        />
      </div>
    );
  }

  if (loadError) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
      >
        {loadError}
      </p>
    );
  }

  if (resources.length === 0) return <>{fallback}</>;

  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex >= 0 && activeIndex < resources.length - 1;

  return (
    <>
      <motion.div
        variants={studyStagger}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]"
      >
        {/* ── Player column ─────────────────────────────────────────────── */}
        <motion.div variants={studySection} className="flex flex-col gap-4">
          {active && (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    Video {activeIndex + 1} of {resources.length}
                  </p>
                  <h2 className="mt-0.5 truncate text-lg font-bold text-foreground">
                    {active.title}
                  </h2>
                </div>
                <span className="shrink-0 rounded-full bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary">
                  {formatDuration(active.durationSec)}
                </span>
              </div>

              <div className="px-5">
                <VideoPlayer
                  // Keyed on the resource so switching clips remounts rather
                  // than mutating a live player — the teardown in VideoPlayer's
                  // effect is what stops the previous polling loop.
                  key={active.id}
                  youtubeId={active.youtubeId}
                  title={active.title}
                  initialWatchedSec={active.watchedSec}
                  startSeconds={active.lastPosSec}
                  onProgress={handleProgress}
                  onEnded={() => hasNext && goTo(activeIndex + 1)}
                />
              </div>

              {/* Clip navigation. The frame above holds still through a swap —
                  only this strip animates — because moving an iframe while it
                  reloads makes the player flicker. */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <button
                  type="button"
                  onClick={() => hasNext && goTo(activeIndex + 1)}
                  disabled={!hasNext}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <SkipForward className="h-3.5 w-3.5" aria-hidden />
                  Skip this video
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goTo(activeIndex - 1)}
                    disabled={!hasPrev}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(activeIndex + 1)}
                    disabled={!hasNext}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                      hasNext
                        ? "bg-primary text-white hover:bg-primary-dark"
                        : "cursor-not-allowed bg-muted text-muted-foreground"
                    )}
                  >
                    Next video
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Attribution. Khan publishes under CC BY-NC-SA and the licence asks
              for credit and a link back; the channel name comes from the API
              rather than being hard-coded, so a clip from anywhere else credits
              its own author. */}
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            {active && (
              <motion.div
                key={active.id}
                custom={direction}
                variants={reduceMotion ? undefined : clipVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3"
              >
                <p className="text-xs text-muted-foreground">
                  Content by{" "}
                  <span className="font-semibold text-foreground">{active.channelTitle}</span>
                </p>
                <a
                  href={`https://www.youtube.com/watch?v=${active.youtubeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Watch on YouTube
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Contents column ───────────────────────────────────────────── */}
        <motion.div variants={studySection}>
          <ResourceList
            resources={resources}
            activeResourceId={activeId}
            onSelect={selectById}
          />
        </motion.div>
      </motion.div>

      <ProgressGate
        sessionId={sessionId}
        subtopicId={subtopicId}
        resources={resources}
        isCompleted={status === "COMPLETED"}
        elapsedSec={elapsedSec}
        returnTo={returnTo}
        onCompleted={() => {
          setStatus("COMPLETED");
          onCompleted?.();
        }}
      />
    </>
  );
}

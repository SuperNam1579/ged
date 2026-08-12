"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadYouTubeIframeApi,
  PlayerState,
  type YTPlayer,
  type YTPlayerEvent,
} from "@/lib/youtube/iframe-api";

export interface VideoProgress {
  watchedSec: number;
  lastPosSec: number;
}

interface VideoPlayerProps {
  youtubeId: string;
  title: string;
  /** Cumulative seconds already watched, so the counter resumes rather than restarts. */
  initialWatchedSec?: number;
  /** Where to resume playback from. */
  startSeconds?: number;
  /** Called every ~10 s while playing, and once more whenever playback stops. */
  onProgress: (progress: VideoProgress) => void;
  onEnded?: () => void;
}

/** How often progress is handed to the parent, in seconds. */
const REPORT_EVERY_SEC = 10;

/**
 * Ceiling on the watch time a single 1 s tick may contribute.
 *
 * Timers do not fire while a tab is backgrounded and then fire late, so a raw
 * wall-clock delta can be minutes wide. Capping each tick keeps a
 * backgrounded tab from banking watch time it never played. 2 s covers 2x
 * playback plus ordinary timer drift.
 */
const MAX_TICK_SEC = 2;

export function VideoPlayer({
  youtubeId,
  title,
  initialWatchedSec = 0,
  startSeconds = 0,
  onProgress,
  onEnded,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const watchedRef = useRef(initialWatchedSec);
  const lastPosRef = useRef(startSeconds);
  const lastTickRef = useRef<number | null>(null);
  const sinceReportRef = useRef(0);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Held in a ref so that a parent re-render with a fresh callback identity does
  // not tear down and rebuild the player.
  const onProgressRef = useRef(onProgress);
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onProgressRef.current = onProgress;
    onEndedRef.current = onEnded;
  }, [onProgress, onEnded]);

  /**
   * Hands the current totals to the parent and resets the report counter.
   *
   * Declared before the effects that call it: the state-change handler and the
   * teardown both fire from inside the player, at moments React does not
   * control, so this has to be a stable reference rather than a closure rebuilt
   * on each render.
   */
  const report = useCallback(() => {
    if (sinceReportRef.current === 0) return;
    sinceReportRef.current = 0;
    onProgressRef.current({
      watchedSec: Math.floor(watchedRef.current),
      lastPosSec: Math.floor(lastPosRef.current),
    });
  }, []);

  // ── Player lifecycle ────────────────────────────────────────────────────
  //
  // Keyed on youtubeId: switching clips destroys the old player first. Skipping
  // that leaves the previous instance alive with its own polling still running,
  // and two players both crediting watch time is exactly how progress starts
  // drifting upward for no reason.
  useEffect(() => {
    let cancelled = false;
    const mountPoint = containerRef.current;
    if (!mountPoint) return;

    watchedRef.current = initialWatchedSec;
    lastPosRef.current = startSeconds;
    sinceReportRef.current = 0;
    lastTickRef.current = null;
    setStatus("loading");
    setErrorMessage(null);

    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current) return;

        playerRef.current = new YT.Player(containerRef.current, {
          videoId: youtubeId,
          playerVars: {
            // Without an explicit origin the player's postMessage channel is
            // rejected as cross-origin, and every call that has to cross it —
            // getCurrentTime() included — silently returns nothing.
            origin: window.location.origin,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            start: Math.floor(startSeconds),
          },
          events: {
            onReady: () => {
              if (!cancelled) setStatus("ready");
            },
            onStateChange: (e: YTPlayerEvent) => {
              if (e.data === PlayerState.PLAYING) {
                lastTickRef.current = Date.now();
              } else {
                // Stop accumulating, and flush what we have so a pause or a
                // seek is not lost if the learner then closes the tab.
                lastTickRef.current = null;
                report();
              }
              if (e.data === PlayerState.ENDED) onEndedRef.current?.();
            },
            onError: (e: YTPlayerEvent) => {
              if (cancelled) return;
              setStatus("error");
              setErrorMessage(describePlayerError(e.data));
            },
          },
        });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(err.message);
      });

    return () => {
      cancelled = true;
      // Flush before tearing down, or the last stretch of watching is discarded.
      report();
      playerRef.current?.destroy();
      playerRef.current = null;
      if (mountPoint) mountPoint.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeId]);

  // ── Progress accounting ─────────────────────────────────────────────────
  useEffect(() => {
    const id = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;

      let state: number;
      try {
        state = player.getPlayerState();
      } catch {
        return; // player torn down mid-tick
      }

      if (state !== PlayerState.PLAYING) {
        lastTickRef.current = null;
        return;
      }

      const now = Date.now();
      const elapsed = lastTickRef.current ? (now - lastTickRef.current) / 1000 : 0;
      lastTickRef.current = now;

      // Only time spent in PLAYING counts. Scrubbing the seek bar moves
      // getCurrentTime() around freely, so deriving watch time from position
      // deltas would let a learner "watch" a video by dragging the handle.
      watchedRef.current += Math.min(elapsed, MAX_TICK_SEC);

      try {
        lastPosRef.current = player.getCurrentTime();
      } catch {
        /* keep the previous position */
      }

      sinceReportRef.current += Math.min(elapsed, MAX_TICK_SEC);
      if (sinceReportRef.current >= REPORT_EVERY_SEC) report();
    }, 1000);

    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A closed tab fires no interval. pagehide is the last reliable moment to
  // hand over the final numbers.
  useEffect(() => {
    const flush = () => report();
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-slate-900">
      {/* 16:9 box reserved up front so the layout doesn't jump when the iframe lands. */}
      <div className="relative aspect-video w-full">
        <div ref={containerRef} className="absolute inset-0 h-full w-full" />

        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-white"
              role="status"
              aria-label="Loading video"
            />
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900 px-6 text-center">
            <p className="text-sm font-medium text-white">This video can&apos;t be played here</p>
            <p className="text-xs text-slate-400">{errorMessage}</p>
            <a
              href={`https://www.youtube.com/watch?v=${youtubeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 text-xs font-medium text-sky-400 underline underline-offset-2"
            >
              Watch on YouTube
            </a>
          </div>
        )}
      </div>

      <p className="sr-only">{title}</p>
    </div>
  );
}

/**
 * The IFrame API reports failures as bare numeric codes.
 *
 * 101 and 150 are the same condition — the owner disabled embedding — and are
 * the reason the seed script filters on `status.embeddable`. Seeing one here
 * means a resource slipped through that check.
 */
function describePlayerError(code: number): string {
  switch (code) {
    case 2:
      return "The video ID is malformed.";
    case 5:
      return "The video can't be played in this browser.";
    case 100:
      return "The video was removed or made private.";
    case 101:
    case 150:
      return "The owner doesn't allow this video to be embedded.";
    default:
      return `Playback failed (code ${code}).`;
  }
}

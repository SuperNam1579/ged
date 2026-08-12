/**
 * Client-side view of a resource, as returned by
 * GET /api/subtopics/:id/resources.
 *
 * `requiredSec` arrives from the server rather than being derived here. The
 * client needs it to draw the gate, but it must never be the thing that decides
 * where the bar sits — that stays server-side.
 */
export interface StudyResource {
  id: string;
  youtubeId: string;
  title: string;
  channelTitle: string;
  durationSec: number;
  order: number;
  requiredSec: number;
  watchedSec: number;
  lastPosSec: number;
  completedAt: string | null;
}

/** Per-resource breakdown returned by POST /api/sessions/:id/verify-completion. */
export interface CompletionBreakdown {
  resourceId: string;
  title: string;
  watchedSec: number;
  requiredSec: number;
  durationSec: number;
  complete: boolean;
}

/** mm:ss, or h:mm:ss once the clip runs past an hour. */
export function formatDuration(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;

  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

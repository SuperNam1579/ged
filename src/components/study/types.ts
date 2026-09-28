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
  kind: "VIDEO" | "ARTICLE";
  /** Null for articles. */
  youtubeId: string | null;
  /** The article's page on Khan. Null for videos. */
  url: string | null;
  /** Null for videos. */
  wordCount: number | null;
  title: string;
  channelTitle: string;
  durationSec: number;
  /** Curriculum lesson name — the grouping the contents panel draws. "" when unstructured. */
  lesson: string;
  lessonId: string | null;
  /** Curriculum unit the lesson sits in. "" when unstructured. */
  unit: string;
  unitId: string | null;
  order: number;
  /** VIDEO: seconds to watch. ARTICLE: seconds after opening before "read" is accepted. */
  requiredSec: number;
  /** ARTICLE: requiredSec once read, 0 before — so the gate can sum every item alike. */
  watchedSec: number;
  lastPosSec: number;
  completedAt: string | null;
  /** ARTICLE: when the learner first opened it. Null for videos and unopened articles. */
  openedAt: string | null;
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

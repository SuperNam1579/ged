// Shapes for subtopic learning resources and per-user watch progress.
//
// These mirror the Prisma models rather than re-exporting them: the row carries
// timestamps and relations the app has no business passing to a client
// component, and naming the fields consumers may rely on keeps that boundary
// visible. Structural typing means a Prisma row satisfies these directly.
//
// Naming follows the DB convention: seconds are stored as integers with a `Sec`
// suffix, never as floats or as ISO-8601 durations. The YouTube Data API returns
// `PT12M34S`; that is parsed once, at seed time, and never travels past it.

export type ResourceKind = "VIDEO" | "ARTICLE";

/**
 * A learning resource attached to a subtopic: a video we embed, or an article
 * the learner reads on Khan.
 *
 * `id` is derived from the content, not a cuid — `<subtopicId>-<youtubeId>` for
 * a video, `<subtopicId>-a<hash of the URL>` for an article — so items can be
 * inserted or reordered without progress sliding onto the wrong one. See the
 * Resource model in schema.prisma.
 */
export interface Resource {
  id: string;
  subtopicId: string;
  kind: ResourceKind;
  /** The 11-character YouTube video ID — not a full URL. Null for articles. */
  youtubeId: string | null;
  /** The article's page on Khan. Null for videos. */
  url: string | null;
  title: string;
  channelTitle: string;
  /**
   * VIDEO: total length in whole seconds. Completion is decided on the server,
   * and the server cannot ask the browser how long the video is without
   * trusting it, so duration must be known independently of the player.
   *
   * ARTICLE: plain reading time at READING_WPM, from `wordCount`.
   */
  durationSec: number;
  /** Words on an article's page. Null for videos. */
  wordCount: number | null;
  /**
   * The Lesson row this clip belongs to (Subtopic → Unit → Lesson → Resource),
   * from the curriculum sheet. Null only for clips with no curriculum structure.
   */
  lessonId: string | null;
  /** Position within the subtopic's resource list, ascending. */
  order: number;
}

/** One user's watch progress against one resource. */
export interface ResourceProgress {
  resourceId: string;
  /**
   * Cumulative seconds actually watched. Monotonic — it never decreases, and
   * the server clamps how fast it may grow (see the progress route).
   */
  watchedSec: number;
  /** Where to resume playback from. May move backwards when the user seeks. */
  lastPosSec: number;
  /**
   * Set once the item is done — a video's watchedSec crossing the threshold, or
   * an article's "read" accepted by the server. Never unset.
   */
  completedAt: string | null;
  /** Articles: when the learner first opened the page. Null for videos. */
  openedAt: string | null;
}

/** Where a clip sits in the curriculum, by name, for display. */
export interface ResourcePlacement {
  lessonId: string;
  lessonName: string;
  unitId: string;
  unitName: string;
}

/** A resource joined with the requesting user's progress, if any. */
export interface ResourceWithProgress extends Resource {
  progress: ResourceProgress | null;
  placement: ResourcePlacement | null;
}

/**
 * Fraction of a video that must be watched before the subtopic counts as done.
 *
 * Overridable so that local testing does not require sitting through a full
 * clip. Never read this on the client: the completion decision is made
 * server-side, and a client-side copy would only invite it to be trusted.
 */
export const COMPLETION_THRESHOLD = Number(
  process.env.RESOURCE_COMPLETION_THRESHOLD ?? 0.8
);

/** Seconds of video that satisfy the threshold for a given duration. */
export function requiredWatchSec(durationSec: number): number {
  return Math.floor(durationSec * COMPLETION_THRESHOLD);
}

/** Completion test. Server-side only — never call this with a client-sent percentage. */
export function isComplete(watchedSec: number, durationSec: number): boolean {
  if (durationSec <= 0) return false;
  return watchedSec >= requiredWatchSec(durationSec);
}

// ─── Articles ────────────────────────────────────────────────────────────────
//
// Khan doesn't publish reading times, and we can't watch someone read a page in
// another tab, so both the schedule and the "read" button work from the word
// count. Agreed with the team on 2026-09-27; all three numbers live here.

/**
 * Words per minute for silent reading of non-fiction English — the widely used
 * figure from Brysbaert's 2019 meta-analysis of 190 studies.
 */
export const READING_WPM = 238;

/**
 * Slack on top of plain reading time, for slower readers. Applied when the
 * scheduler sizes a session; videos use their own factor (STUDY_TIME_FACTOR).
 */
export const READING_TIME_FACTOR = 1.2;

/**
 * Share of the scheduled reading time that must pass before "read" is accepted.
 * 0.6 of 1.2× works out at about 330 words per minute: anyone reading at a
 * normal pace finds the button ready before they finish, while someone clicking
 * straight through without reading is held back.
 */
export const READ_UNLOCK_FRACTION = 0.6;

/** Plain reading time for an article, in whole seconds (never below 1). */
export function readingSec(wordCount: number): number {
  return Math.max(1, Math.round((wordCount / READING_WPM) * 60));
}

/** Seconds after opening before an article may be marked read. Server-side only. */
export function requiredReadSec(durationSec: number): number {
  return Math.floor(durationSec * READING_TIME_FACTOR * READ_UNLOCK_FRACTION);
}

/** What the gate asks of an item before it counts as done. */
export function requiredSecFor(resource: { kind: ResourceKind; durationSec: number }): number {
  return resource.kind === "ARTICLE"
    ? requiredReadSec(resource.durationSec)
    : requiredWatchSec(resource.durationSec);
}

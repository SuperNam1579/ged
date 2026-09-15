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

/**
 * A learning resource attached to a subtopic. Video-only for now.
 *
 * `id` is `<subtopicId>-<youtubeId>`, not a cuid — identity follows the video
 * rather than its position, so clips can be inserted or reordered without watch
 * progress sliding onto the wrong one. See the Resource model in schema.prisma.
 */
export interface Resource {
  id: string;
  subtopicId: string;
  /** The 11-character YouTube video ID — not a full URL. */
  youtubeId: string;
  title: string;
  channelTitle: string;
  /**
   * Total length of the video, in whole seconds.
   *
   * This is the reason the field exists at all: completion is decided on the
   * server, and the server cannot ask the browser how long the video is without
   * trusting the browser. Duration must be known independently of the player.
   */
  durationSec: number;
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
  /** Set once watchedSec crosses the completion threshold. Never unset. */
  completedAt: string | null;
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

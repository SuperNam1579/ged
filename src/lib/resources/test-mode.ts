// Testing switch for the study page. Server-only: read from the environment at
// request time, so it is turned on and off in the host's settings, not in code.

/**
 * STUDY_SKIP_WATCH_CHECK=1 lets a study session be completed without watching
 * or reading anything first — for people trying the site end to end (the
 * advisor, testers), who shouldn't have to sit through hours of video to see
 * a quiz. Unset it for real use; every check comes back. Parts still complete
 * in order.
 */
export function skipWatchCheck(): boolean {
  const v = (process.env.STUDY_SKIP_WATCH_CHECK ?? "").trim().replace(/^["']|["']$/g, "").toLowerCase();
  return v === "1" || v === "true";
}

/**
 * "Where did I come from?" for pages you enter, finish, and leave.
 *
 * A learner reaches the quiz from the schedule, from a study session, or from
 * the progress page. Sending everyone to the dashboard afterwards throws away
 * whichever of those they were working through — they have to navigate back to
 * the list they were partway down. Hard-coding the destination to `/schedule`
 * instead is the same bug with a different constant: the right answer depends
 * on the route the learner actually took.
 *
 * So the origin travels with them as a `?from=` query parameter, forwarded
 * across each hop (schedule → study → quiz → result). `router.back()` would be
 * simpler but is wrong here: at the end of a quiz, "back" is the question you
 * just answered, not the list you started from — and it does nothing at all for
 * someone who opened the link directly.
 */

const PARAM = "from";

/**
 * Validates a `from` value before it is used as a navigation target.
 *
 * The parameter is attacker-controllable — anyone can send a link with any
 * `?from=` they like — so it must not be able to point off-site. Rejecting
 * anything that doesn't begin with exactly one slash blocks both absolute URLs
 * ("https://evil.example") and protocol-relative ones ("//evil.example"), which
 * browsers resolve as external.
 */
export function safeReturnTo(from: string | null | undefined, fallback: string): string {
  if (!from) return fallback;
  if (!from.startsWith("/") || from.startsWith("//")) return fallback;
  // A backslash after the leading slash is treated as a path separator by some
  // browsers, which reopens the protocol-relative hole.
  if (from.startsWith("/\\")) return fallback;
  return from;
}

/** Appends the origin to a link, so the next page can send the learner back. */
export function withReturnTo(href: string, from: string): string {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}${PARAM}=${encodeURIComponent(from)}`;
}

const LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/schedule": "Schedule",
  "/progress": "Progress",
  "/subjects": "Subjects",
};

/**
 * Human-readable name for a return path, used in back buttons and breadcrumbs.
 *
 * Matching on the pathname alone keeps query strings out of the label, and an
 * unrecognised path falls back to "Back" rather than rendering a raw URL.
 */
export function returnLabel(path: string): string {
  const pathname = path.split("?")[0];
  return LABELS[pathname] ?? "Back";
}

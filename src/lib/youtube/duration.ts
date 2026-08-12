/**
 * Parses an ISO-8601 duration into whole seconds.
 *
 * The YouTube Data API reports lengths as `PT1H2M3S`, omitting any zero
 * component — so `PT45S`, `PT4M`, and `PT2H` are all valid and all have to
 * parse. Live streams report `P0D`, which yields 0; callers filter those out
 * rather than storing a video nothing can be measured against.
 *
 * Lives here rather than in the seed script so the parse rule and the tests
 * that pin it down don't have to drag a Prisma client along with them.
 */
export function parseIsoDuration(iso: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  const [, d, h, min, s] = m;
  return (
    Number(d ?? 0) * 86400 +
    Number(h ?? 0) * 3600 +
    Number(min ?? 0) * 60 +
    Number(s ?? 0)
  );
}

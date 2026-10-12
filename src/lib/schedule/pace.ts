// How hard to load each day. Pure: no Prisma.
//
// Packing fills every day to its free time, so a learner with plenty of time
// finished the content in the first weeks and had nothing after — or, before
// that was changed, months of filler review. The plan instead spreads the
// content over the whole run: each day is loaded to the same share of its free
// time, the smallest share at which everything still fits, raised 10% so the
// GA has room to reorder. A learner short of time gets share 1 (full days),
// exactly as before.

import type { ProficiencyMap, SubtopicData } from "../../types";
import { shortfallOn } from "./feasibility";
import type { Day, WorkItem } from "./parts";

/**
 * The tightest share that fits is raised by this fraction of itself — room for
 * orders other than the greedy one. Relative, not added: at a 10% share, adding
 * 0.1 would double the daily load and finish the content in half the time.
 */
export const PACE_MARGIN = 0.1;

/** Each day's capacity scaled to `share` of it. */
export function scaleDays(days: Day[], share: number): Day[] {
  return days.map((d) => ({ date: d.date, capacity: d.capacity * share }));
}

/**
 * The share of each day's free time to plan content into: 1 when the content
 * needs every minute, less when there is time to spare. Found by laying the
 * content out (the recommended order, packDays) at decreasing shares.
 */
export function paceShare(input: {
  items: WorkItem[];
  /** The days content may go on, at their full free time. */
  days: Day[];
  subtopics: SubtopicData[];
  proficiencies: ProficiencyMap;
}): number {
  const { items, days, subtopics, proficiencies } = input;
  const fits = (share: number) => shortfallOn(items, scaleDays(days, share), subtopics, proficiencies) <= 0.5;
  if (items.length === 0 || !fits(1)) return 1;

  const required = items.reduce((a, i) => a + (i.clips.length ? i.clips.reduce((n, c) => n + c.minutes, 0) : i.atomicMinutes), 0);
  const capacity = days.reduce((a, d) => a + d.capacity, 0);
  // Below this share a day can't hold the longest clip, and packDays would put
  // it in anyway — on its own, over the target — so the spreading would be fake.
  const longestClip = Math.max(0, ...items.flatMap((i) => i.clips.map((c) => c.minutes)));
  const shortestDay = Math.min(...days.filter((d) => d.capacity > 0).map((d) => d.capacity));
  const floor = Number.isFinite(shortestDay) ? longestClip / shortestDay : 0;
  let lo = Math.min(1, Math.max(0.01, required / capacity, floor)); // can't fit below this
  let hi = 1;
  if (fits(lo)) hi = lo;
  else {
    for (let i = 0; i < 12 && hi - lo > 0.005; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
  }
  return Math.min(1, hi * (1 + PACE_MARGIN));
}

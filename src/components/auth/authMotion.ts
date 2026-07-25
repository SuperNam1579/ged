import type { Variants } from "motion/react";

/** Container that reveals its children one after another. */
export const authStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

/** A single staggered item — fades and slides up into place. */
export const authItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

/**
 * Direction-aware step transition. `custom` is the direction: +1 when moving
 * forward (new step enters from the right) and -1 when going back (enters from
 * the left). Mirrors the `_dir` flag in the reference design.
 */
export const stepVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -28, transition: { duration: 0.2, ease: "easeIn" } }),
};

/* ──────────────────────────────────────────────────────────────────────────
 * Login ↔ register page transition.
 *
 * The variant sets below are driven by the (auth) layout: it owns the
 * `enter`/`center`/`exit` labels and each page's parts inherit them through
 * motion's variant propagation. The parallax comes from the layers moving by
 * different amounts — the form travels the full distance (foreground) while the
 * mascot panel holds still (backdrop), so nick↔nam reads as one character
 * morphing in place rather than two images swapping.
 *
 * Two hard constraints shape everything here:
 *
 * 1. No `scale` or `rotate`. Scaling or rotating rasterised content makes the
 *    compositor resample it, which left the mascot and form text visibly soft —
 *    and because the inline transform survives the animation, the softness
 *    persisted afterwards. Translation at an integer offset never resamples.
 *
 * 2. Nothing that owns the background may fade. `mode="wait"` holds the incoming
 *    page until the outgoing one has left, so fading a full-bleed layer toward 0
 *    exposes the page background for that beat — the white flash. Only the
 *    mascot fades, and it does so over its own opaque panel.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Outermost wrapper — a pure orchestrator. It animates nothing itself (a
 * transform here would put every page element on one composited layer); it only
 * broadcasts the variant labels, and AnimatePresence waits on the descendants
 * below before unmounting.
 */
export const authShellVariants: Variants = {
  enter: {},
  center: {},
  exit: {},
};

/**
 * The mascot — anchored in place, crossfading with a short lift so the swap
 * reads as a morph. Fading is safe here: the panel behind it stays opaque.
 */
export const authMascotVariants: Variants = {
  enter: { opacity: 0, y: 14 },
  center: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1], delay: 0.04 },
  },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2, ease: "easeIn" } },
};

/** Foreground layer (the form) — travels furthest, in the nav direction. */
export const authFormVariants: Variants = {
  enter: (dir: number) => ({ x: dir * 64 }),
  center: {
    x: 0,
    transition: { type: "spring", stiffness: 260, damping: 28, mass: 0.9 },
  },
  // Exits are all 0.2s so AnimatePresence never waits on a straggler, which is
  // what stretched the gap between the two pages.
  exit: (dir: number) => ({ x: dir * -64, transition: { duration: 0.2, ease: "easeIn" } }),
};

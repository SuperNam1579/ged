import type { Variants } from "motion/react";

/**
 * Motion for the study session screen.
 *
 * The screen is something a learner sits in front of for an hour, so the
 * restraint here is deliberate: entrances play once on load, and after that the
 * only thing that moves is the thing that changed — the progress ring, the
 * active row, the panel that just unlocked. Anything that re-animates on every
 * render becomes a twitch in the corner of the eye of someone trying to
 * concentrate.
 *
 * Every component using these also reads `useReducedMotion` and drops to a
 * plain fade, matching the pattern already used in LiveGaDemo.
 */

/** Page container — reveals its sections in sequence on first paint. */
export const studyStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

/** A section of the page: fades and lifts into place. */
export const studySection: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

/** Rows in the content list — a tighter, faster version of the same move. */
export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: "easeOut" } },
};

/**
 * Clip swap inside the player column.
 *
 * `custom` is the direction: +1 for the next clip (enters from the right), -1
 * for the previous one. Only the caption block moves — the video frame itself
 * holds still, because sliding an iframe mid-load makes the player flicker.
 */
export const clipVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24, transition: { duration: 0.18, ease: "easeIn" } }),
};

/** The unlock moment — used once, when the gate opens. */
export const unlockVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 320, damping: 24 },
  },
};

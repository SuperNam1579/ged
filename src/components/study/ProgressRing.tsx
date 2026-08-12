"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils/cn";

interface ProgressRingProps {
  /** 0–100. Values outside the range are clamped. */
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/**
 * Circular progress indicator for the session footer.
 *
 * Drawn as a stroked circle rotated -90° so the arc starts at twelve o'clock
 * rather than three, and animated by `strokeDashoffset` — the arc grows along
 * its own path instead of the whole ring scaling, which is what makes it read
 * as filling up rather than appearing.
 */
export function ProgressRing({
  value,
  size = 48,
  strokeWidth = 4,
  className,
}: ProgressRingProps) {
  const reduceMotion = useReducedMotion();

  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={clamped >= 100 ? "stroke-success" : "stroke-primary"}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reduceMotion ? offset : circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 90, damping: 20, mass: 0.8 }
          }
        />
      </svg>

      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
}

export default function AnimatedNumber({ value, format, className }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = useReducedMotion();
  // Only the very first appearance counts up from 0 — later value changes
  // (e.g. switching weeks, re-fetching data) just snap to the new number so
  // the count-up doesn't replay every time the underlying data changes.
  const hasAnimated = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const render = (n: number) => {
      node.textContent = format ? format(n) : String(n);
    };

    if (prefersReducedMotion || hasAnimated.current) {
      render(value);
      hasAnimated.current = true;
      return;
    }

    hasAnimated.current = true;
    const controls = animate(0, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (latest) => render(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value, format, prefersReducedMotion]);

  return <span ref={ref} className={className}>{format ? format(value) : value}</span>;
}

"use client";

import { motion, type HTMLMotionProps } from "motion/react";

interface RevealProps extends HTMLMotionProps<"div"> {
  delay?: number;
  y?: number;
  amount?: number;
}

/** Drop-in replacement for a plain <div> that fades + slides up once it scrolls into view. */
export default function Reveal({ delay = 0, y = 24, amount = 0.2, transition, ...props }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.5, delay, ease: "easeOut", ...transition }}
      {...props}
    />
  );
}

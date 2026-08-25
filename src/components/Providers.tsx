"use client";

import { SessionProvider } from "next-auth/react";
import { MotionConfig } from "motion/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    /* "user" makes every motion/react animation honor prefers-reduced-motion automatically */
    <MotionConfig reducedMotion="user">
      <SessionProvider>{children}</SessionProvider>
    </MotionConfig>
  );
}

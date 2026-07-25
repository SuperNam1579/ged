"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { authShellVariants } from "@/components/auth/authMotion";

// Login and register are peer screens, not a linear flow — but giving them a
// consistent left/right relationship (register = 0, login = 1) lets the swap
// read as a deliberate directional push instead of a random direction each time.
const ROUTE_ORDER = ["/register", "/login"];

function routeIndex(pathname: string): number {
  const i = ROUTE_ORDER.findIndex((r) => pathname.startsWith(r));
  return i === -1 ? 0 : i;
}

/**
 * Shared layout for /login and /register. Persists across navigation between
 * the two (Next.js route groups don't add to the URL), so AnimatePresence can
 * animate the outgoing page out and the incoming one in — a real "page
 * transition" instead of an instant swap.
 *
 * This wrapper only crossfades. The parallax lives in the pages themselves:
 * their panel / mascot / form are motion components whose variants inherit the
 * enter/center/exit label set here, each moving by a different amount. `custom`
 * propagates down the same way, so every layer agrees on the direction.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentIndex = routeIndex(pathname);

  // Track the previous route index as state (not a ref) so the direction can
  // be derived safely during render — React explicitly allows conditionally
  // calling setState mid-render to store "previous render" info, unlike
  // mutating a ref, which the newer react-hooks/refs rule now forbids.
  const [prevIndex, setPrevIndex] = useState(currentIndex);
  const [dir, setDir] = useState(1);

  if (currentIndex !== prevIndex) {
    setDir(currentIndex >= prevIndex ? 1 : -1);
    setPrevIndex(currentIndex);
  }

  return (
    // overflow-x: clip keeps the brief off-screen drift from spawning a
    // horizontal scrollbar, without turning this into a vertical scroll
    // container (so a tall register form still scrolls the page normally).
    <div style={{ overflowX: "clip" }}>
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={pathname}
          custom={dir}
          variants={authShellVariants}
          initial="enter"
          animate="center"
          exit="exit"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

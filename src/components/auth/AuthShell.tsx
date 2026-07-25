"use client";

import { motion } from "motion/react";
import { ArrowLeft, BookOpen } from "lucide-react";

interface AuthShellProps {
  children: React.ReactNode;
  /** When provided, renders a back arrow at the top-left of the card. */
  onBack?: () => void;
}

/**
 * Shared shell for the auth code screens (forgot / reset / verify): the logo
 * plus a card that fades and lifts in on mount. Keeps the entrance animation
 * identical across the three pages.
 */
export default function AuthShell({ children, onBack }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex items-center gap-2.5 mb-8"
      >
        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-feather)" }}>
          GED Prep
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md bg-card rounded-2xl shadow-sm border border-border p-8"
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="mb-4 -ml-1 w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        {children}
      </motion.div>
    </div>
  );
}

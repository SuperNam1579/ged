"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ToastProps {
  message: string;
  show: boolean;
  variant?: "success" | "error";
}

// Fixed, bottom-center confirmation toast — the shared replacement for the
// small inline "Saved!" texts that were scattered (and inconsistently styled)
// across several pages.
export default function Toast({ message, show, variant = "success" }: ToastProps) {
  return (
    <div aria-live="polite" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-foreground text-background shadow-xl max-w-sm"
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 500, damping: 20 }}
              className={cn(
                "flex items-center justify-center w-5 h-5 rounded-full shrink-0",
                variant === "success" ? "bg-success" : "bg-danger"
              )}
            >
              {variant === "success"
                ? <Check className="w-3.5 h-3.5 text-white" />
                : <AlertCircle className="w-3.5 h-3.5 text-white" />}
            </motion.span>
            <span className="text-sm font-medium">{message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

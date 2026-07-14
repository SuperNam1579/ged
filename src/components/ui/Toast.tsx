"use client";

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
    <div
      aria-live="polite"
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300",
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
      )}
    >
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-foreground text-background shadow-xl max-w-sm">
        <span
          className={cn(
            "flex items-center justify-center w-5 h-5 rounded-full shrink-0",
            variant === "success" ? "bg-success" : "bg-danger"
          )}
        >
          {variant === "success"
            ? <Check className="w-3.5 h-3.5 text-white" />
            : <AlertCircle className="w-3.5 h-3.5 text-white" />}
        </span>
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}

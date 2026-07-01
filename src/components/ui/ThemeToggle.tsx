"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ThemeToggleProps {
  className?: string;
  /** Show a text label next to the icon (e.g. inside an expanded sidebar). */
  showLabel?: boolean;
}

export default function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — theme is only known on the client.
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  const toggle = () => setTheme(isDark ? "light" : "dark");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted ? (isDark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-border bg-card text-foreground",
        "px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      {/* Render both icons; toggle visibility only after mount to prevent flash. */}
      <span className="relative flex h-5 w-5 items-center justify-center">
        <Sun
          className={cn(
            "absolute h-5 w-5 text-gold transition-all",
            mounted && !isDark ? "scale-100 opacity-100" : "scale-0 opacity-0"
          )}
        />
        <Moon
          className={cn(
            "absolute h-5 w-5 text-accent transition-all",
            mounted && isDark ? "scale-100 opacity-100" : "scale-0 opacity-0"
          )}
        />
      </span>
      {showLabel && (
        <span className="whitespace-nowrap">
          {mounted ? (isDark ? "Dark" : "Light") : "Theme"}
        </span>
      )}
    </button>
  );
}

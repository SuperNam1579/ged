"use client";

import { cn } from "@/lib/utils/cn";

interface ProgressBarProps {
  value: number; // 0–100
  label?: string;
  showPercent?: boolean;
  variant?: "blue" | "green" | "orange" | "red";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const colors = {
  blue: "bg-blue-600",
  green: "bg-green-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
};

const heights = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-4",
};

function getAutoColor(value: number): keyof typeof colors {
  if (value >= 80) return "green";
  if (value >= 60) return "blue";
  if (value >= 40) return "orange";
  return "red";
}

export default function ProgressBar({
  value,
  label,
  showPercent = true,
  variant,
  size = "md",
  className,
}: ProgressBarProps) {
  const color = variant ?? getAutoColor(value);
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("w-full", className)}>
      {(label || showPercent) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
          {showPercent && (
            <span className="text-sm font-semibold text-gray-900">{Math.round(clamped)}%</span>
          )}
        </div>
      )}
      <div className={cn("w-full bg-gray-100 rounded-full overflow-hidden", heights[size])}>
        <div
          className={cn("rounded-full transition-all duration-500 ease-out", colors[color], heights[size])}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils/cn";

interface DifficultyDotsProps {
  level: number; // 1–5
  className?: string;
}

export default function DifficultyDots({ level, className }: DifficultyDotsProps) {
  return (
    <div className={cn("flex items-center gap-0.5", className)} title={`Difficulty: ${level}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            i < level ? "bg-blue-500" : "bg-gray-200"
          )}
        />
      ))}
    </div>
  );
}

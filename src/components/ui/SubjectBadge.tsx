import { cn } from "@/lib/utils/cn";

interface SubjectBadgeProps {
  code: string;
  name?: string;
  className?: string;
}

const subjectStyles: Record<string, string> = {
  MATH: "bg-primary/15 text-primary",
  RLA: "bg-success/15 text-success",
  SS: "bg-warning/15 text-warning",
  SCI: "bg-accent/15 text-accent",
};

const subjectNames: Record<string, string> = {
  MATH: "Math",
  RLA: "Language Arts",
  SS: "Social Studies",
  SCI: "Science",
};

export default function SubjectBadge({ code, name, className }: SubjectBadgeProps) {
  const style = subjectStyles[code] ?? "bg-muted text-muted-foreground";
  const label = name ?? subjectNames[code] ?? code;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold",
        style,
        className
      )}
    >
      {label}
    </span>
  );
}

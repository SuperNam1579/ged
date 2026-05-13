import { cn } from "@/lib/utils/cn";

interface SubjectBadgeProps {
  code: string;
  name?: string;
  className?: string;
}

const subjectStyles: Record<string, string> = {
  MATH: "bg-blue-100 text-blue-700",
  RLA: "bg-green-100 text-green-700",
  SS: "bg-orange-100 text-orange-700",
  SCI: "bg-purple-100 text-purple-700",
};

const subjectNames: Record<string, string> = {
  MATH: "Math",
  RLA: "Language Arts",
  SS: "Social Studies",
  SCI: "Science",
};

export default function SubjectBadge({ code, name, className }: SubjectBadgeProps) {
  const style = subjectStyles[code] ?? "bg-gray-100 text-gray-700";
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

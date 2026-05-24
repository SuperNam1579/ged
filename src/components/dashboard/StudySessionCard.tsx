"use client";

import Link from "next/link";
import { Clock, ExternalLink, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import SubjectBadge from "@/components/ui/SubjectBadge";
import DifficultyDots from "@/components/ui/DifficultyDots";
import Button from "@/components/ui/Button";

interface StudySessionCardProps {
  id: string;
  subtopicId: string;
  subtopicName: string;
  subjectCode: string;
  topicName: string;
  durationMins: number;
  difficultyLevel: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
  learningUrl: string;
}

export default function StudySessionCard({
  id,
  subtopicId,
  subtopicName,
  subjectCode,
  topicName,
  durationMins,
  difficultyLevel,
  status,
  learningUrl,
}: StudySessionCardProps) {
  const isCompleted = status === "COMPLETED";

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl border transition-colors",
        isCompleted
          ? "bg-gray-50 border-gray-200 opacity-75"
          : "bg-white border-gray-200 hover:border-blue-200 hover:shadow-sm"
      )}
    >
      {/* Status indicator */}
      <div className="shrink-0">
        {isCompleted ? (
          <CheckCircle className="w-6 h-6 text-green-500" />
        ) : (
          <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <SubjectBadge code={subjectCode} />
          <span className="text-xs text-gray-500">{topicName}</span>
        </div>
        <p className={cn("text-sm font-semibold truncate", isCompleted ? "line-through text-gray-400" : "text-gray-900")}>
          {subtopicName}
        </p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            {durationMins} min
          </span>
          <DifficultyDots level={difficultyLevel} />
        </div>
      </div>

      {/* Actions */}
      {!isCompleted && (
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/study/${id}`}>
            <Button size="sm">Start</Button>
          </Link>
        </div>
      )}
    </div>
  );
}

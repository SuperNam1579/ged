"use client";

import { Info } from "lucide-react";
import { format } from "date-fns";

const REASON_LABELS: Record<string, string> = {
  INITIAL: "initial plan generation",
  QUIZ_FAILURE: "repeated quiz difficulty",
  MOCK_TEST_LOW: "mock test performance",
  SCHEDULE_CHANGE: "schedule change",
  MANUAL_REQUEST: "your request",
};

interface PlanUpdateBannerProps {
  reason: string;
  generatedAt: string;
}

export default function PlanUpdateBanner({ reason, generatedAt }: PlanUpdateBannerProps) {
  if (reason === "INITIAL") return null;

  return (
    <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
      <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-blue-900">Your study plan has been updated</p>
        <p className="text-sm text-blue-700 mt-0.5">
          Updated on {format(new Date(generatedAt), "MMM d, yyyy")} based on{" "}
          <span className="font-medium">{REASON_LABELS[reason] ?? reason}</span>.
          Your new plan focuses more on areas where you need improvement.
        </p>
      </div>
    </div>
  );
}

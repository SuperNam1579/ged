"use client";

import { useState } from "react";
import { RefreshCw, TrendingDown } from "lucide-react";

/**
 * Prompts a rebuild when topics the learner has already quizzed on are still
 * testing below the weakness threshold, and nothing is queued for another pass.
 *
 * The plan is not rebuilt automatically after a bad result, by design. The
 * genetic algorithm is stochastic — identical inputs produce different
 * schedules — so regenerating on every failure would reshuffle the whole week
 * including topics unrelated to the one that was failed, which reads as an
 * unstable app rather than an adaptive one. Putting the rebuild behind a button
 * keeps the schedule stable until the learner chooses to change it.
 */
export default function PlanOutOfDateBanner({
  count,
  onUpdated,
}: {
  /** Topics quizzed on that are still below the weakness threshold. */
  count: number;
  /** Called after a successful rebuild so the dashboard can refetch. */
  onUpdated: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState("");

  if (count < 1) return null;

  const rebuild = async () => {
    setStatus("working");
    setError("");
    try {
      // The generate route enforces CSRF, so fetch a token first.
      const csrfRes = await fetch("/api/csrf");
      const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };

      const res = await fetch("/api/ga/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken ?? "" },
        body: JSON.stringify({ triggerReason: "QUIZ_FAILURE" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't rebuild your schedule. Please try again.");
        setStatus("error");
        return;
      }
      // Leave the button in its working state — the parent refetch replaces this
      // banner, so flipping back to idle would flash an actionable button for a
      // schedule that no longer needs it.
      onUpdated();
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  };

  return (
    <div
      className="mb-5 flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl px-5 py-4"
      style={{ background: "var(--primary-light)", border: "1px solid var(--primary)" }}
    >
      <TrendingDown className="w-5 h-5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-primary">
          {count} {count === 1 ? "topic hasn't" : "topics haven't"} stuck yet
        </p>
        <p className="text-xs text-primary mt-0.5">
          Your quiz results still put {count === 1 ? "it" : "them"} below where you want to be, and
          nothing is queued for another pass. Rebuilding works {count === 1 ? "it" : "them"} back
          into your schedule.
        </p>
        {status === "error" && <p className="text-xs text-danger mt-1.5">{error}</p>}
      </div>
      <button
        type="button"
        onClick={rebuild}
        disabled={status === "working"}
        className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.03] active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
        style={{ background: "var(--primary)" }}
      >
        <RefreshCw className={`w-4 h-4 ${status === "working" ? "animate-spin" : ""}`} />
        {status === "working" ? "Rebuilding…" : "Rebuild schedule"}
      </button>
    </div>
  );
}

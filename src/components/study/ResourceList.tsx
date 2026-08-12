"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, Play, Video } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { listItem, studyStagger } from "./studyMotion";
import { formatDuration, type StudyResource } from "./types";

interface ResourceListProps {
  resources: StudyResource[];
  activeResourceId: string | null;
  onSelect: (resourceId: string) => void;
}

/**
 * The lesson contents panel.
 *
 * Every row states three things a learner asks while working through a
 * subtopic: what it is, how long it takes, and whether they have finished it.
 * Status lives in the leading disc — a tick for done, a play glyph for the clip
 * currently open, the position number otherwise — so the column scans
 * vertically without reading any labels.
 */
export function ResourceList({ resources, activeResourceId, onSelect }: ResourceListProps) {
  const reduceMotion = useReducedMotion();

  const completed = resources.filter((r) => r.completedAt !== null).length;
  const totalSec = resources.reduce((sum, r) => sum + r.durationSec, 0);

  if (resources.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No videos are attached to this subtopic yet.
        </p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="border-b border-border px-5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-bold text-foreground">Lesson contents</h2>
          <span className="text-xs text-muted-foreground">
            {resources.length} videos · {formatDuration(totalSec)}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${(completed / resources.length) * 100}%` }}
              transition={
                reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 110, damping: 22 }
              }
            />
          </div>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {completed} of {resources.length} done
          </span>
        </div>
      </header>

      <motion.ol
        variants={studyStagger}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        className="max-h-[28rem] divide-y divide-border overflow-y-auto"
      >
        {resources.map((resource, index) => {
          const isActive = resource.id === activeResourceId;
          const isComplete = resource.completedAt !== null;

          // Measured against requiredSec, not durationSec: the bar should read
          // full when the learner has done what is asked of them, not when the
          // video happens to end.
          const percent =
            resource.requiredSec > 0
              ? Math.min(100, (resource.watchedSec / resource.requiredSec) * 100)
              : 0;

          return (
            <motion.li key={resource.id} variants={listItem}>
              <button
                type="button"
                onClick={() => onSelect(resource.id)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors",
                  isActive ? "bg-primary-light" : "hover:bg-muted/60"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    isComplete
                      ? "bg-success text-white"
                      : isActive
                        ? "bg-primary text-white"
                        : "border border-border text-muted-foreground"
                  )}
                >
                  {isComplete ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : isActive ? (
                    <Play className="h-3 w-3 fill-current" aria-hidden />
                  ) : (
                    index + 1
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-sm leading-snug",
                      isActive ? "font-semibold text-primary" : "font-medium text-foreground"
                    )}
                  >
                    {resource.title}
                  </span>

                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Video className="h-2.5 w-2.5" aria-hidden />
                      Video
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(resource.durationSec)}
                    </span>
                  </span>

                  {/* Only drawn once there is progress, so untouched rows stay quiet. */}
                  {percent > 0 && !isComplete && (
                    <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary transition-[width] duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </span>
                  )}
                </span>
              </button>
            </motion.li>
          );
        })}
      </motion.ol>
    </section>
  );
}

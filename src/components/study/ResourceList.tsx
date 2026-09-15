"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Check, ChevronDown, Divide, Hash, Percent, Play, Ruler, Shapes,
  Sigma, Spline, SquareRadical, Target,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { listItem, studyStagger } from "./studyMotion";
import { formatDuration, type StudyResource } from "./types";

interface ResourceListProps {
  resources: StudyResource[];
  activeResourceId: string | null;
  onSelect: (resourceId: string) => void;
}

/** One curriculum lesson and the clips filed under it, in curriculum order. */
interface LessonGroup {
  /** Stable identity: the Lesson ID, or a positional key for unstructured clips. */
  key: string;
  name: string;
  /** Unit the lesson sits in; "" when unstructured. */
  unit: string;
  resources: StudyResource[];
  completed: number;
  totalSec: number;
}

/**
 * Lesson badges.
 *
 * The glyph carries no meaning on its own — it is a landmark, so that a learner
 * scrolling a 32-lesson subtopic recognises where they were by shape and colour
 * before they have read a word. Assignment is by position, so it stays put for a
 * given subtopic across visits.
 */
const LESSON_ICONS = [
  Sigma, Divide, SquareRadical, Percent, Hash, Shapes, Ruler, Spline, Target,
] as const;

const LESSON_TINTS = [
  "bg-blue-50 text-blue-600 ring-blue-100",
  "bg-emerald-50 text-emerald-600 ring-emerald-100",
  "bg-violet-50 text-violet-600 ring-violet-100",
  "bg-amber-50 text-amber-600 ring-amber-100",
  "bg-rose-50 text-rose-600 ring-rose-100",
  "bg-teal-50 text-teal-600 ring-teal-100",
] as const;

/**
 * Groups clips into contiguous lessons, in curriculum order.
 *
 * Keyed by Lesson ID, not by name. Lesson names repeat across units —
 * "Equivalent fractions" is a lesson in both Unit 4 and Unit 9 of Fractions —
 * and grouping by name folded the two into one group sitting in the wrong place.
 */
function groupByLesson(resources: StudyResource[]): LessonGroup[] {
  const groups: LessonGroup[] = [];

  for (const [i, r] of resources.entries()) {
    // A clip with no lesson recorded still has to appear somewhere, and a
    // catch-all group is more honest than filing it under a neighbour.
    const key = r.lessonId ?? "unstructured";
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = {
        key: groups.some((g) => g.key === key) ? `${key}#${i}` : key,
        name: r.lesson?.trim() || "Other videos",
        unit: r.unit ?? "",
        resources: [],
        completed: 0,
        totalSec: 0,
      };
      groups.push(group);
    }
    group.resources.push(r);
    group.totalSec += r.durationSec;
    if (r.completedAt !== null) group.completed++;
  }

  return groups;
}

/**
 * The lesson contents panel.
 *
 * Clips are grouped by the curriculum lesson they belong to and every group
 * collapses, because subtopics are not small: Fractions alone is 91 clips across
 * 32 lessons. Flat, that is an undifferentiated wall of near-identical Khan
 * titles with no sign of where one idea ends and the next begins. Grouped, the
 * same list is a dozen-odd named steps a learner can hold in their head.
 *
 * The group holding the clip on screen opens itself and the others shut, so the
 * panel always shows where the learner is without them managing it. Any group
 * they open or close by hand keeps that state regardless.
 */
export function ResourceList({ resources, activeResourceId, onSelect }: ResourceListProps) {
  const reduceMotion = useReducedMotion();

  const groups = useMemo(() => groupByLesson(resources), [resources]);

  const activeLesson = useMemo(
    () => groups.find((g) => g.resources.some((r) => r.id === activeResourceId))?.key ?? null,
    [groups, activeResourceId]
  );

  // Only the groups the learner has actually clicked are recorded. Everything
  // else follows the player: the lesson being watched is open, the rest are shut.
  // Storing the overrides rather than the open set is what lets the panel track
  // playback without an effect fighting the learner's own clicks — collapse the
  // playing lesson and it stays collapsed, open another and it stays open.
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());

  const isExpanded = (key: string) => overrides.get(key) ?? key === activeLesson;

  // Reads `prev`, not the render's `overrides`, so two toggles batched into one
  // render don't both start from the same stale map.
  const toggle = (key: string) =>
    setOverrides((prev) => new Map(prev).set(key, !(prev.get(key) ?? key === activeLesson)));

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
          <span className="shrink-0 text-xs text-muted-foreground">
            {groups.length} {groups.length === 1 ? "lesson" : "lessons"} ·{" "}
            {formatDuration(totalSec)}
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
        className="max-h-[32rem] divide-y divide-border overflow-y-auto"
      >
        {groups.map((group, groupIndex) => {
          const Icon = LESSON_ICONS[groupIndex % LESSON_ICONS.length];
          const tint = LESSON_TINTS[groupIndex % LESSON_TINTS.length];
          const isOpen = isExpanded(group.key);
          const isActive = group.key === activeLesson;
          // Name the unit where a new one starts, so the list reads as
          // "Unit 9 → its lessons" rather than an undifferentiated run.
          const startsUnit = group.unit !== "" && group.unit !== groups[groupIndex - 1]?.unit;
          const isDone = group.completed === group.resources.length;
          const panelId = `lesson-panel-${groupIndex}`;

          return (
            <motion.li key={group.key} variants={listItem}>
              {startsUnit && (
                <p className="bg-muted/40 px-4 pb-1.5 pt-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  {group.unit}
                </p>
              )}
              <h3>
                <button
                  type="button"
                  onClick={() => toggle(group.key)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors",
                    isActive ? "bg-primary-light/50" : "hover:bg-muted/60"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1",
                      isDone ? "bg-success text-white ring-success/30" : tint
                    )}
                  >
                    {isDone ? (
                      <Check className="h-4 w-4" aria-hidden />
                    ) : (
                      <Icon className="h-4 w-4" aria-hidden />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-sm font-semibold leading-snug",
                        isActive ? "text-primary" : "text-foreground"
                      )}
                    >
                      {group.name}
                    </span>

                    <span className="mt-1.5 flex items-center gap-2">
                      <span className="h-1 w-20 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn(
                            "block h-full rounded-full transition-[width] duration-500",
                            isDone ? "bg-success" : "bg-primary"
                          )}
                          style={{
                            width: `${(group.completed / group.resources.length) * 100}%`,
                          }}
                        />
                      </span>
                      <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                        {group.completed}/{group.resources.length}
                      </span>
                    </span>

                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {group.resources.length}{" "}
                      {group.resources.length === 1 ? "video" : "videos"} ·{" "}
                      {formatDuration(group.totalSec)}
                    </span>
                  </span>

                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                    aria-hidden
                  />
                </button>
              </h3>

              {/* The height is animated rather than switched, so a group opening
                  does not make the rest of the list jump under the pointer. */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    id={panelId}
                    key="panel"
                    initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <ol className="border-t border-border/60 bg-muted/20">
                      {group.resources.map((resource) => (
                        <ClipRow
                          key={resource.id}
                          resource={resource}
                          // Numbered across the subtopic rather than within the
                          // lesson, so the number matches the "Video N of M" the
                          // player shows.
                          position={resource.order + 1}
                          isActive={resource.id === activeResourceId}
                          onSelect={onSelect}
                        />
                      ))}
                    </ol>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </motion.ol>
    </section>
  );
}

/**
 * One clip.
 *
 * Status lives in the leading disc — a tick for done, a play glyph for the clip
 * currently open, the position number otherwise — so the column scans vertically
 * without reading any labels.
 */
function ClipRow({
  resource,
  position,
  isActive,
  onSelect,
}: {
  resource: StudyResource;
  position: number;
  isActive: boolean;
  onSelect: (resourceId: string) => void;
}) {
  const isComplete = resource.completedAt !== null;

  // Measured against requiredSec, not durationSec: the bar should read full when
  // the learner has done what is asked of them, not when the video happens to end.
  const percent =
    resource.requiredSec > 0
      ? Math.min(100, (resource.watchedSec / resource.requiredSec) * 100)
      : 0;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(resource.id)}
        aria-current={isActive ? "true" : undefined}
        className={cn(
          "flex w-full items-start gap-3 py-2.5 pl-6 pr-4 text-left transition-colors",
          isActive ? "bg-primary-light" : "hover:bg-muted/70"
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
            isComplete
              ? "bg-success text-white"
              : isActive
                ? "bg-primary text-white"
                : "border border-border bg-card text-muted-foreground"
          )}
        >
          {isComplete ? (
            <Check className="h-3.5 w-3.5" aria-hidden />
          ) : isActive ? (
            <Play className="h-3 w-3 fill-current" aria-hidden />
          ) : (
            position
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-[13px] leading-snug",
              isActive ? "font-semibold text-primary" : "font-medium text-foreground"
            )}
          >
            {resource.title}
          </span>
          <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
            {formatDuration(resource.durationSec)}
          </span>

          {/* Only drawn once there is progress, so untouched rows stay quiet. */}
          {percent > 0 && !isComplete && (
            <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${percent}%` }}
              />
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

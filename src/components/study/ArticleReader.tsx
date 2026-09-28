"use client";

import { useEffect, useState } from "react";
import { BookOpenText, CheckCircle2, ExternalLink, Timer } from "lucide-react";
import { postJson } from "@/lib/csrf-client";
import { cn } from "@/lib/utils/cn";
import { formatDuration, type StudyResource } from "./types";

interface ArticleReaderProps {
  resource: StudyResource;
  onOpened: (openedAt: string) => void;
  onRead: (completedAt: string) => void;
}

interface OpenResponse {
  openedAt: string | null;
  requiredSec: number;
  completedAt: string | null;
}

interface ReadResponse {
  completedAt: string | null;
  remainingSec: number | null;
}

/**
 * The player-column panel for an article.
 *
 * Articles are read on Khan in a new tab — framed, Khan's login and progress
 * stop working, and the text isn't ours to copy. What stays here is the timer:
 * "Mark as read" unlocks once enough time has passed since the article was
 * opened. The countdown is only a display. The server keeps the opening time
 * and makes the real check, and when the two disagree the server's answer
 * resets the countdown.
 */
export function ArticleReader({ resource, onOpened, onRead }: ArticleReaderProps) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the server says "not yet" and the local clock disagrees; replaces
  // the unlock time derived from openedAt.
  const [unlockOverride, setUnlockOverride] = useState<number | null>(null);

  const isRead = resource.completedAt !== null;
  const openedMs = resource.openedAt ? Date.parse(resource.openedAt) : null;
  const unlockAt = unlockOverride ?? (openedMs !== null ? openedMs + resource.requiredSec * 1000 : null);
  const remainingSec = unlockAt !== null ? Math.max(0, Math.ceil((unlockAt - now) / 1000)) : null;
  const unlocked = remainingSec === 0;

  // Ticks only while there is a countdown to show.
  const counting = !isRead && unlockAt !== null && !unlocked;
  useEffect(() => {
    if (!counting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [counting]);

  const minutes = Math.max(1, Math.round(resource.durationSec / 60));

  // The link opens the page itself, so a popup blocker never sees a script-
  // opened window; the request that starts the timer rides alongside it.
  const handleOpen = () => {
    setError(null);
    postJson<OpenResponse>(`/api/resources/${resource.id}/open`, {}, { keepalive: true })
      .then((res) => {
        // Refresh the clock first: `now` last ticked when the page loaded, and
        // measuring the new countdown from then would overstate it.
        setNow(Date.now());
        if (res.openedAt) onOpened(res.openedAt);
      })
      .catch(() => setError("Couldn't start the reading timer. Open the article again to retry."));
  };

  const handleRead = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<ReadResponse>(`/api/resources/${resource.id}/read`, {});
      if (res.completedAt) {
        onRead(res.completedAt);
      } else if (res.remainingSec !== null) {
        setNow(Date.now());
        setUnlockOverride(Date.now() + res.remainingSec * 1000);
      } else {
        setError("Open the article first — the timer starts when you do.");
      }
    } catch {
      setError("Couldn't save that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-5 pb-5">
      <div className="rounded-xl border border-border bg-muted/30 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
            <BookOpenText className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Read this article on Khan Academy</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              About {minutes} min
              {resource.wordCount ? ` · ${resource.wordCount.toLocaleString()} words` : ""}. It opens in a
              new tab — read it through, then come back here and mark it read.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {resource.url && (
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleOpen}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                resource.openedAt
                  ? "border border-border text-foreground hover:bg-muted"
                  : "bg-primary text-white hover:bg-primary-dark"
              )}
            >
              {resource.openedAt ? "Open again" : "Open on Khan Academy"}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}

          {isRead ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Read
            </span>
          ) : resource.openedAt ? (
            <button
              type="button"
              onClick={handleRead}
              disabled={!unlocked || busy}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                unlocked
                  ? "bg-primary text-white hover:bg-primary-dark"
                  : "cursor-not-allowed bg-muted text-muted-foreground"
              )}
            >
              {unlocked ? (
                <>
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {busy ? "Saving…" : "Mark as read"}
                </>
              ) : (
                <>
                  <Timer className="h-4 w-4" aria-hidden />
                  Mark as read in {formatDuration(remainingSec ?? 0)}
                </>
              )}
            </button>
          ) : null}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

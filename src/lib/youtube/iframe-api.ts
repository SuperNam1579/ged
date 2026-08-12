/**
 * Loads the YouTube IFrame Player API exactly once per page.
 *
 * The script at youtube.com/iframe_api is a loader, not the player: it injects a
 * second, versioned bundle whose URL contains a hash YouTube rotates. That is
 * why it has to be fetched at runtime and can never be vendored into the repo —
 * a copied bundle goes stale the next time they ship.
 *
 * ── Why this module exists at all ─────────────────────────────────────────
 * The documented handshake is a single global, `window.onYouTubeIframeAPIReady`.
 * One global means one owner: if two <VideoPlayer /> instances mount and both
 * assign to it, the second silently overwrites the first and the first player
 * never initialises. So exactly one owner is defined here, and everything else
 * awaits the promise below. `YT.ready()` then gives correct behaviour for every
 * caller that arrives after the API is already live.
 *
 * No API key is involved. This is a script load, not a REST call — the
 * YouTube Data API v3 key belongs to the seed script and must never reach the
 * browser.
 */

export interface YTPlayer {
  destroy(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  playVideo(): void;
  pauseVideo(): void;
}

export interface YTPlayerEvent {
  target: YTPlayer;
  data: number;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement | string,
    options: {
      videoId: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: YTPlayerEvent) => void;
        onStateChange?: (e: YTPlayerEvent) => void;
        onError?: (e: YTPlayerEvent) => void;
      };
    }
  ) => YTPlayer;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
  ready(cb: () => void): void;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Player state codes, mirrored so callers need not wait for YT to load. */
export const PlayerState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

const SCRIPT_SRC = "https://www.youtube.com/iframe_api";
const SCRIPT_ID = "youtube-iframe-api";

let loadPromise: Promise<YTNamespace> | null = null;

export function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("The YouTube IFrame API requires a browser."));
  }

  // Memoised across every player on the page, and across Fast Refresh, which
  // re-runs component modules but leaves this one's state intact.
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<YTNamespace>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    // Chain onto whatever was already registered rather than clobbering it —
    // this module should be the only owner, but a stray assignment elsewhere
    // shouldn't take the page down with it.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      // ready() flushes the loader's internal queue; by the time it fires,
      // window.YT is fully constructed.
      window.YT!.ready(() => resolve(window.YT!));
    };

    if (document.getElementById(SCRIPT_ID)) return; // already in flight

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onerror = () => {
      // Let a later mount retry — a blocked or offline first load should not
      // poison the page for good.
      loadPromise = null;
      reject(new Error("Failed to load the YouTube IFrame API."));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

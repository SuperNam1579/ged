"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Post-sign-in router. Renders nothing of substance and immediately sends the
 * learner to whichever page they actually belong on.
 *
 * Google sign-in used to hand back to `/dashboard` directly. For a brand-new
 * account that is the wrong destination — the dashboard checks for saved
 * preferences, finds none, and bounces to `/onboarding`. But by then it has
 * already mounted its full shell, so the learner watched a sidebar and an
 * empty dashboard appear and vanish on the way to a page that was always
 * where they were going. Sign-in points here instead, and this page owns the
 * decision before any app chrome exists to flash.
 *
 * The spinner is deliberately the bare centred one rather than the dashboard's
 * skeleton: a skeleton implies the thing behind it is what you're getting, and
 * half the people who see this are headed to onboarding.
 */
export default function WelcomePage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    fetch("/api/user/preferences")
      .then((r) => r.json())
      .then((data: { preferences?: unknown }) => {
        if (cancelled) return;
        router.replace(data.preferences ? "/dashboard" : "/onboarding");
      })
      .catch(() => {
        // The preferences call is the only thing this page does, so a failure
        // leaves nothing to show. Onboarding is the safer of the two: it is
        // harmless for someone who has already completed it, whereas the
        // dashboard is unusable for someone who hasn't.
        if (!cancelled) router.replace("/onboarding");
      });

    return () => { cancelled = true; };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
        role="status"
        aria-label="Signing you in"
      />
    </div>
  );
}

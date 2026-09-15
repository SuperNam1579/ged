"use client";

import { signOut } from "next-auth/react";
import { postJson } from "@/lib/csrf-client";

/**
 * Clear every trace of the current app session in the browser before starting
 * a fresh OAuth sign-in.
 *
 * The app has two parallel session mechanisms and getAuthUser() checks the
 * custom `auth-token` cookie BEFORE the NextAuth session. If a stale auth-token
 * (e.g. from a since-deleted account while testing, or a different account in
 * the same browser) is left behind, it shadows the new sign-in and causes
 * 401/404s. So we clear both:
 *   1. auth-token — via our logout endpoint (CSRF double-submit).
 *   2. NextAuth session cookie — via signOut(), so OAuth is treated as a fresh
 *      login rather than "link a provider to whoever is currently signed in".
 */
/**
 * Log the learner out, for the "Log out" button.
 *
 * Unlike clearExistingSession(), this one throws when the server didn't confirm
 * it. The auth-token cookie is httpOnly, so only the server can clear it: a
 * logout that failed but still navigated away would leave the account signed
 * in behind a page that looks signed out. (The sidebar button did exactly that
 * — it posted without the CSRF header, got a 403 every time, and redirected
 * anyway.)
 */
export async function logOut(): Promise<void> {
  // postJson supplies the CSRF header and throws on a non-2xx response.
  await postJson("/api/auth/logout", {});
  try {
    await signOut({ redirect: false });
  } catch {
    // The logout route already deleted the NextAuth cookie server-side.
  }
}

export async function clearExistingSession(): Promise<void> {
  try {
    const res = await fetch("/api/csrf");
    const { csrfToken } = await res.json();
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "x-csrf-token": csrfToken ?? "" },
    });
  } catch {
    // Best effort — continue to signOut regardless.
  }

  try {
    await signOut({ redirect: false });
  } catch {
    // Best effort.
  }
}

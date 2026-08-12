"use client";

/**
 * Browser-side helper for POSTing to CSRF-protected routes.
 *
 * The token is fetched once and reused. The video player posts progress every
 * 10 s, and pairing each of those with a round trip to /api/csrf would double
 * the request count for no benefit — the token is stable for the session.
 *
 * A 403 invalidates the cache and retries once, which covers the case where the
 * token rotated while the page stayed open.
 */

let tokenPromise: Promise<string> | null = null;

function fetchToken(): Promise<string> {
  tokenPromise ??= fetch("/api/csrf")
    .then((res) => res.json())
    .then((json: { csrfToken?: string }) => json.csrfToken ?? "")
    .catch(() => {
      tokenPromise = null;
      return "";
    });
  return tokenPromise;
}

export interface PostOptions {
  /**
   * Keeps the request alive past page teardown. Required for the final
   * progress flush on pagehide — a plain fetch is cancelled when the document
   * goes away, losing the last stretch of watch time.
   *
   * navigator.sendBeacon would survive too, but it cannot set the CSRF header,
   * so keepalive is the option that works with the protection in place.
   */
  keepalive?: boolean;
}

export async function postJson<T>(
  url: string,
  body: unknown,
  options: PostOptions = {}
): Promise<T> {
  const send = async (token: string) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": token },
      body: JSON.stringify(body),
      keepalive: options.keepalive,
    });

  let res = await send(await fetchToken());

  if (res.status === 403) {
    tokenPromise = null;
    res = await send(await fetchToken());
  }

  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `Request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

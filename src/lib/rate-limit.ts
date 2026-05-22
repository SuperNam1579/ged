import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

// ─── Redis singleton ──────────────────────────────────────────────────────
//
// We use Upstash's HTTP client rather than ioredis/redis because serverless
// functions have no persistent TCP connections. Each cold start with a
// traditional Redis client opens a new socket; under any real load this
// exhausts the Redis connection limit within seconds.
// Upstash speaks REST over HTTPS: stateless, no socket, no pool needed.
//
// The client is initialised lazily on first use so that:
//   a) Missing env vars don't crash the build or startup
//   b) Tests / local dev can set RATE_LIMIT_ENABLED=false and skip Redis entirely

let _redis: Redis | null | undefined = undefined; // undefined = not yet initialised

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    _redis = null; // mark as "initialised but unavailable"
    return null;
  }

  _redis = new Redis({ url, token });
  return _redis;
}

// ─── Limiter instance cache ───────────────────────────────────────────────
//
// Ratelimit instances are cached by key within the same Node.js process.
// In long-running environments (next dev, containers) they are created once.
// In serverless, each cold start creates them fresh — that's fine.

const _limiterCache = new Map<string, Ratelimit>();

type Algorithm = "sliding" | "fixed";

function getLimiter(
  key: string,
  algorithm: Algorithm,
  requests: number,
  window: Duration
): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  if (!_limiterCache.has(key)) {
    const limiterFn =
      algorithm === "sliding"
        ? Ratelimit.slidingWindow(requests, window)
        : Ratelimit.fixedWindow(requests, window);

    _limiterCache.set(
      key,
      new Ratelimit({
        redis,
        limiter: limiterFn,
        prefix: `rl:${key}`,     // all rate-limit keys in Redis are namespaced with "rl:"
        analytics: false,         // flip to true to see request graphs in Upstash console
      })
    );
  }

  return _limiterCache.get(key)!;
}

// ─── Per-route configuration ──────────────────────────────────────────────
//
// All rate-limit parameters live here. Change limits in one place — no need
// to touch any route handler.
//
// WHY sliding window for login?
//   Fixed window has a "boundary burst" hole: an attacker can send N requests
//   at 23:59:59 and N more at 00:00:01 — that's 2N attempts in 2 seconds.
//   Sliding window measures from the timestamp of the *oldest* request in the
//   window, so the effective rate never exceeds the stated limit regardless of
//   wall-clock alignment. For brute-force protection this matters.
//
// WHY fixed window for the rest?
//   Registration / email sending abuse is volume-based, not precision-timed.
//   The boundary burst doesn't matter when the window is an hour and the limit
//   is 5 attempts. Fixed window is cheaper in Redis operations (1 INCR vs
//   sliding window's ZRANGEBYSCORE + ZADD + ZREMRANGEBYSCORE).

const RATE_LIMIT_CONFIGS = {
  login: {
    algorithm: "sliding" as Algorithm,
    requests: 5,
    window: "15 m" as Duration,
  },
  register: {
    algorithm: "fixed" as Algorithm,
    requests: 5,
    window: "1 h" as Duration,
  },
  "resend-verification": {
    algorithm: "fixed" as Algorithm,
    requests: 3,
    window: "1 h" as Duration,
  },
  "forgot-password": {
    algorithm: "fixed" as Algorithm,
    requests: 3,
    window: "1 h" as Duration,
  },
} as const;

export type RateLimitKey = keyof typeof RATE_LIMIT_CONFIGS;

// ─── IP extraction ────────────────────────────────────────────────────────
//
// Getting a trustworthy client IP is trickier than it looks.
//
// x-forwarded-for is set by proxies/CDNs and can be spoofed by clients unless
// your infrastructure strips it on ingress. We take the *leftmost* value
// (original client) and skip private RFC-1918 addresses that indicate a
// misconfigured or trusted proxy, not a real client.
//
// IPv6 /64 bucketing: attackers with a /48 block can rotate through ~16 million
// /64 subnets. Using the /64 prefix as the key limits them to one bucket per
// subnet — the smallest allocation typically given to a single customer.

const PRIVATE_RANGES = [
  /^127\./,                          // 127.0.0.0/8  loopback
  /^10\./,                           // 10.0.0.0/8   private
  /^172\.(1[6-9]|2\d|3[01])\./,     // 172.16.0.0/12 private
  /^192\.168\./,                     // 192.168.0.0/16 private
  /^::1$/,                           // IPv6 loopback
  /^f[cd]/i,                         // IPv6 ULA (fc00::/7)
];

function isPrivate(ip: string): boolean {
  return PRIVATE_RANGES.some((re) => re.test(ip));
}

function normalizeIp(ip: string): string {
  // IPv4: use the full address
  if (!ip.includes(":")) return ip;
  // IPv6: use only the first 4 groups (64-bit network prefix)
  // e.g. "2001:db8:85a3:0:0:8a2e:370:7334" → "2001:db8:85a3:0:/64"
  return ip.split(":").slice(0, 4).join(":") + ":/64";
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    if (ip && !isPrivate(ip)) return normalizeIp(ip);
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    const ip = realIp.trim();
    if (!isPrivate(ip)) return normalizeIp(ip);
  }

  return "127.0.0.1"; // local development fallback
}

// ─── Main export ──────────────────────────────────────────────────────────
//
// Usage inside any route handler:
//
//   const limited = await checkRateLimit("login", req);
//   if (limited) return limited;
//
// That's it. The function returns null when the request is allowed, or a
// ready-made 429 NextResponse (with correct headers) when it's blocked.

export async function checkRateLimit(
  key: RateLimitKey,
  req: NextRequest
): Promise<NextResponse | null> {
  // Escape hatch for local dev / tests — set RATE_LIMIT_ENABLED=false in .env
  if (process.env.RATE_LIMIT_ENABLED === "false") return null;

  const config = RATE_LIMIT_CONFIGS[key];
  const limiter = getLimiter(key, config.algorithm, config.requests, config.window);

  if (!limiter) {
    // Redis is not configured. Warn once and allow the request through.
    // To silence this warning in dev, add RATE_LIMIT_ENABLED=false to .env
    console.warn(
      `[rate-limit] Upstash credentials missing — skipping "${key}" check. ` +
      "Set RATE_LIMIT_ENABLED=false to suppress this warning."
    );
    return null;
  }

  const ip = getClientIp(req);

  let result: Awaited<ReturnType<Ratelimit["limit"]>>;
  try {
    result = await limiter.limit(ip);
  } catch (err) {
    // Redis is reachable but returned an error (network blip, timeout, etc.)
    // Fail-open: allow the request rather than taking auth offline.
    // Monitor your logging pipeline for this message — sustained errors mean
    // Redis is degraded and rate limiting is silently disabled.
    console.error(`[rate-limit] Redis error for "${key}" — failing open:`, err);
    return null;
  }

  if (result.success) return null; // within the limit, let the request through

  // Remaining time until the window resets (used for Retry-After header)
  const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));

  return NextResponse.json(
    {
      error: "Too many requests. Please try again later.",
      retryAfter: retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        // Standard header: tells the client how many seconds to wait
        "Retry-After": String(retryAfterSeconds),
        // Informational headers (used by monitoring tools and frontend)
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)), // Unix seconds
      },
    }
  );
}

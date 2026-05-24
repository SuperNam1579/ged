import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import { verifyToken } from "@/lib/auth-edge";
import { NextResponse } from "next/server";

// Lightweight NextAuth instance — edge-safe (no Prisma, no bcrypt).
// Used only to verify the authjs.session-token JWT cookie via AUTH_SECRET.
const { auth } = NextAuth(authConfig);

// Pages that are always accessible without authentication.
const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/check-email",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
]);

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // Static assets — skip immediately.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // All /api/auth/* are public: our custom auth routes + NextAuth's catch-all.
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // Public pages.
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // ── Primary auth check: NextAuth JWT session (authjs.session-token cookie) ──
  if (req.auth?.user) {
    return NextResponse.next();
  }

  // ── Fallback: legacy custom auth-token cookie ─────────────────────────────
  // Users who authenticated before NextAuth was introduced continue to work
  // without being forced to re-login. Remove this block once all sessions have
  // naturally expired (7-day TTL) and the old custom login route is retired.
  const legacyToken = req.cookies.get("auth-token")?.value;
  if (legacyToken) {
    const payload = await verifyToken(legacyToken);

    if (payload) {
      // Preserve revocation checking for API routes on the legacy path.
      if (pathname.startsWith("/api/") && payload.jti) {
        try {
          const checkRes = await fetch(
            new URL("/api/auth/check-revoked", req.url),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jti: payload.jti }),
            }
          );
          if (checkRes.ok) {
            const { revoked } = await checkRes.json();
            if (revoked) {
              return NextResponse.json(
                { error: "Token has been revoked" },
                { status: 401 }
              );
            }
          }
        } catch {
          // Revocation check failed — fail open (prefer availability over blocking).
        }
      }
      return NextResponse.next();
    }

    // Legacy token present but invalid — clear it so the browser isn't stuck
    // with a bad cookie, then fall through to the unauthenticated response.
    const clearCookie = (res: NextResponse) => {
      res.cookies.delete("auth-token");
      return res;
    };

    if (pathname.startsWith("/api/")) {
      return clearCookie(
        NextResponse.json({ error: "Invalid token" }, { status: 401 })
      );
    }
    return clearCookie(NextResponse.redirect(new URL("/login", req.url)));
  }

  // ── Not authenticated ─────────────────────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

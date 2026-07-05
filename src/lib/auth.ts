import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getToken } from "next-auth/jwt";
import { verifyToken } from "./auth-edge";
import { db } from "@/lib/db";

export { verifyToken, signToken } from "./auth-edge";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getAuthUser(
  req: NextRequest
): Promise<{ id: string; email: string; name: string | null } | null> {
  // ── 1. Custom auth-token (set by /api/auth/login) ─────────────────────────
  const authHeader = req.headers.get("authorization");
  const cookieToken = req.cookies.get("auth-token")?.value;
  const legacyToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : cookieToken;

  if (legacyToken) {
    const payload = await verifyToken(legacyToken);
    if (payload?.sub) {
      return {
        id: payload.sub as string,
        email: payload.email as string,
        name: (payload.name as string | null) ?? null,
      };
    }
  }

  // ── 2. NextAuth session (authjs.session-token set by Google OAuth / signIn) ─
  // Handles users who authenticated via NextAuth providers rather than the
  // custom credentials route. No circular dependency: getToken is from the
  // next-auth package, not from our src/auth.ts.
  //
  // getToken derives the cookie name (and JWT salt) from `secureCookie`, which
  // it infers from NEXTAUTH_URL. On production the session cookie is
  // `__Secure-authjs.session-token`, but a misconfigured/absent NEXTAUTH_URL
  // makes getToken look for the unprefixed name and return null — which would
  // 401 every Google user and bounce them back into onboarding. Try both the
  // secure and non-secure variants so resolution works regardless of env.
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  for (const secureCookie of [true, false]) {
    const nextAuthToken = await getToken({ req, secret, secureCookie });
    if (nextAuthToken?.sub) {
      return {
        id: nextAuthToken.sub,
        email: (nextAuthToken.email as string) ?? "",
        name: (nextAuthToken.name as string | null) ?? null,
      };
    }
  }

  return null;
}

export async function getAuthUserStrict(
  req: NextRequest
): Promise<{ id: string; email: string; name: string | null } | null> {
  const authUser = await getAuthUser(req);
  if (!authUser) return null;

  const dbUser = await db.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, email: true, name: true },
  });

  return dbUser;
}

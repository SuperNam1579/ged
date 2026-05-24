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
  const nextAuthToken = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });
  if (nextAuthToken?.sub) {
    return {
      id: nextAuthToken.sub,
      email: (nextAuthToken.email as string) ?? "",
      name: (nextAuthToken.name as string | null) ?? null,
    };
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

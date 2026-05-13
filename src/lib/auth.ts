import { NextRequest } from "next/server";
import * as jose from "jose";
import bcrypt from "bcryptjs";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "dev-secret-change-in-production"
);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signToken(
  payload: Record<string, unknown>
): Promise<string> {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(
  token: string
): Promise<Record<string, unknown> | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function getAuthUser(
  req: NextRequest
): Promise<{ id: string; email: string; name: string } | null> {
  const authHeader = req.headers.get("authorization");
  const cookieToken = req.cookies.get("auth-token")?.value;

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : cookieToken;

  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || !payload.sub) return null;

  return {
    id: payload.sub as string,
    email: payload.email as string,
    name: payload.name as string,
  };
}

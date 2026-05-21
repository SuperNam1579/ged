import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
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

export async function getAuthUserStrict(
  req: NextRequest
): Promise<{ id: string; email: string; name: string } | null> {
  const authUser = await getAuthUser(req);
  if (!authUser) return null;

  const dbUser = await db.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, email: true, name: true },
  });

  return dbUser;
}

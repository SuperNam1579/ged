import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth-edge";
import { db } from "@/lib/db";
import { checkCsrf } from "@/lib/csrf";
import { audit, extractRequestContext } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  const token = req.cookies.get("auth-token")?.value;

  const ctx = extractRequestContext(req);
  let loggedOutUserId: string | null = null;

  if (token) {
    try {
      const payload = await verifyToken(token);
      if (payload?.jti && payload?.sub) {
        loggedOutUserId = payload.sub as string;
        await db.revokedToken.create({
          data: {
            tokenJti: payload.jti as string,
            userId: payload.sub as string,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      }
    } catch {
      // If token is already invalid, just proceed with logout
    }
  }

  audit({
    action: "AUTH_LOGOUT",
    userId: loggedOutUserId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    success: true,
  });

  const response = NextResponse.json({ success: true });

  // Clear the custom credentials cookie AND the NextAuth (Google) session
  // cookie. Previously only auth-token was cleared, so a Google-authenticated
  // session survived "logout" and could bleed into the next person using the
  // same browser. Both the plain and __Secure- prefixed names are cleared so
  // this works in dev (http) and production (https).
  response.cookies.delete("auth-token");
  response.cookies.delete("authjs.session-token");
  response.cookies.delete("__Secure-authjs.session-token");
  return response;
}

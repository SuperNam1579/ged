import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth-edge";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value;

  if (token) {
    try {
      const payload = await verifyToken(token);
      if (payload?.jti && payload?.sub) {
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

  const response = NextResponse.json({ success: true });
  response.cookies.delete("auth-token");
  return response;
}

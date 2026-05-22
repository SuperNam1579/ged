import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { jti } = await req.json();
  if (!jti) return NextResponse.json({ revoked: false });

  const revoked = await db.revokedToken.findUnique({
    where: { tokenJti: jti },
    select: { id: true },
  });

  return NextResponse.json({ revoked: !!revoked });
}

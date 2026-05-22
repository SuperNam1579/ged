import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashVerificationToken } from "@/lib/token";
import { audit, extractRequestContext } from "@/lib/audit";
import { z } from "zod";

const VerifySchema = z.object({
  // Raw token is a 64-character lowercase hex string (32 random bytes)
  token: z.string().length(64).regex(/^[a-f0-9]+$/),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = VerifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid verification token format." },
        { status: 400 }
      );
    }

    const hashed = hashVerificationToken(parsed.data.token);

    const user = await db.user.findFirst({
      where: { emailVerificationToken: hashed },
      select: { id: true, emailVerified: true, emailVerificationExpires: true },
    });

    const ctx = extractRequestContext(req);

    if (!user) {
      // Covers two cases without distinguishing them:
      //   1. Token was already used (cleared from DB after successful verification)
      //   2. Token never existed / was tampered with
      // Not distinguishing prevents confirming whether a token ever existed.
      audit({
        action: "AUTH_EMAIL_VERIFY_FAILED",
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { reason: "INVALID_TOKEN" },
        success: false,
      });
      return NextResponse.json(
        { error: "This verification link is invalid or has already been used." },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      // Defensive: token field should have been nulled on verification, so this
      // path is unreachable in normal operation.
      return NextResponse.json(
        { error: "This email address has already been verified." },
        { status: 409 }
      );
    }

    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      audit({
        action: "AUTH_EMAIL_VERIFY_FAILED",
        userId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { reason: "TOKEN_EXPIRED" },
        success: false,
      });
      return NextResponse.json(
        { error: "This verification link has expired. Please request a new one." },
        { status: 410 }
      );
    }

    // Atomically mark verified and clear the token so it cannot be replayed.
    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    audit({
      action: "AUTH_EMAIL_VERIFIED",
      userId: user.id,
      entityType: "user",
      entityId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      success: true,
    });

    return NextResponse.json({ message: "Email verified successfully." });
  } catch (err) {
    console.error("Verify email error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

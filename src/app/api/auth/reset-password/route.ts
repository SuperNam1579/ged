import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { hashVerificationToken } from "@/lib/token";
import { checkCsrf } from "@/lib/csrf";
import { audit, extractRequestContext } from "@/lib/audit";
import { z } from "zod";

// No rate limiting on this route — the 256-bit token itself is the credential.
// Brute-forcing a 64-character hex token at 1 billion guesses/second would take
// longer than the age of the universe. Expiry (1 h) provides the time bound.

const ResetPasswordSchema = z.object({
  token: z.string().length(64).regex(/^[a-f0-9]+$/),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  try {
    const csrfError = checkCsrf(req);
    if (csrfError) return csrfError;

    const body = await req.json();
    const parsed = ResetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { token, password } = parsed.data;
    const hashed = hashVerificationToken(token);

    const user = await db.user.findFirst({
      where: { passwordResetToken: hashed },
      select: { id: true, passwordResetExpires: true },
    });

    const ctx = extractRequestContext(req);

    if (!user) {
      return NextResponse.json(
        { error: "This reset link is invalid or has already been used." },
        { status: 404 }
      );
    }

    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      audit({
        action: "AUTH_PASSWORD_RESET_FAILED",
        userId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { reason: "TOKEN_EXPIRED" },
        success: false,
      });
      return NextResponse.json(
        { error: "This reset link has expired. Please request a new one." },
        { status: 410 }
      );
    }

    const passwordHash = await hashPassword(password);

    // updateMany with the token in WHERE makes this atomic — if two concurrent
    // requests race, only the first writer matches the row (the second finds the
    // token already nulled) and gets count=1; the second gets count=0 → 404.
    const result = await db.user.updateMany({
      where: { id: user.id, passwordResetToken: hashed },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "This reset link is invalid or has already been used." },
        { status: 404 }
      );
    }

    audit({
      action: "AUTH_PASSWORD_RESET_SUCCESS",
      userId: user.id,
      entityType: "user",
      entityId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      success: true,
    });

    return NextResponse.json({ message: "Password updated successfully. You can now sign in." });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { hashVerificationToken } from "@/lib/token";
import { checkCsrf } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { audit, extractRequestContext } from "@/lib/audit";
import { z } from "zod";

const ResetPasswordSchema = z.object({
  email: z.string().email(),
  // 6-digit numeric OTP
  code: z.string().length(6).regex(/^[0-9]+$/),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  try {
    const csrfError = checkCsrf(req);
    if (csrfError) return csrfError;

    // A 6-digit code is guessable without a cap, so rate-limit reset attempts by
    // IP. (The old flow relied on a 256-bit token being unguessable and skipped
    // this — that assumption no longer holds.)
    const limited = await checkRateLimit("reset-password", req);
    if (limited) return limited;

    const body = await req.json();
    const parsed = ResetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, code, password } = parsed.data;
    const hashed = hashVerificationToken(code);

    const ctx = extractRequestContext(req);

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, passwordResetToken: true, passwordResetExpires: true },
    });

    // Wrong email or wrong code both return the same 404 — no enumeration, and
    // no signal about how close a guessed code was.
    if (!user || !user.passwordResetToken || user.passwordResetToken !== hashed) {
      audit({
        action: "AUTH_PASSWORD_RESET_FAILED",
        userId: user?.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { reason: "INVALID_CODE" },
        success: false,
      });
      return NextResponse.json(
        { error: "That code is incorrect or has already been used." },
        { status: 404 }
      );
    }

    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      audit({
        action: "AUTH_PASSWORD_RESET_FAILED",
        userId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { reason: "CODE_EXPIRED" },
        success: false,
      });
      return NextResponse.json(
        { error: "This reset code has expired. Please request a new one." },
        { status: 410 }
      );
    }

    const passwordHash = await hashPassword(password);

    // updateMany with the code hash in WHERE makes this atomic — if two concurrent
    // requests race, only the first writer matches the row (the second finds the
    // code already nulled) and gets count=1; the second gets count=0 → 404.
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
        { error: "That code is incorrect or has already been used." },
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

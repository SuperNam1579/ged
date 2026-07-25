import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashVerificationToken } from "@/lib/token";
import { checkRateLimit } from "@/lib/rate-limit";
import { audit, extractRequestContext } from "@/lib/audit";
import { z } from "zod";

const VerifySchema = z.object({
  email: z.string().email(),
  // 6-digit numeric OTP
  code: z.string().length(6).regex(/^[0-9]+$/),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP: a 6-digit code has only 1,000,000 possibilities, so
    // capping attempts is what makes brute force infeasible within the short
    // OTP window. Without this, an attacker could exhaust the space quickly.
    const limited = await checkRateLimit("verify-email", req);
    if (limited) return limited;

    const body = await req.json();
    const parsed = VerifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid verification code format." },
        { status: 400 }
      );
    }

    const { email, code } = parsed.data;
    const hashed = hashVerificationToken(code);

    const ctx = extractRequestContext(req);

    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        emailVerificationToken: true,
        emailVerificationExpires: true,
      },
    });

    // Wrong email or wrong code both return the same 404 so an attacker can't
    // learn whether an email is registered, nor whether a guessed code was close.
    if (!user || !user.emailVerificationToken || user.emailVerificationToken !== hashed) {
      audit({
        action: "AUTH_EMAIL_VERIFY_FAILED",
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
        metadata: { reason: "CODE_EXPIRED" },
        success: false,
      });
      return NextResponse.json(
        { error: "This verification code has expired. Please request a new one." },
        { status: 410 }
      );
    }

    // Atomically mark verified and clear the code so it cannot be replayed.
    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
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

    return NextResponse.json({ message: "Email verified successfully.", email: user.email });
  } catch (err) {
    console.error("Verify email error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

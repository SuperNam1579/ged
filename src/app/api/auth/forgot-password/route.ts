import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateVerificationToken, passwordResetTokenExpiry } from "@/lib/token";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { audit, extractRequestContext } from "@/lib/audit";
import { z } from "zod";

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

// Generic success message returned regardless of whether the email exists.
// This prevents email enumeration — an attacker cannot determine whether
// a given address is registered by observing different responses.
const GENERIC_OK = {
  message: "If that email is registered, a password reset link has been sent.",
};

export async function POST(req: NextRequest) {
  try {
    const limited = await checkRateLimit("forgot-password", req);
    if (limited) return limited;

    const body = await req.json();
    const parsed = ForgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const { email } = parsed.data;

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, emailVerified: true },
    });

    // Return generic success for non-existent accounts — no enumeration possible
    if (!user) {
      return NextResponse.json(GENERIC_OK);
    }

    // Only allow password reset for verified accounts.
    // Unverified accounts have not proven ownership of the email address.
    if (!user.emailVerified) {
      return NextResponse.json(GENERIC_OK);
    }

    const ctx = extractRequestContext(req);
    const { raw, hashed } = generateVerificationToken();

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashed,
        passwordResetExpires: passwordResetTokenExpiry(), // 1 hour
      },
    });

    audit({
      action: "AUTH_PASSWORD_RESET_REQUESTED",
      userId: user.id,
      entityType: "user",
      entityId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { email },
      success: true,
    });

    sendPasswordResetEmail(email, user.name ?? "", raw).catch((err) =>
      console.error("[forgot-password] Failed to send reset email:", err)
    );

    return NextResponse.json(GENERIC_OK);
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

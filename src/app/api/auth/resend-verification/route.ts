import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  generateVerificationToken,
  verificationTokenExpiry,
  canResendVerification,
} from "@/lib/token";
import { sendVerificationEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const ResendSchema = z.object({
  email: z.string().email(),
});

// Returned for every "user does not exist" or "already verified" case so that
// callers cannot determine whether a given email address is registered.
const GENERIC_OK = {
  message:
    "If that email is registered and unverified, a new verification link has been sent.",
};

export async function POST(req: NextRequest) {
  try {
    const limited = await checkRateLimit("resend-verification", req);
    if (limited) return limited;

    const body = await req.json();
    const parsed = ResendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const { email } = parsed.data;

    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        emailVerified: true,
        emailVerificationExpires: true,
      },
    });

    // Return generic success for non-existent or already-verified accounts to
    // prevent email enumeration. An attacker cannot tell which case occurred.
    if (!user || user.emailVerified) {
      return NextResponse.json(GENERIC_OK);
    }

    if (!canResendVerification(user.emailVerificationExpires)) {
      // 429 leaks that an unverified account exists for this email, which is an
      // accepted tradeoff — the user who just registered obviously knows their email.
      return NextResponse.json(
        { error: "Please wait a moment before requesting another verification email." },
        { status: 429 }
      );
    }

    const { raw, hashed } = generateVerificationToken();

    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: hashed,
        emailVerificationExpires: verificationTokenExpiry(),
      },
    });

    sendVerificationEmail(email, user.name, raw).catch((err) =>
      console.error("[resend-verification] Failed to send email:", err)
    );

    return NextResponse.json(GENERIC_OK);
  } catch (err) {
    console.error("Resend verification error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

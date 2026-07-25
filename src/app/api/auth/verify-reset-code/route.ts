import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashVerificationToken } from "@/lib/token";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

// Step 1 of the two-step reset flow: confirm the code is valid *without*
// consuming it, so the UI can advance to the new-password step. The actual
// reset (which nulls the code) happens later via /api/auth/reset-password.
//
// Shares the "reset-password" rate-limit bucket so guesses against either
// endpoint count toward the same per-IP cap — you can't dodge the limit by
// hammering this checker instead of the final submit.

const VerifyResetCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6).regex(/^[0-9]+$/),
});

export async function POST(req: NextRequest) {
  try {
    const limited = await checkRateLimit("reset-password", req);
    if (limited) return limited;

    const body = await req.json();
    const parsed = VerifyResetCodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid verification code format." },
        { status: 400 }
      );
    }

    const { email, code } = parsed.data;
    const hashed = hashVerificationToken(code);

    const user = await db.user.findUnique({
      where: { email },
      select: { passwordResetToken: true, passwordResetExpires: true },
    });

    // Wrong email or wrong code both return the same 404 — no enumeration.
    if (!user || !user.passwordResetToken || user.passwordResetToken !== hashed) {
      return NextResponse.json(
        { error: "That code is incorrect or has already been used." },
        { status: 404 }
      );
    }

    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return NextResponse.json(
        { error: "This reset code has expired. Please request a new one." },
        { status: 410 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Verify reset code error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

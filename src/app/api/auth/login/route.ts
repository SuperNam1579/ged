import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, signToken } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { audit, extractRequestContext } from "@/lib/audit";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const limited = await checkRateLimit("login", req);
    if (limited) return limited;

    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
    }

    const { email, password } = parsed.data;

    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        emailVerified: true,
      },
    });

    // Always run verifyPassword to prevent timing-based user-enumeration attacks.
    // user.passwordHash is null for OAuth-only accounts — fall back to a dummy hash
    // so the bcrypt comparison still runs at full cost, then reject via isValid.
    const dummyHash = "$2b$12$invalidhashpaddingtomaintaintiming00000000000000000000";
    const passwordValid = await verifyPassword(
      password,
      user?.passwordHash ?? dummyHash
    );
    const isValid = !!user && !!user.passwordHash && passwordValid;

    const ctx = extractRequestContext(req);

    if (!isValid) {
      audit({
        action: "AUTH_LOGIN_FAILURE",
        userId: user?.id ?? null,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { email },
        success: false,
      });
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (!user.emailVerified) {
      audit({
        action: "AUTH_LOGIN_FAILURE",
        userId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { email, reason: "EMAIL_NOT_VERIFIED" },
        success: false,
      });
      // Distinct error code so the frontend can show a targeted "resend" prompt
      // without leaking more information than "your credentials are correct".
      return NextResponse.json(
        {
          error: "Please verify your email address before logging in. Check your inbox for a verification link.",
          code: "EMAIL_NOT_VERIFIED",
        },
        { status: 403 }
      );
    }

    const token = await signToken({ sub: user.id, email: user.email, name: user.name });

    audit({
      action: "AUTH_LOGIN_SUCCESS",
      userId: user.id,
      entityType: "user",
      entityId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      success: true,
    });

    const response = NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name }, token },
      { status: 200 }
    );

    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

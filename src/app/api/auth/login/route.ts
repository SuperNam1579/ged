import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, signToken } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { audit, extractRequestContext } from "@/lib/audit";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

const REMEMBER_ME_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function POST(req: NextRequest) {
  try {
    const limited = await checkRateLimit("login", req);
    if (limited) return limited;

    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
    }

    const { email, password, rememberMe } = parsed.data;

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
      return NextResponse.json(
        { error: "Please verify your email before logging in." },
        { status: 403 }
      );
    }

    // Remembered sessions get a 30-day token; otherwise the token is capped at
    // 1 day as a safety net, and the cookie itself is a browser-session cookie
    // (no maxAge) so it clears out when the browser fully closes.
    const token = await signToken(
      { sub: user.id, email: user.email, name: user.name },
      rememberMe ? "30d" : "1d"
    );

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
      // Omitting maxAge makes this a session cookie that clears when the
      // browser closes; only set it when the user opted into "remember me".
      ...(rememberMe ? { maxAge: REMEMBER_ME_SECONDS } : {}),
    });

    // Clear any leftover NextAuth (Google) session cookie so this credentials
    // login establishes exactly one session and can't be shadowed by a stale
    // Google session belonging to a different account in the same browser.
    response.cookies.delete("authjs.session-token");
    response.cookies.delete("__Secure-authjs.session-token");

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

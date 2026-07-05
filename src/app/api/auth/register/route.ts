import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import { generateVerificationToken, verificationTokenExpiry } from "@/lib/token";
import { sendVerificationEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { audit, extractRequestContext } from "@/lib/audit";
import { z } from "zod";

const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  dateOfBirth: z.string().refine((d) => {
    const dob = new Date(d);
    const age = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return age >= 16;
  }, "Must be at least 16 years old"),
});

export async function POST(req: NextRequest) {
  try {
    const limited = await checkRateLimit("register", req);
    if (limited) return limited;

    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password, dateOfBirth } = parsed.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const { raw, hashed } = generateVerificationToken();

    const ctx = extractRequestContext(req);

    const newUser = await db.user.create({
      data: {
        name,
        email,
        passwordHash,
        dateOfBirth: new Date(dateOfBirth),
        emailVerificationToken: hashed,
        emailVerificationExpires: verificationTokenExpiry(),
        // emailVerified defaults to false — user cannot log in until they click the link
      },
    });

    audit({
      action: "AUTH_REGISTER",
      userId: newUser.id,
      entityType: "user",
      entityId: newUser.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { email },
      success: true,
    });

    // Schedule email after response is sent so Vercel keeps the function alive
    // until delivery completes — avoids silent drops on serverless cold-start teardown.
    after(() =>
      sendVerificationEmail(email, name, raw).catch((err) =>
        console.error("[register] Failed to send verification email:", err)
      )
    );

    return NextResponse.json(
      { message: "Account created. Please check your email to verify your account." },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }
    console.error("Register error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

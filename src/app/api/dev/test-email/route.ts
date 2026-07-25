import { NextRequest, NextResponse } from "next/server";
import { sendVerificationEmail } from "@/lib/email";

// DEV ONLY — remove before deploying to production
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  try {
    await sendVerificationEmail(email, "Test User", "123456");
    return NextResponse.json({ ok: true, message: `Email sent to ${email}` });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

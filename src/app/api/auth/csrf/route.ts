import { NextRequest, NextResponse } from "next/server";
import { generateCsrfToken, setCsrfCookie } from "@/lib/csrf";

// Public endpoint — no auth required.
// Anyone can request a CSRF token; the token is only useful for requests that
// also carry a valid auth-token cookie, so there is no security benefit in
// restricting who can fetch one.

export async function GET(_req: NextRequest) {
  const token = generateCsrfToken();
  const response = NextResponse.json({ csrfToken: token });
  setCsrfCookie(response, token);
  return response;
}

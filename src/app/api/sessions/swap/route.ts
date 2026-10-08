import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserStrict } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { PlanEditError, swapSessions } from "@/lib/schedule/manual";

const SwapSchema = z.object({ a: z.string().min(1), b: z.string().min(1) });

/**
 * POST /api/sessions/swap — swaps two sessions' days and positions, e.g.
 * "study this subject here instead". Neither may be completed or in the past.
 */
export async function POST(req: NextRequest) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;
  const authUser = await getAuthUserStrict(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = SwapSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await swapSessions(authUser.id, parsed.data.a, parsed.data.b);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PlanEditError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { getAuthUser, getAuthUserStrict } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { checkFeasibility } from "@/lib/schedule/create-plan";

/**
 * Does the learner's free time before the exam fit the subjects they chose?
 * The GA only plans when it does. See lib/schedule/feasibility.ts.
 *
 *   GET  /api/plans/feasibility   with the saved settings
 *   POST /api/plans/feasibility   with any of { examDate, template, subjectCodes }
 *                                 in place of the saved ones — "would it fit
 *                                 if…", for adjusting settings live. Saves nothing.
 */

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await checkRateLimit("plan-check", req, authUser.id);
  if (limited) return limited;

  const feasibility = await checkFeasibility(authUser.id);
  if (!feasibility) return NextResponse.json({ error: "Complete onboarding first." }, { status: 400 });
  return NextResponse.json({ feasibility });
}

const SlotSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
  })
  .refine((s) => s.startTime < s.endTime, { message: "startTime must be before endTime" });

const WhatIfSchema = z.object({
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
  template: z.array(SlotSchema).optional(),
  subjectCodes: z.array(z.enum(["MATH", "RLA", "SCI", "SS"])).min(1).optional(),
});

export async function POST(req: NextRequest) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;
  const authUser = await getAuthUserStrict(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await checkRateLimit("plan-check", req, authUser.id);
  if (limited) return limited;

  const parsed = WhatIfSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const feasibility = await checkFeasibility(authUser.id, parsed.data);
  if (!feasibility) return NextResponse.json({ error: "Complete onboarding first." }, { status: 400 });
  return NextResponse.json({ feasibility });
}

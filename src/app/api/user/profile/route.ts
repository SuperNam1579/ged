import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUserStrict } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { audit, extractRequestContext } from "@/lib/audit";
import { z } from "zod";

// Both fields are optional so callers can update just the name (Settings) or
// just the date of birth (Google users completing onboarding).
const ProfileSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100).optional(),
    dateOfBirth: z
      .string()
      .refine((d) => {
        const dob = new Date(d);
        if (isNaN(dob.getTime())) return false;
        const age = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        return age >= 16 && age <= 120;
      }, "You must be at least 16 years old")
      .optional(),
  })
  .refine((d) => d.name !== undefined || d.dateOfBirth !== undefined, {
    message: "Nothing to update",
  });

export async function POST(req: NextRequest) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  const authUser = await getAuthUserStrict(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const { name, dateOfBirth } = parsed.data;
  const data: { name?: string; dateOfBirth?: Date } = {};
  if (name !== undefined) data.name = name;
  if (dateOfBirth !== undefined) data.dateOfBirth = new Date(dateOfBirth);

  const user = await db.user.update({
    where: { id: authUser.id },
    data,
    select: { id: true, name: true, dateOfBirth: true },
  });

  const ctx = extractRequestContext(req);
  // Reuse USER_PREFERENCES_UPDATED (no dedicated profile action in the enum) —
  // the metadata records exactly which profile fields changed.
  audit({
    action: "USER_PREFERENCES_UPDATED",
    userId: authUser.id,
    entityType: "user",
    entityId: authUser.id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    metadata: { profileFields: Object.keys(data) },
    success: true,
  });

  return NextResponse.json({ user });
}

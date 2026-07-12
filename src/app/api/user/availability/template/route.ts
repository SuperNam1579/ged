import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, getAuthUserStrict } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { audit, extractRequestContext } from "@/lib/audit";
import { z } from "zod";

// A slot is a free-time window on a weekday. Multiple slots per day are allowed.
const SlotSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
  })
  .refine((s) => s.startTime < s.endTime, { message: "startTime must be before endTime" });

const TemplateSchema = z.object({
  // Allow an empty template (user clears all slots) — the UI decides when it's usable.
  slots: z.array(SlotSchema),
});

// ── GET: the user's recurring availability template (null if never set up) ──
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const template = await db.weeklyAvailabilityTemplate.findUnique({
    where: { userId: authUser.id },
    include: { slots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] } },
  });

  return NextResponse.json({
    // hasTemplate lets the client decide whether to show the one-time setup screen.
    hasTemplate: !!template,
    template: template
      ? {
          slots: template.slots.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
        }
      : null,
  });
}

// ── PUT: create or replace the whole template (slots are replaced wholesale) ──
export async function PUT(req: NextRequest) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  const authUser = await getAuthUserStrict(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = TemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const { slots } = parsed.data;

  const template = await db.$transaction(async (tx) => {
    const t = await tx.weeklyAvailabilityTemplate.upsert({
      where: { userId: authUser.id },
      create: { userId: authUser.id },
      update: {},
    });
    await tx.weeklyAvailabilityTemplateSlot.deleteMany({ where: { templateId: t.id } });
    if (slots.length > 0) {
      await tx.weeklyAvailabilityTemplateSlot.createMany({
        data: slots.map((s) => ({
          templateId: t.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      });
    }
    return t;
  });

  const ctx = extractRequestContext(req);
  audit({
    action: "USER_PREFERENCES_UPDATED",
    userId: authUser.id,
    entityType: "availabilityTemplate",
    entityId: template.id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    metadata: { slotCount: slots.length },
    success: true,
  });

  return NextResponse.json({ hasTemplate: true, template: { slots } });
}

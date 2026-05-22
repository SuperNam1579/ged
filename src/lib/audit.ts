import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getClientIp } from "@/lib/rate-limit";
import type { AuditAction } from "@prisma/client";

const BLOCKED_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "secret",
  "hash",
  "cookie",
  "authorization",
  "apiKey",
  "api_key",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "privateKey",
  "private_key",
]);

const MAX_STRING_LENGTH = 500;
const MAX_METADATA_DEPTH = 3;

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_METADATA_DEPTH) return "[truncated]";
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) + "…" : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => sanitizeValue(item, depth + 1));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (BLOCKED_KEYS.has(k.toLowerCase()) || BLOCKED_KEYS.has(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = sanitizeValue(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return sanitizeValue(metadata, 0) as Record<string, unknown>;
}

export function extractRequestContext(req: NextRequest): {
  ipAddress: string;
  userAgent: string | null;
} {
  const ipAddress = getClientIp(req);
  const raw = req.headers.get("user-agent");
  const userAgent = raw ? raw.slice(0, MAX_STRING_LENGTH) : null;
  return { ipAddress, userAgent };
}

export interface AuditParams {
  action: AuditAction;
  userId?: string | null;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
  success?: boolean;
}

export function audit(params: AuditParams): void {
  const {
    action,
    userId = null,
    entityType,
    entityId,
    ipAddress,
    userAgent,
    metadata,
    success = true,
  } = params;

  const sanitized = metadata ? sanitizeMetadata(metadata) : undefined;

  db.auditLog
    .create({
      data: {
        action,
        userId: userId ?? null,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        metadata: sanitized !== undefined
          ? (sanitized as Prisma.InputJsonValue)
          : Prisma.DbNull,
        success,
      },
    })
    .catch((err: unknown) => {
      console.error("[audit] Failed to write audit log:", err);
    });
}

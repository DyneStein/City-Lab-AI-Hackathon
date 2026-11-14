import "server-only";
import { nanoid } from "nanoid";
import { db, schema } from "@/lib/db";

/** Simple fixed-window in-memory rate limiter (per process). */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

/**
 * Audit log. `meta` must never contain medical values, report text, or names.
 */
export function audit(
  actorId: string | null,
  action: string,
  target?: { type: string; id: string },
  meta?: Record<string, string | number | boolean>,
) {
  db.insert(schema.auditLogs)
    .values({
      id: nanoid(),
      actorId,
      action,
      targetType: target?.type ?? null,
      targetId: target?.id ?? null,
      meta: meta ? JSON.stringify(meta) : null,
      createdAt: Date.now(),
    })
    .run();
}

export const newId = () => nanoid(21);

import "server-only";
import net from "node:net";
import os from "node:os";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { audit, newId } from "@/lib/security";
import { env } from "@/lib/env";

const TTL_MS = 5 * 60 * 1000;

/** First private IPv4 address of this machine (what a phone on the same Wi-Fi can reach). */
export function lanAddress(): string | null {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === "IPv4" && !a.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)) return a.address;
    }
  }
  return null;
}

const PHONE_HTTPS_PORT = Number(process.env.PHONE_HTTPS_PORT ?? 3443);

const portOpen = (port: number) =>
  new Promise<boolean>((resolve) => {
    const s = net.connect(port, "127.0.0.1");
    s.setTimeout(300);
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("error", () => resolve(false));
    s.once("timeout", () => (s.destroy(), resolve(false)));
  });

/**
 * Base URL a phone should open. PUBLIC_URL wins; then the HTTPS entrance (npm run phone),
 * which allows the live camera; otherwise plain Wi-Fi HTTP (camera app capture still works).
 */
export async function phoneBaseUrl(host: string | null): Promise<string> {
  if (env.PUBLIC_URL) return env.PUBLIC_URL.replace(/\/$/, "");
  const ip = lanAddress();
  if (!ip) return env.APP_URL;
  if (await portOpen(PHONE_HTTPS_PORT)) return `https://${ip}:${PHONE_HTTPS_PORT}`;
  const port = host?.split(":")[1] ?? (new URL(env.APP_URL).port || "3100");
  return `http://${ip}:${port}`;
}

export function createHandoffToken(userId: string): string {
  const token = randomToken(24);
  const now = Date.now();
  db.delete(schema.handoffTokens).where(lt(schema.handoffTokens.expiresAt, now)).run();
  db.insert(schema.handoffTokens).values({ id: newId(), userId, tokenHash: sha256(token), expiresAt: now + TTL_MS, createdAt: now }).run();
  audit(userId, "handoff.created");
  return token;
}

/**
 * Atomic single-use claim: one UPDATE with all conditions, so two phones scanning the
 * same code cannot both succeed. Returns the user id or null.
 */
export function claimHandoffToken(token: string): string | null {
  const now = Date.now();
  const row = db
    .update(schema.handoffTokens)
    .set({ claimedAt: now })
    .where(and(eq(schema.handoffTokens.tokenHash, sha256(token)), isNull(schema.handoffTokens.claimedAt), gt(schema.handoffTokens.expiresAt, now)))
    .returning({ userId: schema.handoffTokens.userId })
    .get();
  if (row) audit(row.userId, "handoff.claimed");
  return row?.userId ?? null;
}

import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { decryptText, encryptText } from "@/lib/crypto";
import { env } from "@/lib/env";
import { audit, newId } from "@/lib/security";
import { createReportFromUpload } from "@/lib/reports/service";
import { HttpError } from "@/lib/auth/session";

/*
 * Gmail retrieval (read-only).
 * - Official Google OAuth; we never see the Gmail password.
 * - Scope: gmail.readonly (minimum that can read attachments) + the account's email address.
 * - We only ever search messages FROM the sender addresses the person listed, with attachments.
 *   Other emails are never fetched or stored.
 * - Refresh token is encrypted at rest; disconnecting revokes it at Google and deletes it.
 */

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly", "openid", "email"];
const REPORT_HINT = /\b(report|lab|laborator|result|test|cbc|blood|lipid|thyroid|tsh|hba1c|sugar|glucose|pathology|diagnostic|urine|panel|profile|haematology|hematology|biochemistry)\b/i;
const ATTACH_OK = /\.(pdf|jpe?g|png)$/i;

export const gmailConfigured = () => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
export const redirectUri = () => `${env.APP_URL.replace(/\/$/, "")}/api/gmail/callback`;

export function authUrl(state: string) {
  const q = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!, ...params }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new HttpError(502, "google_token_failed");
  return (await res.json()) as { access_token: string; refresh_token?: string; id_token?: string; scope: string };
}

export async function completeConnect(userId: string, code: string) {
  const tok = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  if (!tok.refresh_token) throw new HttpError(400, "no_refresh_token");
  const profile = await gapi<{ emailAddress: string }>(tok.access_token, "/gmail/v1/users/me/profile");
  const now = Date.now();
  const existing = getConnection(userId);
  if (existing) db.delete(schema.emailConnections).where(eq(schema.emailConnections.id, existing.id)).run();
  db.insert(schema.emailConnections)
    .values({
      id: newId(),
      userId,
      provider: "gmail",
      emailAddress: profile.emailAddress,
      scopes: tok.scope,
      refreshTokenEnc: encryptText(tok.refresh_token),
      senders: existing?.senders ?? "[]",
      createdAt: now,
    })
    .run();
  db.insert(schema.consents).values({ id: newId(), userId, kind: "gmail_access", granted: true, scope: JSON.stringify({ scopes: SCOPES }), createdAt: now }).run();
  audit(userId, "gmail.connected");
}

export function getConnection(userId: string) {
  return db.select().from(schema.emailConnections).where(and(eq(schema.emailConnections.userId, userId), eq(schema.emailConnections.provider, "gmail"))).get() ?? null;
}

export function getSenders(userId: string): string[] {
  const c = getConnection(userId);
  return c ? (JSON.parse(c.senders) as string[]) : [];
}

export function setSenders(userId: string, senders: string[]) {
  const c = getConnection(userId);
  if (!c) throw new HttpError(409, "not_connected");
  db.update(schema.emailConnections).set({ senders: JSON.stringify([...new Set(senders.map((s) => s.trim().toLowerCase()))].slice(0, 20)) }).where(eq(schema.emailConnections.id, c.id)).run();
}

export async function disconnect(userId: string) {
  const c = getConnection(userId);
  if (!c) return;
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decryptText(c.refreshTokenEnc))}`, { method: "POST" }).catch(() => {});
  db.delete(schema.emailConnections).where(eq(schema.emailConnections.id, c.id)).run();
  db.delete(schema.gmailPending).where(eq(schema.gmailPending.userId, userId)).run();
  db.insert(schema.consents).values({ id: newId(), userId, kind: "gmail_access", granted: false, createdAt: Date.now() }).run();
  audit(userId, "gmail.disconnected");
}

async function gapi<T>(accessToken: string, pathname: string): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com${pathname}`, { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(20_000) });
  if (res.status === 401) throw new HttpError(401, "gmail_reauth");
  if (!res.ok) throw new HttpError(502, "gmail_error");
  return res.json() as Promise<T>;
}

type Part = { filename?: string; mimeType?: string; body?: { attachmentId?: string; size?: number }; parts?: Part[] };
type Message = { id: string; internalDate: string; payload: Part & { headers: { name: string; value: string }[] } };

const flatten = (p: Part): Part[] => [p, ...(p.parts ?? []).flatMap(flatten)];
const b64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

async function accessToken(userId: string) {
  const c = getConnection(userId);
  if (!c) throw new HttpError(409, "not_connected");
  return { c, token: (await tokenRequest({ grant_type: "refresh_token", refresh_token: decryptText(c.refreshTokenEnc) })).access_token };
}

/** Look for new report attachments from the listed senders. */
export async function sync(userId: string): Promise<{ imported: number; pending: number; checked: number }> {
  const { c, token } = await accessToken(userId);
  const senders = JSON.parse(c.senders) as string[];
  if (!senders.length) return { imported: 0, pending: 0, checked: 0 };
  // First sync looks back 60 days; later syncs only since the last one (with an overlap).
  const since = c.lastSyncAt ? Math.floor((c.lastSyncAt - 24 * 3600_000) / 1000) : null;
  const q = `from:(${senders.join(" OR ")}) has:attachment ${since ? `after:${since}` : "newer_than:60d"}`;
  const list = await gapi<{ messages?: { id: string }[] }>(token, `/gmail/v1/users/me/messages?maxResults=25&q=${encodeURIComponent(q)}`);
  let imported = 0;
  let pending = 0;
  for (const { id } of list.messages ?? []) {
    const msg = await gapi<Message>(token, `/gmail/v1/users/me/messages/${id}?format=full`);
    const header = (n: string) => msg.payload.headers.find((h) => h.name.toLowerCase() === n)?.value ?? "";
    const from = header("from").toLowerCase();
    // Double-check the sender on our side too (never trust only the search).
    if (!senders.some((s) => from.includes(s))) continue;
    const subject = header("subject");
    for (const part of flatten(msg.payload)) {
      if (!part.filename || !part.body?.attachmentId || !ATTACH_OK.test(part.filename)) continue;
      if ((part.body.size ?? 0) > env.MAX_UPLOAD_MB * 1024 * 1024) continue;
      const looksLikeReport = REPORT_HINT.test(part.filename) || REPORT_HINT.test(subject);
      if (!looksLikeReport) {
        const exists = db.select({ id: schema.gmailPending.id }).from(schema.gmailPending).where(and(eq(schema.gmailPending.userId, userId), eq(schema.gmailPending.messageId, id), eq(schema.gmailPending.filename, part.filename))).get();
        if (!exists) {
          db.insert(schema.gmailPending)
            .values({ id: newId(), userId, messageId: id, attachmentId: part.body.attachmentId, filename: part.filename.slice(0, 120), mimeType: part.mimeType ?? "", sender: from.slice(0, 120), receivedAt: Number(msg.internalDate), createdAt: Date.now() })
            .run();
          pending++;
        }
        continue;
      }
      if (await importAttachment(userId, token, id, part.body.attachmentId, part.filename)) imported++;
    }
  }
  db.update(schema.emailConnections).set({ lastSyncAt: Date.now() }).where(eq(schema.emailConnections.id, c.id)).run();
  audit(userId, "gmail.synced", undefined, { imported, pending, checked: list.messages?.length ?? 0 });
  return { imported, pending, checked: list.messages?.length ?? 0 };
}

async function importAttachment(userId: string, token: string, messageId: string, attachmentId: string, filename: string) {
  const att = await gapi<{ data: string }>(token, `/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`);
  const r = await createReportFromUpload(userId, b64url(att.data), filename, "gmail");
  if (r.duplicate) return false;
  db.insert(schema.notifications).values({ id: newId(), userId, kind: "report_ready", refId: r.reportId, createdAt: Date.now() }).run();
  return true;
}

/** The person confirmed (or rejected) an attachment we were unsure about. */
export async function resolvePending(userId: string, pendingId: string, accept: boolean) {
  const p = db.select().from(schema.gmailPending).where(and(eq(schema.gmailPending.id, pendingId), eq(schema.gmailPending.userId, userId))).get();
  if (!p) throw new HttpError(404, "not_found");
  if (accept) {
    const { token } = await accessToken(userId);
    await importAttachment(userId, token, p.messageId, p.attachmentId, p.filename);
  }
  db.delete(schema.gmailPending).where(eq(schema.gmailPending.id, p.id)).run();
}

export function listPending(userId: string) {
  return db.select().from(schema.gmailPending).where(eq(schema.gmailPending.userId, userId)).all();
}

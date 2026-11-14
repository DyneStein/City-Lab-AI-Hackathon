import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";

const COOKIE = "nuskha_session";
const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export type SessionUser = {
  id: string;
  email: string;
  role: "user" | "admin";
  profile: typeof schema.profiles.$inferSelect | null;
};

export async function createSession(userId: string) {
  const token = randomToken(32);
  const now = Date.now();
  db.insert(schema.sessions)
    .values({ id: sha256(token), userId, expiresAt: now + TTL_MS, createdAt: now })
    .run();
  db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now)).run();
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.APP_URL.startsWith("https:"), // secure cookies need HTTPS; plain http://localhost must still work
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token))).run();
  jar.delete(COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = db
    .select({ s: schema.sessions, u: schema.users, p: schema.profiles })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(eq(schema.sessions.id, sha256(token)))
    .get();
  if (!row || row.s.expiresAt < Date.now()) return null;
  return { id: row.u.id, email: row.u.email, role: row.u.role, profile: row.p };
}

/** For pages: redirect to login (or onboarding) when needed. */
export async function requireUser(opts: { onboarded?: boolean } = { onboarded: true }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (opts.onboarded !== false && !user.profile?.onboardedAt) redirect("/onboarding");
  return user;
}

/** For route handlers / actions: throws instead of redirecting. */
export async function requireApiUser() {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Not signed in");
  return user;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

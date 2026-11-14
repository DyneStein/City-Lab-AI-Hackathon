"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { createSession, destroySession, getSessionUser, requireApiUser } from "@/lib/auth/session";
import { audit, newId, rateLimit } from "@/lib/security";
import { LANG_COOKIE } from "@/lib/i18n/server";
import { confirmReport, confirmSchema, deleteReport, listReports } from "@/lib/reports/service";
import { deleteBlob } from "@/lib/crypto";

export type FormState = { error?: string; ok?: boolean } | undefined;

let _dummy: Promise<string> | undefined;
const dummyHash = () => (_dummy ??= bcrypt.hash("timing-equalizer", 12));

const ip = async () => (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
const LANG = z.enum(["en", "ur", "pa"]);

/* ───────────── Auth ───────────── */

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(10).max(200),
});

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  if (!rateLimit(`register:${await ip()}`, 10, 60_000)) return { error: "tooMany" };
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "invalid" };
  if (form.get("terms") !== "on") return { error: "terms" };
  const { email, password } = parsed.data;
  if (db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).get()) return { error: "exists" };

  const id = newId();
  const now = Date.now();
  const isFirstAdmin = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).includes(email);
  db.insert(schema.users).values({ id, email, passwordHash: await bcrypt.hash(password, 12), role: isFirstAdmin ? "admin" : "user", createdAt: now }).run();
  db.insert(schema.consents).values({ id: newId(), userId: id, kind: "terms", granted: true, scope: JSON.stringify({ version: 1 }), createdAt: now }).run();
  audit(id, "user.register");
  await createSession(id);
  redirect("/onboarding");
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "invalid" };
  const { email, password } = parsed.data;
  if (!rateLimit(`login:${email}`, 8, 60_000) || !rateLimit(`login-ip:${await ip()}`, 30, 60_000)) return { error: "tooMany" };
  const user = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  // Constant-ish work whether or not the user exists
  const ok = await bcrypt.compare(password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !ok) {
    audit(user?.id ?? null, "user.login_failed");
    return { error: "invalid" };
  }
  audit(user.id, "user.login");
  await createSession(user.id);
  redirect("/home");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

/* ───────────── Onboarding & profile ───────────── */

const profileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((d) => Date.parse(d) < Date.now() && Date.parse(d) > Date.parse("1900-01-01"))
      .optional()
      .or(z.literal("").transform(() => undefined)),
    ageYears: z.coerce.number().int().min(0).max(120).optional().or(z.literal("").transform(() => undefined)),
    language: LANG,
    country: z.string().trim().min(2).max(60),
    region: z.string().trim().max(80).optional(),
    sex: z.enum(["female", "male", "other", "undisclosed"]).default("undisclosed"),
    phone: z
      .string()
      .trim()
      .max(20)
      .regex(/^[+\d\s-]*$/)
      .optional(),
  })
  .refine((v) => v.dateOfBirth || v.ageYears !== undefined, { message: "dob_or_age" });

const formObj = (form: FormData) => Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));

export async function onboardingAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireApiUser();
  const parsed = profileSchema.safeParse(formObj(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message === "dob_or_age" ? "dobOrAge" : "invalid" };
  const v = parsed.data;
  const now = Date.now();
  const values = {
    fullName: v.fullName,
    dateOfBirth: v.dateOfBirth ?? null,
    ageYears: v.dateOfBirth ? null : (v.ageYears ?? null),
    language: v.language,
    country: v.country,
    region: v.region || null,
    sex: v.sex,
    phone: v.phone || null,
    updatedAt: now,
  };
  db.insert(schema.profiles)
    .values({ userId: user.id, ...values, onboardedAt: now })
    .onConflictDoUpdate({ target: schema.profiles.userId, set: { ...values, onboardedAt: now } })
    .run();
  db.insert(schema.consents)
    .values({ id: newId(), userId: user.id, kind: "ai_processing", granted: form.get("aiConsent") === "on", createdAt: now })
    .run();
  audit(user.id, "profile.onboarded");
  redirect("/home");
}

export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireApiUser();
  const parsed = profileSchema.safeParse(formObj(form));
  if (!parsed.success) return { error: "invalid" };
  const v = parsed.data;
  db.update(schema.profiles)
    .set({
      fullName: v.fullName,
      dateOfBirth: v.dateOfBirth ?? null,
      ageYears: v.dateOfBirth ? null : (v.ageYears ?? null),
      language: v.language,
      country: v.country,
      region: v.region || null,
      sex: v.sex,
      phone: v.phone || null,
      voiceNotifications: form.get("voiceNotifications") === "on",
      updatedAt: Date.now(),
    })
    .where(eq(schema.profiles.userId, user.id))
    .run();
  const consent = form.get("aiConsent") === "on";
  db.insert(schema.consents).values({ id: newId(), userId: user.id, kind: "ai_processing", granted: consent, createdAt: Date.now() }).run();
  audit(user.id, "profile.updated");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Language switch: profile for signed-in users, cookie for visitors. */
export async function setLanguageAction(lang: string) {
  const l = LANG.parse(lang);
  const user = await getSessionUser();
  if (user?.profile) db.update(schema.profiles).set({ language: l, updatedAt: Date.now() }).where(eq(schema.profiles.userId, user.id)).run();
  (await cookies()).set(LANG_COOKIE, l, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}

/* ───────────── Reports ───────────── */

export async function confirmReportAction(reportId: string, payload: unknown): Promise<FormState> {
  const user = await requireApiUser();
  const parsed = confirmSchema.safeParse(payload);
  if (!parsed.success) return { error: "invalid" };
  confirmReport(user.id, reportId, parsed.data);
  revalidatePath("/", "layout");
  redirect(`/reports/${reportId}`);
}

export async function deleteReportAction(reportId: string) {
  const user = await requireApiUser();
  deleteReport(user.id, reportId);
  revalidatePath("/", "layout");
  redirect("/reports");
}

export async function dismissNotificationAction(id: string) {
  const user = await requireApiUser();
  db.update(schema.notifications)
    .set({ readAt: Date.now() })
    .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, user.id)))
    .run();
  revalidatePath("/home");
}

export async function markNotificationsReadAction() {
  const user = await requireApiUser();
  db.update(schema.notifications)
    .set({ readAt: Date.now() })
    .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)))
    .run();
  revalidatePath("/home");
}

/* ───────────── Data rights ───────────── */

export async function deleteAccountAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireApiUser();
  if (form.get("confirm") !== "DELETE") return { error: "confirm" };
  for (const r of listReports(user.id)) deleteBlob(r.storageKey);
  audit(user.id, "user.deleted");
  db.delete(schema.users).where(eq(schema.users.id, user.id)).run(); // cascades to all user data
  await destroySession();
  redirect("/");
}

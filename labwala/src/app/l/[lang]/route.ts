import { redirectTo } from "@/lib/http";
import { NextResponse } from "next/server";
import { LANG_COOKIE } from "@/lib/i18n/server";

/** Opened from the laptop's QR code when signed out: remember the language, then go home. */
export async function GET(req: Request, ctx: { params: Promise<{ lang: string }> }) {
  const { lang } = await ctx.params;
  const res = redirectTo("/");
  if (lang === "en" || lang === "ur" || lang === "pa") res.cookies.set(LANG_COOKIE, lang, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  return res;
}

import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getSessionUser, HttpError } from "@/lib/auth/session";
import { createHandoffToken, phoneBaseUrl } from "@/lib/handoff";
import { rateLimit } from "@/lib/security";
import { handle } from "@/lib/http";
import { getLang } from "@/lib/i18n/server";

/** QR code for continuing on a phone. Signed-in users get a one-time sign-in link. */
export const GET = handle(async (req: Request) => {
  const user = await getSessionUser();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`handoff:${user?.id ?? ip}`, 20, 10 * 60_000)) throw new HttpError(429, "too_many");

  const base = await phoneBaseUrl(req.headers.get("host"));
  // The phone has no cookies yet, so the link carries the chosen language.
  const lang = await getLang();
  const url = user?.profile?.onboardedAt ? `${base}/handoff/${createHandoffToken(user.id)}?l=${lang}` : `${base}/l/${lang}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#14213a", light: "#ffffff" } });
  return NextResponse.json({ url, svg, signedIn: !!user?.profile?.onboardedAt, secure: base.startsWith("https://") }, { headers: { "cache-control": "no-store" } });
});

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth/session";
import { randomToken } from "@/lib/crypto";
import { authUrl, gmailConfigured } from "@/lib/gmail";
import { env } from "@/lib/env";

/** Start Google's consent screen (read-only Gmail access). */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (!gmailConfigured()) return NextResponse.redirect(new URL("/settings/gmail?e=config", req.url));
  const state = randomToken(24);
  (await cookies()).set("gmail_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: env.APP_URL.startsWith("https:"), path: "/api/gmail", maxAge: 600 });
  return NextResponse.redirect(authUrl(state));
}

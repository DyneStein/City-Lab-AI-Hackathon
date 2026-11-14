import { redirectTo } from "@/lib/http";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { getSessionUser, HttpError } from "@/lib/auth/session";
import { completeConnect } from "@/lib/gmail";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (q: string) => redirectTo(`/settings/gmail?${q}`);
  const user = await getSessionUser();
  if (!user) return redirectTo("/login");
  const jar = await cookies();
  const expected = jar.get("gmail_oauth_state")?.value ?? "";
  jar.delete({ name: "gmail_oauth_state", path: "/api/gmail" });
  const state = url.searchParams.get("state") ?? "";
  if (!expected || expected.length !== state.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(state))) return back("e=state");
  if (url.searchParams.get("error")) return back("e=denied");
  const code = url.searchParams.get("code");
  if (!code) return back("e=denied");
  try {
    await completeConnect(user.id, code);
    return back("ok=1");
  } catch (e) {
    return back(`e=${e instanceof HttpError ? e.message : "failed"}`);
  }
}

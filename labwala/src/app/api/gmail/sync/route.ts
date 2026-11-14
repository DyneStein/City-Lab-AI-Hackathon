import { NextResponse } from "next/server";
import { requireApiUser, HttpError } from "@/lib/auth/session";
import { getConnection, sync } from "@/lib/gmail";
import { rateLimit } from "@/lib/security";
import { handle } from "@/lib/http";

/** Check Gmail now. `?auto=1` (from the home screen) only runs if the last check is > 10 minutes old. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const conn = getConnection(user.id);
  if (!conn) return NextResponse.json({ connected: false });
  const auto = new URL(req.url).searchParams.get("auto") === "1";
  if (auto && conn.lastSyncAt && Date.now() - conn.lastSyncAt < 10 * 60_000) return NextResponse.json({ connected: true, skipped: true });
  if (!rateLimit(`gmail-sync:${user.id}`, 6, 60_000)) throw new HttpError(429, "too_many");
  return NextResponse.json({ connected: true, ...(await sync(user.id)) });
});

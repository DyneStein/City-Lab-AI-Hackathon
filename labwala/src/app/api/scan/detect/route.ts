import { NextResponse } from "next/server";
import { requireApiUser, HttpError } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security";
import { handle } from "@/lib/http";
import { sidecarImage } from "@/lib/sidecar";
import { sniffMime } from "@/lib/reports/extract";

/** Find the page corners in a photo (laptop does the work; phone just shows the result). */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  // Live viewfinder sends small frames a few times per second.
  if (!rateLimit(`detect:${user.id}`, 600, 60_000)) throw new HttpError(429, "too_many");
  const img = Buffer.from(await req.arrayBuffer());
  if (img.length > 15 * 1024 * 1024) throw new HttpError(413, "too_large");
  const mime = sniffMime(img);
  if (mime !== "image/jpeg" && mime !== "image/png") throw new HttpError(415, "invalid_type");
  const res = await sidecarImage("/scan/detect", img).catch(() => null);
  if (!res?.ok) throw new HttpError(503, "scanner_unavailable");
  return NextResponse.json(await res.json());
});

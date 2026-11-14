import { z } from "zod";
import { requireApiUser, HttpError } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security";
import { handle } from "@/lib/http";
import { sidecarImage } from "@/lib/sidecar";
import { sniffMime } from "@/lib/reports/extract";

const corners = z.array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)])).length(4);

/** Flatten the page to the chosen corners and (optionally) clean it up like a scanner. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!rateLimit(`warp:${user.id}`, 60, 10 * 60_000)) throw new HttpError(429, "too_many");
  const url = new URL(req.url);
  const parsed = corners.safeParse(JSON.parse(url.searchParams.get("corners") ?? "null"));
  if (!parsed.success) throw new HttpError(400, "bad_corners");
  const img = Buffer.from(await req.arrayBuffer());
  if (img.length > 15 * 1024 * 1024) throw new HttpError(413, "too_large");
  const mime = sniffMime(img);
  if (mime !== "image/jpeg" && mime !== "image/png") throw new HttpError(415, "invalid_type");
  const res = await sidecarImage("/scan/warp", img, { corners: JSON.stringify(parsed.data), enhance: url.searchParams.get("enhance") === "0" ? "false" : "true" }).catch(() => null);
  if (!res?.ok) throw new HttpError(503, "scanner_unavailable");
  return new Response(new Uint8Array(await res.arrayBuffer()), { headers: { "content-type": "image/jpeg", "cache-control": "no-store" } });
});

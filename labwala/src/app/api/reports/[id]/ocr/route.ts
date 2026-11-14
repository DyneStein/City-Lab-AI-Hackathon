import { NextResponse } from "next/server";
import { requireApiUser, HttpError } from "@/lib/auth/session";
import { ocrScannedPdf } from "@/lib/reports/service";
import { rateLimit } from "@/lib/security";
import { handle } from "@/lib/http";

/** Page images of a scanned PDF, rendered in the browser at a known scale. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  if (!rateLimit(`ocr:${user.id}`, 10, 10 * 60_000)) throw new HttpError(429, "too_many");
  const form = await req.formData();
  const scale = Number(form.get("scale"));
  if (!Number.isFinite(scale) || scale < 0.5 || scale > 4) throw new HttpError(400, "bad_scale");
  const files = form.getAll("page").filter((f): f is File => f instanceof File).slice(0, 10);
  if (!files.length) throw new HttpError(400, "no_pages");
  const pages = await Promise.all(files.map(async (f) => ({ image: Buffer.from(await f.arrayBuffer()), scale })));
  await ocrScannedPdf(user.id, id, pages);
  return NextResponse.json({ ok: true });
});

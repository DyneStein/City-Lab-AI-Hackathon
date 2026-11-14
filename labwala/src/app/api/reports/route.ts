import { NextResponse } from "next/server";
import { requireApiUser, HttpError } from "@/lib/auth/session";
import { createReportFromUpload } from "@/lib/reports/service";
import { rateLimit } from "@/lib/security";
import { handle } from "@/lib/http";
import { env } from "@/lib/env";

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!rateLimit(`upload:${user.id}`, 20, 10 * 60_000)) throw new HttpError(429, "too_many");
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > env.MAX_UPLOAD_MB * 1024 * 1024 + 64 * 1024) throw new HttpError(413, "too_large");

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "no_file");
  const buf = Buffer.from(await file.arrayBuffer());
  const result = await createReportFromUpload(user.id, buf, file.name);
  return NextResponse.json(result);
});

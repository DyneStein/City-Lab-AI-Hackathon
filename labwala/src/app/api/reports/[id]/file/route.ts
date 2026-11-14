import { requireApiUser } from "@/lib/auth/session";
import { getOwnedReport } from "@/lib/reports/service";
import { getBlob } from "@/lib/crypto";
import { handle } from "@/lib/http";

/** Decrypts and streams the original file to its owner only. Never cached. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const report = getOwnedReport(user.id, id);
  const data = getBlob(report.storageKey);
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": report.mimeType.startsWith("text/") ? `${report.mimeType}; charset=utf-8` : report.mimeType,
      "content-disposition": `inline; filename="report${report.mimeType === "application/pdf" ? ".pdf" : ""}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
});

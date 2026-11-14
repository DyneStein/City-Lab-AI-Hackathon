import { eq } from "drizzle-orm";
import { requireApiUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { audit } from "@/lib/security";
import { handle } from "@/lib/http";

/** Data portability: everything we hold about the user, as JSON (original files excluded). */
export const GET = handle(async () => {
  const user = await requireApiUser();
  const reports = db.select().from(schema.reports).where(eq(schema.reports.userId, user.id)).all();
  const data = {
    exportedAt: new Date().toISOString(),
    account: { email: user.email, createdVia: "nuskha" },
    profile: user.profile,
    consents: db.select().from(schema.consents).where(eq(schema.consents.userId, user.id)).all(),
    reports: reports.map(({ layoutEnc: _l, storageKey: _s, ...r }) => ({
      ...r,
      results: db.select().from(schema.testResults).where(eq(schema.testResults.reportId, r.id)).all(),
    })),
    activity: db.select().from(schema.auditLogs).where(eq(schema.auditLogs.actorId, user.id)).all(),
  };
  audit(user.id, "user.export");
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="nuskha-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
});

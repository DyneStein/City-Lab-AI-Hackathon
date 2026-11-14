import "server-only";
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { encryptJson, decryptJson, putBlob, sha256, deleteBlob } from "@/lib/crypto";
import { audit, newId } from "@/lib/security";
import { HttpError } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { extractPdfLayout, ocrImage, sniffMime } from "./extract";
import { parseReport, parseRange } from "./parse";
import { DERIVED_REASONS, evaluateResult } from "./evaluate";
import { matchTest } from "@/lib/knowledge/library";
import type { PageLayout, ParsedReport, ReportLayout } from "./types";

export type Report = typeof schema.reports.$inferSelect;
export type TestResult = typeof schema.testResults.$inferSelect;

/** Authorization: a report is only ever returned to its owner. */
export function getOwnedReport(userId: string, reportId: string): Report {
  const r = db
    .select()
    .from(schema.reports)
    .where(and(eq(schema.reports.id, reportId), eq(schema.reports.userId, userId)))
    .get();
  if (!r) throw new HttpError(404, "Report not found");
  return r;
}

export function listReports(userId: string) {
  return db.select().from(schema.reports).where(eq(schema.reports.userId, userId)).orderBy(desc(schema.reports.createdAt)).all();
}

export function getResults(reportId: string) {
  return db.select().from(schema.testResults).where(eq(schema.testResults.reportId, reportId)).orderBy(asc(schema.testResults.position)).all();
}

export function getLayout(report: Report): ReportLayout | null {
  return report.layoutEnc ? decryptJson<ReportLayout>(report.layoutEnc) : null;
}

/* ───────────── Upload ───────────── */

export async function createReportFromUpload(userId: string, file: Buffer, fileName: string, source: "upload" | "gmail" = "upload") {
  const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  if (file.length === 0 || file.length > maxBytes) throw new HttpError(413, "too_large");
  const mime = sniffMime(file) ?? (looksLikeText(file, fileName) ? "text/markdown" : null);
  if (!mime) throw new HttpError(415, "invalid_type");

  const hash = sha256(file);
  const dup = db
    .select({ id: schema.reports.id })
    .from(schema.reports)
    .where(and(eq(schema.reports.userId, userId), eq(schema.reports.fileSha256, hash)))
    .get();
  if (dup) return { reportId: dup.id, duplicate: true, needsOcr: false };

  const id = newId();
  const storageKey = newId();
  putBlob(storageKey, file);
  const safeName = fileName.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "report";
  db.insert(schema.reports)
    .values({
      id,
      userId,
      source,
      status: "uploaded",
      fileName: safeName,
      mimeType: mime,
      fileSize: file.length,
      fileSha256: hash,
      storageKey,
      createdAt: Date.now(),
    })
    .run();
  audit(userId, "report.upload", { type: "report", id }, { mime, bytes: file.length });

  try {
    if (mime === "application/pdf") {
      const { layout, charCount, pageCount } = await extractPdfLayout(file);
      if (charCount < 40) {
        // Scanned PDF: the browser rasterizes pages and sends them to /ocr.
        db.update(schema.reports).set({ status: "needs_ocr", pageCount }).where(eq(schema.reports.id, id)).run();
        return { reportId: id, duplicate: false, needsOcr: true, pageCount };
      }
      saveExtraction(userId, id, layout, null);
    } else if (mime === "text/markdown") {
      saveExtraction(userId, id, textLayout(file.toString("utf8")), null);
    } else {
      const { page, confidence } = await ocrImage(file, 1, 1);
      saveExtraction(userId, id, { method: "ocr", pages: [page] }, confidence);
    }
  } catch (e) {
    console.error("[extract] failed", { reportId: id, err: (e as Error).message }); // no report content in logs
    db.update(schema.reports).set({ status: "failed", errorCode: "extract_failed" }).where(eq(schema.reports.id, id)).run();
  }
  return { reportId: id, duplicate: false, needsOcr: false };
}

/** Plain-text / Markdown reports (e.g. lab systems that export .md or .txt). */
function looksLikeText(buf: Buffer, fileName: string) {
  const head = buf.subarray(0, 8192);
  if (head.includes(0)) return false; // binary
  if (/\.(md|markdown|txt)$/i.test(fileName)) return true;
  const s = head.toString("utf8");
  const printable = s.replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\uffff]/g, "").length;
  return s.length > 40 && printable / s.length > 0.97;
}

function textLayout(text: string): ReportLayout {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 5000)
    .map((l) => ({ text: l, items: [], box: [0, 0, 0, 0] as [number, number, number, number] }));
  return { method: "text", pages: [{ page: 1, width: 0, height: 0, lines }] };
}

/** OCR for scanned PDFs: page images rendered by the browser at `scale`. */
export async function ocrScannedPdf(userId: string, reportId: string, pages: { image: Buffer; scale: number }[]) {
  const report = getOwnedReport(userId, reportId);
  if (report.status !== "needs_ocr") throw new HttpError(409, "Report does not need OCR");
  const out: PageLayout[] = [];
  let conf = 0;
  for (const [i, p] of pages.entries()) {
    const kind = sniffMime(p.image);
    if (kind !== "image/png" && kind !== "image/jpeg") throw new HttpError(415, "invalid_type");
    const { page, confidence } = await ocrImage(p.image, i + 1, p.scale);
    out.push(page);
    conf += confidence;
  }
  saveExtraction(userId, reportId, { method: "ocr", pages: out }, pages.length ? conf / pages.length : 0);
}

function saveExtraction(userId: string, reportId: string, layout: ReportLayout, ocrConfidence: number | null) {
  const parsed = parseReport(layout);
  const now = Date.now();
  db.transaction((tx) => {
    tx.delete(schema.testResults).where(eq(schema.testResults.reportId, reportId)).run();
    insertResults(tx, userId, reportId, parsed, now);
    tx.update(schema.reports)
      .set({
        status: "extracted",
        labName: parsed.labName,
        reportDate: parsed.reportDate,
        patientAge: parsed.patientAge,
        patientSex: parsed.patientSex,
        extractionMethod: layout.method,
        ocrConfidence,
        pageCount: layout.pages.length,
        layoutEnc: encryptJson(layout),
      })
      .where(eq(schema.reports.id, reportId))
      .run();
  });
  audit(userId, "report.extracted", { type: "report", id: reportId }, { rows: parsed.results.length, method: layout.method });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function insertResults(tx: Tx, userId: string, reportId: string, parsed: ParsedReport, now: number) {
  const ctx = { labName: parsed.labName, age: parsed.patientAge, sex: parsed.patientSex };
  parsed.results.forEach((r, i) => {
    const c = evaluateResult(r, ctx);
    tx.insert(schema.testResults)
      .values({
        id: newId(),
        reportId,
        userId,
        position: i,
        testName: r.testName,
        canonicalKey: r.canonicalKey,
        valueText: r.valueText,
        valueNum: r.valueNum,
        unit: r.unit,
        refText: c.refText,
        refLow: c.refLow,
        refHigh: c.refHigh,
        labFlag: r.labFlag,
        status: c.status,
        statusReason: c.statusReason,
        needsReview: r.needsReview,
        reviewReason: r.reviewReason,
        page: r.page,
        bbox: r.box ? JSON.stringify(r.box.map((n) => Math.round(n * 10) / 10)) : null,
        sourceLine: r.sourceLine,
        createdAt: now,
      })
      .run();
  });
}

/* ───────────── User verification ───────────── */

export const confirmSchema = z.object({
  labName: z.string().trim().max(120).nullable(),
  reportDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  patientAge: z.number().int().min(0).max(120).nullable().default(null),
  patientSex: z.enum(["male", "female"]).nullable().default(null),
  rows: z
    .array(
      z.object({
        id: z.string().max(40).nullable(), // existing row id, or null for a manually added row
        testName: z.string().trim().min(1).max(80),
        valueText: z.string().trim().min(1).max(30),
        unit: z.string().trim().max(30).nullable(),
        refText: z.string().trim().max(60).nullable(),
        labFlag: z.string().trim().max(12).nullable(),
      }),
    )
    .max(200),
});

export function confirmReport(userId: string, reportId: string, input: z.infer<typeof confirmSchema>) {
  const report = getOwnedReport(userId, reportId);
  const existing = new Map(getResults(reportId).map((r) => [r.id, r]));
  const now = Date.now();

  db.transaction((tx) => {
    const keep = new Set(input.rows.map((r) => r.id).filter(Boolean) as string[]);
    const toDelete = [...existing.keys()].filter((id) => !keep.has(id));
    if (toDelete.length) tx.delete(schema.testResults).where(inArray(schema.testResults.id, toDelete)).run();

    input.rows.forEach((row, position) => {
      const vm = row.valueText.match(/^([<>]=?)?\s*(\d+(?:[.,]\d+)?)$/);
      const valueNum = vm && !vm[1] ? Number(vm[2].replace(",", ".")) : null;
      const prevRow = row.id ? existing.get(row.id) : undefined;
      // A range the app derived (lab range sheet) is re-derived, not re-parsed; a typed range is "printed".
      const derived = !!prevRow && (prevRow.refText ?? "") === (row.refText ?? "") && DERIVED_REASONS.has(prevRow.statusReason ?? "");
      const range = row.refText && !derived ? parseRange(row.refText) : null;
      const canonical = matchTest(row.testName);
      const fields = {
        testName: row.testName,
        canonicalKey: canonical?.key ?? null,
        valueText: row.valueText,
        valueNum,
        unit: row.unit || null,
        refText: derived ? null : row.refText || null,
        refLow: range?.low ?? null,
        refHigh: range?.high ?? null,
        labFlag: row.labFlag || null,
      };
      const c = evaluateResult(fields, { labName: input.labName, age: input.patientAge, sex: input.patientSex });
      const stored = { ...fields, refText: c.refText, refLow: c.refLow, refHigh: c.refHigh, status: c.status, statusReason: c.statusReason };
      if (prevRow) {
        tx.update(schema.testResults)
          .set({ ...stored, position, needsReview: false, reviewReason: null, userVerified: true })
          .where(eq(schema.testResults.id, prevRow.id))
          .run();
      } else {
        tx.insert(schema.testResults)
          .values({ id: newId(), reportId, userId, position, ...stored, userVerified: true, createdAt: now })
          .run();
      }
    });

    tx.update(schema.reports)
      .set({ status: "confirmed", confirmedAt: now, labName: input.labName, reportDate: input.reportDate, patientAge: input.patientAge, patientSex: input.patientSex })
      .where(eq(schema.reports.id, report.id))
      .run();
    // Results changed: any cached explanation is stale
    tx.delete(schema.explanations).where(eq(schema.explanations.reportId, reportId)).run();
    tx.insert(schema.notifications)
      .values({ id: newId(), userId, kind: "report_ready", refId: reportId, createdAt: now })
      .run();
  });
  audit(userId, "report.confirmed", { type: "report", id: reportId }, { rows: input.rows.length });
}

export function deleteReport(userId: string, reportId: string) {
  const r = getOwnedReport(userId, reportId);
  db.delete(schema.reports).where(eq(schema.reports.id, r.id)).run();
  deleteBlob(r.storageKey);
  audit(userId, "report.deleted", { type: "report", id: reportId });
}

/* ───────────── History ───────────── */

export type HistoryPoint = {
  reportId: string;
  date: string | null;
  labName: string | null;
  valueNum: number | null;
  valueText: string;
  unit: string | null;
  refText: string | null;
  status: TestResult["status"];
};

/** Confirmed values of the same test across the user's own reports, oldest first. */
export function getHistory(userId: string, canonicalKeys: string[]): Record<string, HistoryPoint[]> {
  if (!canonicalKeys.length) return {};
  const rows = db
    .select({ r: schema.testResults, rep: schema.reports })
    .from(schema.testResults)
    .innerJoin(schema.reports, eq(schema.reports.id, schema.testResults.reportId))
    .where(
      and(
        eq(schema.testResults.userId, userId),
        eq(schema.reports.status, "confirmed"),
        isNotNull(schema.testResults.canonicalKey),
        inArray(schema.testResults.canonicalKey, canonicalKeys),
      ),
    )
    .all();
  const out: Record<string, HistoryPoint[]> = {};
  for (const { r, rep } of rows) {
    (out[r.canonicalKey!] ??= []).push({
      reportId: rep.id,
      date: rep.reportDate ?? new Date(rep.createdAt).toISOString().slice(0, 10),
      labName: rep.labName,
      valueNum: r.valueNum,
      valueText: r.valueText,
      unit: r.unit,
      refText: r.refText,
      status: r.status,
    });
  }
  for (const k in out) out[k].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  return out;
}

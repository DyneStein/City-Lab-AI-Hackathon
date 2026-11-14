import { notFound } from "next/navigation";
import { requireUser, HttpError } from "@/lib/auth/session";
import { getDict } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n/dictionaries";
import { getOwnedReport, getResults } from "@/lib/reports/service";
import { testDisplayName } from "@/lib/knowledge/library";
import { ConfirmEditor } from "./confirm-editor";
import { NeedsOcr } from "./needs-ocr";
import { AppBar } from "@/components/ui";

const KNOWN_REASONS = new Set(["unit_missing", "range_unclear", "low_ocr", "decimal"]);

/** Translatable reason codes; rows flagged before codes existed fall back to "hard to read". */
function reasonCodes(needsReview: boolean, raw: string | null): string[] {
  if (!needsReview) return [];
  const codes = (raw ?? "").split(",").filter((c) => KNOWN_REASONS.has(c));
  return codes.length ? codes : ["low_ocr"];
}

export default async function ConfirmPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { t, lang } = await getDict();
  let report;
  try {
    report = getOwnedReport(user.id, id);
  } catch (e) {
    if (e instanceof HttpError) notFound();
    throw e;
  }
  const rows = getResults(id);
  if (report.status === "needs_ocr")
    return (
      <>
        <AppBar backHref="/home" backLabel={t.common.back} />
        <NeedsOcr reportId={id} labels={{ reading: t.scan.reading, extracting: t.scan.extracting, failed: t.scan.failed }} />
      </>
    );

  return (
    <ConfirmEditor
      reportId={id}
      t={t.confirm}
      common={t.common}
      initial={{
        labName: report.labName ?? "",
        reportDate: report.reportDate ?? "",
        dateLabel: report.reportDate ? formatDate(report.reportDate, lang, "long") : "",
        patientAge: report.patientAge ?? null,
        patientSex: report.patientSex ?? null,
        rows: rows.map((r) => ({
          key: r.id,
          id: r.id,
          name: testDisplayName(r.canonicalKey, r.testName, lang),
          testName: r.testName,
          valueText: r.valueText,
          unit: r.unit ?? "",
          refText: r.refText ?? "",
          labFlag: r.labFlag ?? "",
          reasons: reasonCodes(r.needsReview, r.reviewReason),
        })),
      }}
    />
  );
}

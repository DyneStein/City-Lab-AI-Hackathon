import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { requireUser, HttpError, type SessionUser } from "@/lib/auth/session";
import { getDict } from "@/lib/i18n/server";
import { formatDate, type Dict, type Lang } from "@/lib/i18n/dictionaries";
import { aiConfigured } from "@/lib/env";
import { getHistory, getLayout, getOwnedReport, getResults, type Report, type TestResult } from "@/lib/reports/service";
import { getFullExplanation, getSummary } from "@/lib/ai/explain";
import { testDisplayName } from "@/lib/knowledge/library";
import { ReportView } from "@/components/report/report-view";
import type { Direction, ViewResult } from "@/components/report/types";

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { tab } = await searchParams;
  const { t, lang } = await getDict();
  let report: Report;
  try {
    report = getOwnedReport(user.id, id);
  } catch (e) {
    if (e instanceof HttpError) notFound();
    throw e;
  }
  // Nothing is explained until the user has checked the extracted values.
  if (report.status !== "confirmed") redirect(`/reports/${id}/confirm`);

  return (
    <Suspense fallback={<Loading label={t.report.generating} />}>
      <Loaded user={user} report={report} t={t} lang={lang} tab={tab === "details" || tab === "original" ? tab : "summary"} />
    </Suspense>
  );
}

function direction(r: TestResult): Direction {
  if (/^(HH|LL|CRITICAL|CRIT|PANIC)$/i.test(r.labFlag ?? "")) return "critical";
  if (r.status === "within") return "within";
  if (r.valueNum !== null && r.refLow !== null && r.valueNum < r.refLow) return "below";
  if (r.valueNum !== null && r.refHigh !== null && r.valueNum > r.refHigh) return "above";
  if (r.status === "unknown") return "none";
  return "flagged";
}

async function Loaded({ user, report, t, lang, tab }: { user: SessionUser; report: Report; t: Dict; lang: Lang; tab: "summary" | "details" | "original" }) {
  const results = getResults(report.id);
  // One AI request at a time keeps us inside free-tier per-minute limits.
  const full = await getFullExplanation(user, report, lang);
  const summary = await getSummary(user, report, lang, t.report.fallbackQuestions);
  const byId = new Map(full.data.tests.map((x) => [x.id, x]));
  const history = getHistory(user.id, results.map((r) => r.canonicalKey).filter(Boolean) as string[]);
  const layout = getLayout(report);
  const pages = layout?.pages.map((p) => ({ page: p.page, width: p.width, height: p.height })) ?? [{ page: 1, width: 595, height: 842 }];

  const view: ViewResult[] = results.map((r) => {
    const e = byId.get(r.id);
    const prev = (history[r.canonicalKey ?? ""] ?? []).filter((h) => h.reportId !== report.id).slice(-3);
    const last = prev.at(-1);
    let trend: ViewResult["trend"] = null;
    if (last) {
      if ((last.unit ?? "").toLowerCase() !== (r.unit ?? "").toLowerCase()) trend = "units";
      else if (last.valueNum !== null && r.valueNum !== null) {
        const d = (r.valueNum - last.valueNum) / Math.max(Math.abs(last.valueNum), 1e-9);
        trend = Math.abs(d) < 0.03 ? "same" : d > 0 ? "up" : "down";
      }
    }
    return {
      id: r.id,
      name: testDisplayName(r.canonicalKey, r.testName, lang),
      valueText: r.valueText,
      valueNum: r.valueNum,
      unit: r.unit,
      refText: r.refText,
      refLow: r.refLow,
      refHigh: r.refHigh,
      status: r.status,
      direction: direction(r),
      page: r.page,
      box: r.bbox ? (JSON.parse(r.bbox) as [number, number, number, number]) : null,
      explanation: e
        ? {
            measures: e.measures,
            meaning: e.meaning,
            reasons: e.reasons,
            context: e.context,
            discussLevel: e.discuss.level,
            discussText: e.discuss.text,
            sources: e.sourceIds.map((sid) => full.data.sources.find((s) => s.id === sid)).filter((s): s is NonNullable<typeof s> => !!s).map((s) => ({ n: s.id + 1, url: s.url })),
          }
        : null,
      history: prev.map((h) => ({ date: h.date ? formatDate(h.date, lang) : "", valueText: h.valueText, unit: h.unit, refText: h.refText })),
      trend,
    };
  });

  const reason = full.fallbackReason ?? summary.fallbackReason;
  const notice = reason === "ai_off" ? t.report.aiOff : reason === "privacy_unavailable" ? t.report.privacyOff : reason === "ai_failed" ? t.report.aiFailed : null;

  return (
    <ReportView
      report={{ id: report.id, title: report.labName ?? report.fileName, date: formatDate(report.reportDate ?? report.createdAt, lang, "long"), mimeType: report.mimeType }}
      results={view}
      summary={{ overview: summary.data.overview, attention: summary.data.attention, observations: summary.data.observations, questions: summary.data.questions }}
      notice={notice}
      pages={pages}
      aiEnabled={aiConfigured()}
      t={t}
      lang={lang}
      initialTab={tab}
    />
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-live="polite" className="pt-16">
      <div className="skeleton h-4 w-28" />
      <div className="skeleton mt-3 h-8 w-64" />
      <div className="skeleton mt-8 h-11 w-full rounded-[14px]" />
      <p className="mt-6 text-[15px] text-ink-3">{label}</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton mt-3 h-16 w-full rounded-[18px]" />
      ))}
    </div>
  );
}

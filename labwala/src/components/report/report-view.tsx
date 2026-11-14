"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUp, ChevronLeft, ChevronRight, Loader2, MessageCircle, MoreHorizontal, OctagonAlert, Trash2 } from "lucide-react";
import { deleteReportAction } from "@/app/actions";
import { fmt, type Dict, type Lang } from "@/lib/i18n/dictionaries";
import type { ResultStatus } from "@/lib/reports/types";
import { Sheet } from "@/components/sheet";
import { SpeechPlayer } from "@/components/speech";
import { Button, cx, statusDot, statusText } from "@/components/ui";
import { OriginalViewer } from "./original-viewer";
import { LangMenu } from "@/components/lang-menu";
import { TestSheet } from "./test-sheet";
import type { ViewResult, ViewSummary } from "./types";

type Tab = "summary" | "details" | "original";

export function ReportView({
  report,
  results,
  summary,
  notice,
  pages,
  aiEnabled,
  t,
  lang,
  initialTab,
}: {
  report: { id: string; title: string; date: string; mimeType: string };
  results: ViewResult[];
  summary: ViewSummary;
  notice: string | null;
  pages: { page: number; width: number; height: number }[];
  aiEnabled: boolean;
  t: Dict;
  lang: Lang;
  initialTab: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [open, setOpen] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [ask, setAsk] = useState(false);
  const byId = new Map(results.map((r) => [r.id, r]));
  const outside = results.filter((r) => r.status !== "within" && r.status !== "unknown").length;
  const urgent = results.some((r) => r.status === "urgent");
  const speechLabels = { listen: t.common.listen, pause: t.common.pause, resume: t.common.resume, stop: t.common.stop, noVoice: t.common.noVoice };

  const groups: { status: ResultStatus; label: string }[] = [
    { status: "urgent", label: t.report.groups.urgent },
    { status: "review", label: t.report.groups.review },
    { status: "outside", label: t.report.groups.outside },
    { status: "unknown", label: t.report.groups.unknown },
  ];
  const within = results.filter((r) => r.status === "within");

  const listenText = [
    summary.overview,
    ...results.filter((r) => r.status !== "within").map((r) => `${r.name}: ${t.report.direction[r.direction]}. ${r.explanation?.meaning ?? ""}`),
    summary.questions.length ? `${t.report.questions}: ${summary.questions.join(" ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="pb-28">
      {/* App bar */}
      <header className="sticky top-0 z-30 lg:top-16 -mx-4 flex h-14 items-center gap-1 bg-bg/85 px-2 backdrop-blur-xl sm:-mx-6">
        <Link href="/home" aria-label={t.common.back} className="grid size-11 place-items-center rounded-full text-ink hover:bg-surface-2">
          <ChevronLeft className="size-6 rtl:-scale-x-100" aria-hidden />
        </Link>
        <p dir="auto" className="min-w-0 flex-1 truncate px-1 text-center text-[16px] font-semibold text-ink">{report.title}</p>
        <LangMenu current={lang} title={t.common.language} closeLabel={t.common.close} />
        <button onClick={() => setMenu(true)} aria-label={t.common.more} className="grid size-11 place-items-center rounded-full text-ink hover:bg-surface-2">
          <MoreHorizontal className="size-6" aria-hidden />
        </button>
      </header>

      {/* At a glance */}
      <section className="pb-5 pt-3 rise-in">
        <p className="text-[14px] text-ink-3">{report.date}</p>
        <p className="mt-1 font-display text-[28px] leading-[1.2] text-ink">
          {outside ? fmt(t.report.outsideCount, { n: outside }) : t.report.allWithin}
        </p>
        <p className="mt-1 text-[15px] text-ink-2">{fmt(t.report.testsCount, { n: results.length })}</p>
      </section>

      {urgent && (
        <div role="alert" className="mb-5 flex gap-3 rounded-[18px] bg-urgent-soft p-4">
          <OctagonAlert className="mt-0.5 size-5 shrink-0 text-urgent" aria-hidden />
          <div className="text-[15px] leading-relaxed text-ink">
            <p className="font-semibold">{t.safety.urgentBanner}</p>
            <p className="mt-1">{t.safety.emergency}</p>
          </div>
        </div>
      )}

      {/* Segmented control */}
      <div role="tablist" className="mb-6 grid grid-cols-3 rounded-[14px] bg-surface-2 p-1">
        {(["summary", "details", "original"] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cx("h-10 truncate rounded-[11px] px-2 text-[14.5px] transition-all", tab === k ? "bg-surface font-semibold text-ink shadow-[var(--shadow)]" : "text-ink-2")}
          >
            {t.report.tabs[k]}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <div className="fade-in">
          {summary.overview && <p className="mb-6 rounded-[18px] bg-surface p-4 text-[16.5px] leading-relaxed text-ink shadow-[var(--shadow)]">{summary.overview}</p>}

          {groups.map((g) => {
            const items = results.filter((r) => r.status === g.status && g.status !== "unknown");
            if (!items.length) return null;
            return (
              <ResultGroup key={g.status} label={g.label} status={g.status}>
                {items.map((r) => (
                  <ResultRow key={r.id} r={r} t={t} note={summary.attention.find((a) => a.id === r.id)?.text} onOpen={() => setOpen(r.id)} />
                ))}
              </ResultGroup>
            );
          })}

          {!outside && within.length > 0 && (
            <ResultGroup label={t.report.groups.within} status="within">
              {within.map((r) => (
                <ResultRow key={r.id} r={r} t={t} onOpen={() => setOpen(r.id)} />
              ))}
            </ResultGroup>
          )}

          {outside > 0 && within.length > 0 && (
            <button onClick={() => setTab("details")} className="mb-7 flex h-14 w-full items-center justify-between rounded-[18px] bg-surface px-4 text-[15.5px] text-ink shadow-[var(--shadow)]">
              <span className="flex items-center gap-2.5">
                <span className="size-2.5 rounded-full bg-within" aria-hidden />
                {fmt(t.report.showWithin, { n: within.length })}
              </span>
              <ChevronRight className="size-5 text-ink-3 rtl:-scale-x-100" aria-hidden />
            </button>
          )}

          {summary.questions.length > 0 && (
            <section className="mb-7">
              <h2 className="mb-2 px-1 text-[14px] font-semibold text-ink-2">{t.report.questions}</h2>
              <ol className="overflow-hidden rounded-[18px] bg-surface shadow-[var(--shadow)] divide-y divide-line">
                {summary.questions.map((q, i) => (
                  <li key={i} className="flex gap-3 px-4 py-3.5 text-[15.5px] leading-relaxed text-ink">
                    <span className="ltr-num mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[12px] font-semibold text-ink-2">{i + 1}</span>
                    {q}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}

      {tab === "details" && (
        <div className="fade-in">
          {[...groups, { status: "within" as const, label: t.report.groups.within }].map((g) => {
            const items = results.filter((r) => r.status === g.status);
            if (!items.length) return null;
            return (
              <ResultGroup key={g.status} label={g.label} status={g.status}>
                {items.map((r) => (
                  <ResultRow key={r.id} r={r} t={t} onOpen={() => setOpen(r.id)} />
                ))}
              </ResultGroup>
            );
          })}
        </div>
      )}

      {tab === "original" && (
        <div className="fade-in">
          <p className="mb-3 text-[14.5px] text-ink-2">{t.report.tapToExplain}</p>
          <OriginalViewer
            reportId={report.id}
            mimeType={report.mimeType}
            pages={pages}
            results={results}
            selected={open}
            onSelect={setOpen}
            labels={{ explain: t.report.explain, loadError: t.report.loadError, page: t.scan.page }}
          />
        </div>
      )}

      {/* Honest, quiet footnote instead of a banner */}
      <footer className="mt-4 space-y-2 px-1 text-[13px] leading-relaxed text-ink-3">
        {notice && <p>{notice}</p>}
        <p>{t.safety.disclaimer}</p>
      </footer>

      {/* Document toolbar in the thumb zone */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-bg/92 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl gap-3">
          <SpeechPlayer large className="flex-1" text={listenText} lang={lang} labels={speechLabels} />
          <Button onClick={() => setAsk(true)} className="flex-1">
            <MessageCircle className="size-5" aria-hidden />
            {t.report.ask}
          </Button>
        </div>
      </div>

      <TestSheet r={open ? (byId.get(open) ?? null) : null} t={t} lang={lang} onClose={() => setOpen(null)} />

      <AskSheet open={ask} onClose={() => setAsk(false)} reportId={report.id} enabled={aiEnabled} t={t} lang={lang} />

      <Sheet open={menu} onClose={() => setMenu(false)} closeLabel={t.common.close} title={report.title}>
        <form
          action={deleteReportAction.bind(null, report.id)}
          onSubmit={(e) => {
            if (!confirm(t.report.deleteConfirm)) e.preventDefault();
          }}
        >
          <button className="flex h-14 w-full items-center gap-3 rounded-[16px] bg-urgent-soft px-4 text-[16px] font-medium text-urgent">
            <Trash2 className="size-5" aria-hidden />
            {t.report.delete}
          </button>
        </form>
      </Sheet>
    </div>
  );
}

function ResultGroup({ label, status, children }: { label: string; status: ResultStatus; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className={cx("mb-2 flex items-center gap-2 px-1 text-[14px] font-semibold", statusText[status])}>
        <span className={cx("size-2.5 rounded-full", statusDot[status])} aria-hidden />
        {label}
      </h2>
      <ul className="overflow-hidden rounded-[18px] bg-surface shadow-[var(--shadow)] divide-y divide-line">{children}</ul>
    </section>
  );
}

function ResultRow({ r, t, note, onOpen }: { r: ViewResult; t: Dict; note?: string; onOpen: () => void }) {
  return (
    <li>
      <button onClick={onOpen} className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-start transition-colors active:bg-surface-2">
        <span className="min-w-0 flex-1">
          <span dir="auto" className="block truncate text-start text-[16px] font-medium text-ink">{r.name}</span>
          <span className="mt-0.5 block text-[13.5px] leading-snug text-ink-3">{note || t.report.direction[r.direction]}</span>
        </span>
        <span className="ltr-num shrink-0 text-end" dir="ltr">
          <span className={cx("text-[17px] font-semibold", statusText[r.status] === "text-within" ? "text-ink" : statusText[r.status])}>{r.valueText}</span>
          {r.unit && <span className="ms-1 text-[12.5px] text-ink-3">{r.unit}</span>}
        </span>
        <ChevronRight className="size-5 shrink-0 text-ink-3/70 rtl:-scale-x-100" aria-hidden />
      </button>
    </li>
  );
}

type Msg = { role: "user" | "assistant"; content: string };

function AskSheet({ open, onClose, reportId, enabled, t, lang }: { open: boolean; onClose: () => void; reportId: string; enabled: boolean; t: Dict; lang: Lang }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const question = q.trim();
    if (!question || busy) return;
    setBusy(true);
    setError(null);
    setQ("");
    const history = messages;
    setMessages((m) => [...m, { role: "user", content: question }]);
    try {
      const res = await fetch(`/api/reports/${reportId}/ask`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, history }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages((m) => [...m, { role: "assistant", content: data.answer }]);
    } catch (err) {
      setError((err as Error).message === "privacy_unavailable" ? t.ask.privacyOff : t.ask.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      tall
      closeLabel={t.common.close}
      title={t.ask.title}
      footer={
        enabled ? (
          <form onSubmit={send} className="flex items-end gap-2">
            <textarea
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) send(e);
              }}
              rows={1}
              maxLength={1000}
              placeholder={t.ask.placeholder}
              aria-label={t.ask.title}
              className="min-h-12 flex-1 resize-none rounded-[16px] border border-line-strong bg-surface px-4 py-3 text-[16px] outline-none focus:border-accent"
            />
            <button type="submit" disabled={busy || !q.trim()} aria-label={t.ask.send} className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-white disabled:opacity-40">
              <ArrowUp className="size-5" />
            </button>
          </form>
        ) : undefined
      }
    >
      {!enabled ? (
        <p className="py-6 text-center text-[16px] leading-relaxed text-ink-2">{t.ask.off}</p>
      ) : (
        <div className="flex flex-col gap-3 py-2" aria-live="polite">
          {messages.length === 0 && <p className="py-6 text-center text-[15px] text-ink-3">{t.safety.disclaimer}</p>}
          {messages.map((m, i) => (
            <div key={i} className={cx("max-w-[88%] rounded-[20px] px-4 py-3 text-[16px] leading-relaxed", m.role === "user" ? "ms-auto rounded-ee-[6px] bg-accent text-white" : "rounded-es-[6px] bg-surface text-ink shadow-[var(--shadow)]")}>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.role === "assistant" && (
                <SpeechPlayer compact className="mt-2" text={m.content} lang={lang} labels={{ listen: t.common.listen, pause: t.common.pause, resume: t.common.resume, stop: t.common.stop, noVoice: "" }} />
              )}
            </div>
          ))}
          {busy && (
            <p className="flex items-center gap-2 text-[14px] text-ink-3">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t.common.loading}
            </p>
          )}
          {error && <p className="rounded-[14px] bg-outside-soft px-4 py-3 text-[15px] text-ink">{error}</p>}
        </div>
      )}
    </Sheet>
  );
}


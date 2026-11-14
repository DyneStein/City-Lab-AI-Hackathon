import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Bell, ChevronRight, ScanLine } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDict } from "@/lib/i18n/server";
import { fmt, formatDate } from "@/lib/i18n/dictionaries";
import { db, schema } from "@/lib/db";
import { getResults, listReports } from "@/lib/reports/service";
import { STATUS_ORDER } from "@/lib/reports/classify";
import { ButtonLink, Card, cx, statusDot } from "@/components/ui";
import { ReportThumb } from "@/components/report/thumb";
import { LangMenu } from "@/components/lang-menu";
import { GmailAutoSync } from "@/components/gmail-auto-sync";
import { getConnection } from "@/lib/gmail";
import { dismissNotificationAction } from "@/app/actions";

export default async function HomePage() {
  const user = await requireUser();
  const { t, lang } = await getDict();
  const reports = listReports(user.id).map((r) => {
    const results = getResults(r.id);
    return { r, results, outside: results.filter((x) => x.status !== "within" && x.status !== "unknown").length };
  });
  const latest = reports.find((x) => x.r.status === "confirmed") ?? reports[0];
  const rest = reports.filter((x) => x !== latest);
  const notification = db
    .select()
    .from(schema.notifications)
    .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)))
    .orderBy(desc(schema.notifications.createdAt))
    .get();
  const firstName = user.profile?.fullName.split(" ")[0] ?? "";
  const href = (x: (typeof reports)[number]) => (x.r.status === "confirmed" ? `/reports/${x.r.id}` : `/reports/${x.r.id}/confirm`);
  const summary = (x: (typeof reports)[number]) =>
    x.outside ? fmt(t.home.testsSummary, { total: x.results.length, outside: x.outside }) : fmt(t.home.allWithin, { total: x.results.length });

  return (
    <div>
      {getConnection(user.id) && <GmailAutoSync />}
      <header className="mb-6 flex items-start justify-between gap-3 pt-3 rise-in">
        <div className="min-w-0">
          <p className="text-[15px] text-ink-3">{t.home.greeting}</p>
          <h1 dir="auto" className="truncate text-start font-display text-[34px] leading-[1.15] text-ink">{firstName}</h1>
        </div>
        <LangMenu current={lang} title={t.common.language} closeLabel={t.common.close} />
      </header>

      {/* One notification at a time, never with medical values */}
      {notification && (
        <div className="mb-6 flex items-center gap-3 rounded-[18px] bg-accent-soft p-2 ps-4 rise-in">
          <Bell className="size-5 shrink-0 text-accent" aria-hidden />
          <Link href={notification.refId ? `/reports/${notification.refId}` : "/home"} className="min-w-0 flex-1 py-2 text-[15px] leading-snug text-ink">
            {t.notif[notification.kind as keyof typeof t.notif] ?? t.notif.report_ready}
          </Link>
          <form action={dismissNotificationAction.bind(null, notification.id)}>
            <button className="h-10 rounded-full px-3 text-[14px] text-ink-2 hover:bg-white/60">{t.common.close}</button>
          </form>
        </div>
      )}

      {!latest ? (
        <Card className="flex flex-col items-center px-6 py-12 text-center rise-in">
          <span className="mb-5 grid size-16 place-items-center rounded-full bg-accent-soft text-accent">
            <ScanLine className="size-8" aria-hidden />
          </span>
          <h2 className="text-[20px] font-semibold text-ink">{t.home.emptyTitle}</h2>
          <p className="mt-2 max-w-[36ch] text-[15px] leading-relaxed text-ink-2">{t.home.emptyBody}</p>
          <ButtonLink href="/scan" className="mt-6 px-7">
            <ScanLine className="size-5" aria-hidden />
            {t.home.scanCta}
          </ButtonLink>
        </Card>
      ) : (
        <>
          {/* Latest report: the one thing most people came for */}
          <section className="mb-8 rise-in" aria-labelledby="latest">
            <h2 id="latest" className="mb-2 px-1 text-[14px] font-semibold text-ink-2">
              {t.home.latest}
            </h2>
            <Link href={href(latest)} className="block overflow-hidden rounded-[22px] bg-surface shadow-[var(--shadow)] transition active:scale-[0.99]">
              <div className="flex gap-4 p-4">
                <ReportThumb reportId={latest.r.id} mimeType={latest.r.mimeType} className="h-[112px] w-[84px] shrink-0 rounded-[10px] border border-line" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <p dir="auto" className="truncate text-start text-[17px] font-semibold text-ink">{latest.r.labName ?? latest.r.fileName}</p>
                  <p className="text-[14px] text-ink-3">{formatDate(latest.r.reportDate ?? latest.r.createdAt, lang)}</p>
                  {latest.r.status === "confirmed" ? (
                    <>
                      <p className="mt-auto text-[14.5px] text-ink-2">{summary(latest)}</p>
                      <StatusStrip statuses={latest.results.map((x) => x.status)} />
                    </>
                  ) : (
                    <span className="mt-auto self-start rounded-full bg-outside-soft px-3 py-1 text-[13px] font-medium text-outside">{t.home.status[latest.r.status]}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-line px-4 py-3.5 text-[15px] font-medium text-accent">
                {latest.r.status === "confirmed" ? t.report.tabs.summary : t.home.status.extracted}
                <ChevronRight className="size-5 rtl:-scale-x-100" aria-hidden />
              </div>
            </Link>
          </section>

          {rest.length > 0 && (
            <section aria-labelledby="all">
              <h2 id="all" className="mb-2 px-1 text-[14px] font-semibold text-ink-2">
                {t.home.all}
              </h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {rest.map((x) => (
                  <li key={x.r.id}>
                    <Link href={href(x)} className="block overflow-hidden rounded-[18px] bg-surface shadow-[var(--shadow)] transition active:scale-[0.98]">
                      <ReportThumb reportId={x.r.id} mimeType={x.r.mimeType} className="aspect-[3/4] w-full border-b border-line" />
                      <div className="p-3">
                        <p dir="auto" className="truncate text-start text-[14.5px] font-medium text-ink">{x.r.labName ?? x.r.fileName}</p>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="truncate text-[12.5px] text-ink-3">{formatDate(x.r.reportDate ?? x.r.createdAt, lang)}</span>
                          {x.r.status === "confirmed" ? (
                            x.outside > 0 && <span className="shrink-0 rounded-full bg-outside-soft px-2 text-[12px] font-medium text-outside">{x.outside}</span>
                          ) : (
                            <span className="size-2 shrink-0 rounded-full bg-outside" aria-label={t.home.status[x.r.status]} />
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function StatusStrip({ statuses }: { statuses: (keyof typeof statusDot)[] }) {
  const sorted = [...statuses].sort((a, b) => STATUS_ORDER[a] - STATUS_ORDER[b]);
  return (
    <div className="mt-2 flex h-1.5 gap-[2px] overflow-hidden rounded-full" aria-hidden>
      {sorted.map((s, i) => (
        <span key={i} className={cx("h-full flex-1", statusDot[s])} />
      ))}
    </div>
  );
}

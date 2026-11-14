import { and, eq, isNotNull } from "drizzle-orm";
import { History } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDict } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n/dictionaries";
import { db, schema } from "@/lib/db";
import { getHistory } from "@/lib/reports/service";
import { parseRange } from "@/lib/reports/parse";
import { testDisplayName } from "@/lib/knowledge/library";
import { ButtonLink, Card, LargeTitle } from "@/components/ui";
import { HistoryList, type Series } from "./history-list";

export default async function HistoryPage() {
  const user = await requireUser();
  const { t, lang } = await getDict();
  const keys = db
    .selectDistinct({ k: schema.testResults.canonicalKey })
    .from(schema.testResults)
    .where(and(eq(schema.testResults.userId, user.id), isNotNull(schema.testResults.canonicalKey)))
    .all()
    .map((r) => r.k!);
  const history = getHistory(user.id, keys);

  const series: Series[] = Object.entries(history)
    .filter(([, pts]) => pts.length > 0)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([key, pts]) => ({
      key,
      name: testDisplayName(key, key, lang),
      unit: pts.at(-1)!.unit,
      unitsDiffer: new Set(pts.map((p) => (p.unit ?? "").toLowerCase())).size > 1,
      points: pts.map((p) => {
        const range = p.refText ? parseRange(p.refText) : null;
        return {
          date: p.date ?? "",
          dateLabel: p.date ? formatDate(p.date, lang) : "",
          valueText: p.valueText,
          valueNum: p.valueNum,
          refText: p.refText,
          low: range?.low ?? null,
          high: range?.high ?? null,
          status: p.status,
        };
      }),
    }));

  return (
    <>
      <LargeTitle title={t.history.title} subtitle={series.length ? t.history.subtitle : undefined} />
      {series.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-12 text-center">
          <span className="mb-4 grid size-14 place-items-center rounded-full bg-surface-2 text-ink-2">
            <History className="size-7" aria-hidden />
          </span>
          <p className="max-w-[34ch] text-[15.5px] leading-relaxed text-ink-2">{t.history.empty}</p>
          <ButtonLink href="/scan" className="mt-6">
            {t.home.scanCta}
          </ButtonLink>
        </Card>
      ) : (
        <HistoryList series={series} t={t} />
      )}
    </>
  );
}

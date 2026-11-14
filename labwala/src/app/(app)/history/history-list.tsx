"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { ResultStatus } from "@/lib/reports/types";
import { Sheet } from "@/components/sheet";
import { StatusBadge, cx, statusText } from "@/components/ui";
import { TrendChart } from "./trend-chart";

export type Series = {
  key: string;
  name: string;
  unit: string | null;
  unitsDiffer: boolean;
  points: { date: string; dateLabel: string; valueText: string; valueNum: number | null; refText: string | null; low: number | null; high: number | null; status: ResultStatus }[];
};

export function HistoryList({ series, t }: { series: Series[]; t: Dict }) {
  const [open, setOpen] = useState<Series | null>(null);
  return (
    <>
      <ul className="overflow-hidden rounded-[18px] bg-surface shadow-[var(--shadow)] divide-y divide-line">
        {series.map((s) => {
          const last = s.points.at(-1)!;
          return (
            <li key={s.key}>
              <button onClick={() => setOpen(s)} className="flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-start active:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-medium text-ink">{s.name}</span>
                  <span className="mt-0.5 block text-[13.5px] text-ink-3">{last.dateLabel}</span>
                </span>
                <Sparkline values={s.unitsDiffer ? [] : s.points.map((p) => p.valueNum)} status={last.status} />
                <span className="ltr-num w-[76px] shrink-0 text-end" dir="ltr">
                  <span className={cx("text-[17px] font-semibold", last.status === "within" ? "text-ink" : statusText[last.status])}>{last.valueText}</span>
                  <span className="block text-[12px] text-ink-3">{s.unit}</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-ink-3/70 rtl:-scale-x-100" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>

      <Sheet open={!!open} onClose={() => setOpen(null)} closeLabel={t.common.close} title={open?.name}>
        {open && (
          <div className="flex flex-col gap-5 pt-1">
            {!open.unitsDiffer && open.points.filter((p) => p.valueNum !== null).length >= 2 && (
              <div className="rounded-[18px] bg-surface p-3 shadow-[var(--shadow)]">
                <TrendChart
                  unit={open.unit}
                  points={open.points.filter((p) => p.valueNum !== null).map((p) => ({ date: p.dateLabel, value: p.valueNum!, low: p.low, high: p.high, lab: null }))}
                />
              </div>
            )}
            {open.unitsDiffer && <p className="rounded-[14px] bg-outside-soft p-3 text-[14.5px] text-ink">{t.report.unitsDiffer}</p>}
            <ul className="overflow-hidden rounded-[18px] bg-surface shadow-[var(--shadow)] divide-y divide-line">
              {[...open.points].reverse().map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block text-[15px] text-ink">{p.dateLabel}</span>
                    <span className="block text-[13px] text-ink-3">
                      {t.report.labRange}: <span className="ltr-num">{p.refText ?? "—"}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="ltr-num text-[16px] font-semibold text-ink" dir="ltr">
                      {p.valueText} <span className="text-[12px] font-normal text-ink-3">{open.unit}</span>
                    </span>
                    <StatusBadge compact status={p.status} label={t.status[p.status]} />
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-ink-3">{t.report.differentLabNote}</p>
          </div>
        )}
      </Sheet>
    </>
  );
}

function Sparkline({ values, status }: { values: (number | null)[]; status: ResultStatus }) {
  const v = values.filter((x): x is number => x !== null);
  if (v.length < 2) return <span className="w-14 shrink-0" />;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const pts = v.map((x, i) => `${(i / (v.length - 1)) * 52 + 2},${22 - ((x - min) / (max - min || 1)) * 18}`).join(" ");
  return (
    <svg width="56" height="26" viewBox="0 0 56 26" className={cx("shrink-0", statusText[status] === "text-within" ? "text-accent" : statusText[status])} aria-hidden style={{ direction: "ltr" }}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.split(" ").at(-1)!.split(",")[0]} cy={pts.split(" ").at(-1)!.split(",")[1]} r="2.6" fill="currentColor" />
    </svg>
  );
}

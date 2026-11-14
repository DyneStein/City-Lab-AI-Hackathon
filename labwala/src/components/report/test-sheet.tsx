"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { Dict, Lang } from "@/lib/i18n/dictionaries";
import { Sheet } from "@/components/sheet";
import { SpeechPlayer } from "@/components/speech";
import { StatusBadge, cx } from "@/components/ui";
import { RangeBar } from "./range-bar";
import type { ViewResult } from "./types";

/** One result, fully explained: progressive disclosure from the list. */
export function TestSheet({ r, t, lang, onClose }: { r: ViewResult | null; t: Dict; lang: Lang; onClose: () => void }) {
  const e = r?.explanation;
  const speak = r && e ? [r.name, e.measures, e.meaning, e.reasons.length ? `${t.report.reasons}: ${e.reasons.join("، ")}` : "", e.context, e.discussText].filter(Boolean).join(". ") : "";
  const TrendIcon = r?.trend === "up" ? ArrowUpRight : r?.trend === "down" ? ArrowDownRight : ArrowRight;

  return (
    <Sheet
      open={!!r}
      onClose={onClose}
      closeLabel={t.common.close}
      title={r?.name}
    >
      {r && (
        <div className="flex flex-col gap-6">
          {/* The number first: what the person is looking for */}
          <div>
            <div className="flex items-end justify-between gap-3">
              <p className="ltr-num" dir="ltr">
                <span className="text-[40px] font-semibold leading-none tracking-tight text-ink">{r.valueText}</span>
                {r.unit && <span className="ms-1.5 text-[16px] text-ink-3">{r.unit}</span>}
              </p>
              <StatusBadge status={r.status} label={t.status[r.status]} />
            </div>
            <p className="mt-3 text-[15px] text-ink-2">
              {t.report.labRange}: <span className="ltr-num text-ink">{r.refText ?? "—"}</span>
            </p>
            <div className="mt-2">
              <RangeBar low={r.refLow} high={r.refHigh} value={r.valueNum} status={r.status} />
            </div>
            <p className="mt-1 text-[14px] font-medium text-ink-2">{t.report.direction[r.direction]}</p>
            {speak && (
              <SpeechPlayer className="mt-4" text={speak} lang={lang} labels={{ listen: t.common.listen, pause: t.common.pause, resume: t.common.resume, stop: t.common.stop, noVoice: t.common.noVoice }} />
            )}
          </div>

          {e && (
            <>
              <Block title={t.report.measures}>{e.measures}</Block>
              <Block title={t.report.meaning}>{e.meaning}</Block>
              {e.reasons.length > 0 && (
                <Block title={t.report.reasons}>
                  <ul className="flex flex-col gap-1.5">
                    {e.reasons.map((x, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-ink-3" aria-hidden />
                        {x}
                      </li>
                    ))}
                  </ul>
                </Block>
              )}
              {e.context && <Block title={t.report.context}>{e.context}</Block>}
            </>
          )}

          {r.history.length > 0 && (
            <Block title={t.report.history}>
              <div className="overflow-hidden rounded-[14px] bg-surface shadow-[var(--shadow)]">
                {[...r.history, { date: t.report.current, valueText: r.valueText, unit: r.unit, refText: r.refText }].map((h, i, all) => (
                  <div key={i} className={cx("flex items-center justify-between gap-3 px-4 py-3 text-[15px]", i < all.length - 1 && "border-b border-line", i === all.length - 1 && "bg-surface-2/60 font-medium")}>
                    <span className="text-ink-2">{h.date}</span>
                    <span className="ltr-num text-ink" dir="ltr">
                      {h.valueText} <span className="text-ink-3">{h.unit}</span>
                    </span>
                  </div>
                ))}
              </div>
              {r.trend && (
                <p className="mt-2 flex items-center gap-1.5 text-[14px] text-ink-2">
                  {r.trend !== "units" && <TrendIcon className="size-4 shrink-0 rtl:-scale-x-100" aria-hidden />}
                  {r.trend === "up" ? t.report.trendUp : r.trend === "down" ? t.report.trendDown : r.trend === "same" ? t.report.trendSame : t.report.unitsDiffer}
                </p>
              )}
              <p className="mt-1 text-[13px] text-ink-3">{t.report.differentLabNote}</p>
            </Block>
          )}

          {e && (
            <div className={cx("rounded-[16px] p-4", e.discussLevel === "seek_care_promptly" ? "bg-urgent-soft" : e.discussLevel === "see_doctor_soon" ? "bg-review-soft" : "bg-surface-2")}>
              <p className="text-[14px] font-semibold text-ink">
                {t.report.discuss} · {t.report.discussLevels[e.discussLevel]}
              </p>
              <p className="mt-1 text-[15.5px] leading-relaxed text-ink">{e.discussText}</p>
            </div>
          )}

          {e && e.sources.length > 0 && (
            <p className="text-[13px] text-ink-3">
              {t.report.sources}:{" "}
              {e.sources.map((s) => (
                <a key={s.n} href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-accent">
                  {t.report.sourcePublisher}
                </a>
              ))}
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[14px] font-semibold text-ink-3">{title}</h3>
      <div className="text-[16px] leading-relaxed text-ink">{children}</div>
    </section>
  );
}

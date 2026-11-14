import type { ResultStatus } from "@/lib/reports/types";
import { cx, statusDot } from "@/components/ui";

/**
 * Where the value sits relative to the lab's printed range. Drawn only when the lab
 * printed both limits; nothing is inferred. Always left-to-right (numbers).
 */
export function RangeBar({ low, high, value, status }: { low: number | null; high: number | null; value: number | null; status: ResultStatus }) {
  if (low === null || high === null || value === null || high <= low) return null;
  const span = high - low;
  const min = Math.min(low - span * 0.5, value);
  const max = Math.max(high + span * 0.5, value);
  const pct = (n: number) => ((n - min) / (max - min)) * 100;
  const v = Math.min(98.5, Math.max(1.5, pct(value)));
  return (
    <div dir="ltr" className="relative mt-1 h-6" aria-hidden>
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-2" />
      <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-within/25" style={{ left: `${pct(low)}%`, width: `${pct(high) - pct(low)}%` }} />
      <div className={cx("absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-[3px] ring-surface", statusDot[status])} style={{ left: `${v}%` }} />
    </div>
  );
}

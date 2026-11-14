import type { ReactNode } from "react";
import { fmt, type Dict } from "@/lib/i18n/dictionaries";
import { AppBar, Card, LargeTitle } from "@/components/ui";

/** Honest placeholder for features scheduled in later phases. No mock data. */
export function PhasePlaceholder({ title, body, phase, icon, t, backHref }: { title: string; body: string; phase: number; icon: ReactNode; t: Dict; backHref?: string }) {
  return (
    <>
      {backHref ? <AppBar backHref={backHref} backLabel={t.common.back} title={title} /> : <LargeTitle title={title} />}
      <Card className="flex flex-col items-center px-6 py-12 text-center">
        <span className="mb-5 grid size-16 place-items-center rounded-full bg-surface-2 text-ink-2">{icon}</span>
        <p className="mb-3 rounded-full bg-outside-soft px-3 py-1 text-[13px] font-medium text-outside">
          {t.common.comingSoon} · {fmt(t.common.phase, { n: phase })}
        </p>
        <p className="max-w-[40ch] text-[15.5px] leading-relaxed text-ink-2">{body}</p>
      </Card>
    </>
  );
}

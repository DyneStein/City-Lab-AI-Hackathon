"use client";

import { useState, useTransition } from "react";
import { Check, Languages, Loader2 } from "lucide-react";
import { setLanguageAction } from "@/app/actions";
import { LANGS, type Lang } from "@/lib/i18n/dictionaries";
import { Sheet } from "./sheet";
import { cx } from "./ui";

/**
 * Compact language control for the top bar. The chosen language drives everything on screen,
 * including which voice "Listen" uses.
 */
export function LangMenu({ current, title, closeLabel }: { current: Lang; title: string; closeLabel: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const meta = LANGS.find((l) => l.code === current)!;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={title}
        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface px-3 text-[14px] font-medium text-ink shadow-[var(--shadow)] active:scale-95"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Languages className="size-4 text-accent" aria-hidden />}
        <span lang={meta.code}>{meta.native}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title} closeLabel={closeLabel}>
        <div className="flex flex-col gap-2 pb-2" role="radiogroup" aria-label={title}>
          {LANGS.map((l) => (
            <button
              key={l.code}
              role="radio"
              aria-checked={current === l.code}
              lang={l.code}
              dir={l.dir}
              onClick={() => {
                setOpen(false);
                if (l.code !== current) start(() => setLanguageAction(l.code));
              }}
              className={cx("flex h-14 items-center justify-between rounded-[16px] px-5 text-[18px] transition-colors", current === l.code ? "bg-accent-soft font-semibold text-ink" : "bg-surface text-ink shadow-[var(--shadow)]")}
            >
              {l.native}
              {current === l.code && <Check className="size-5 text-accent" aria-hidden />}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

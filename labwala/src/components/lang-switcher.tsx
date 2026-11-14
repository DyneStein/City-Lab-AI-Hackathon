"use client";

import { useTransition } from "react";
import { setLanguageAction } from "@/app/actions";
import { LANGS, type Lang } from "@/lib/i18n/dictionaries";
import { cx } from "./ui";

/** Segmented language control. Each option is written in its own language. */
export function LangSwitcher({ current, label, block, className }: { current: Lang; label: string; block?: boolean; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <div role="radiogroup" aria-label={label} className={cx("grid grid-cols-3 rounded-[14px] bg-surface-2 p-1", !block && "inline-grid", pending && "opacity-60", className)}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          role="radio"
          aria-checked={current === l.code}
          lang={l.code}
          dir={l.dir}
          onClick={() => start(() => setLanguageAction(l.code))}
          className={cx("h-10 rounded-[11px] px-3 text-[15px] leading-none transition-all", current === l.code ? "bg-surface font-semibold text-ink shadow-[var(--shadow)]" : "text-ink-2")}
        >
          {l.native}
        </button>
      ))}
    </div>
  );
}

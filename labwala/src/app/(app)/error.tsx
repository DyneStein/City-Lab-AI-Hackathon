"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { dictionaries, type Lang } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui";

/** Friendly fallback for any screen error, in the page's language. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const l = document.documentElement.lang;
    if (l === "ur" || l === "pa") setLang(l); // eslint-disable-line react-hooks/set-state-in-effect
    console.warn("[screen error]", error.digest ?? error.message);
  }, [error]);
  const t = dictionaries[lang].common;
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="mb-5 grid size-14 place-items-center rounded-full bg-outside-soft text-outside">
        <AlertTriangle className="size-7" aria-hidden />
      </span>
      <h1 className="text-[22px] font-semibold text-ink">{t.errorTitle}</h1>
      <p className="mt-2 max-w-[36ch] text-[15.5px] leading-relaxed text-ink-2">{t.errorBody}</p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>{t.tryAgain}</Button>
        <Link href="/home" className="inline-flex h-12 items-center rounded-[14px] px-5 text-[16px] text-ink-2 hover:bg-surface-2">
          {t.goHome}
        </Link>
      </div>
    </div>
  );
}

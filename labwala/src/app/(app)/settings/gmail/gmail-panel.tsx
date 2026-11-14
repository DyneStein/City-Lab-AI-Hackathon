"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Loader2, RefreshCw, X } from "lucide-react";
import { fmt, type Dict } from "@/lib/i18n/dictionaries";
import { Button, Input, Notice, cx } from "@/components/ui";
import { addSenderAction, disconnectGmailAction, removeSenderAction, resolvePendingAction } from "./actions";

type Pending = { id: string; filename: string; sender: string; when: string };

export function GmailPanel({ t, senders, pending, lastChecked }: { t: Dict["gmail"]; senders: string[]; pending: Pending[]; lastChecked: string | null }) {
  const router = useRouter();
  const [state, add, adding] = useActionState(addSenderAction, undefined);
  const [result, setResult] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [, start] = useTransition();

  async function check() {
    setChecking(true);
    setResult(null);
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      const d = await res.json();
      if (!res.ok) setResult(d.error === "gmail_reauth" ? t.errors.reauth : t.errors.failed);
      else setResult(fmt(t.result, { imported: d.imported ?? 0, pending: d.pending ?? 0 }));
      router.refresh();
    } catch {
      setResult(t.errors.failed);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <section>
        <h2 className="mb-2 px-1 text-[14px] font-semibold text-ink-2">{t.senders}</h2>
        <div className="overflow-hidden rounded-[18px] bg-surface shadow-[var(--shadow)]">
          {senders.length > 0 && (
            <ul className="divide-y divide-line">
              {senders.map((s) => (
                <li key={s} className="flex min-h-14 items-center gap-3 px-4">
                  <span className="ltr-num min-w-0 flex-1 truncate text-[15.5px] text-ink" dir="ltr">
                    {s}
                  </span>
                  <button onClick={() => start(() => removeSenderAction(s))} aria-label={`${t.remove}: ${s}`} className="grid size-11 place-items-center rounded-full text-ink-3 hover:bg-urgent-soft hover:text-urgent">
                    <X className="size-5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form action={add} className={cx("flex gap-2 p-3", senders.length > 0 && "border-t border-line")}>
            <Input name="email" type="email" inputMode="email" dir="ltr" placeholder={t.placeholder} aria-label={t.senders} required className="h-12 flex-1" />
            <Button type="submit" disabled={adding} className="h-12 px-5">
              {t.add}
            </Button>
          </form>
        </div>
        <p className="mt-2 px-1 text-[13.5px] leading-relaxed text-ink-3">{state?.error ? t.errors.invalid : t.sendersHint}</p>
      </section>

      <section>
        <Button block onClick={check} disabled={checking || senders.length === 0}>
          {checking ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <RefreshCw className="size-5" aria-hidden />}
          {checking ? t.checking : t.check}
        </Button>
        <p className="mt-2 px-1 text-center text-[13.5px] text-ink-3" aria-live="polite">
          {result ?? (senders.length === 0 ? t.noSenders : lastChecked ? fmt(t.lastChecked, { time: lastChecked }) : "")}
        </p>
      </section>

      {pending.length > 0 && (
        <section>
          <h2 className="mb-1 px-1 text-[14px] font-semibold text-outside">{t.pendingTitle}</h2>
          <p className="mb-2 px-1 text-[13.5px] text-ink-3">{t.pendingHint}</p>
          <ul className="overflow-hidden rounded-[18px] bg-surface shadow-[var(--shadow)] divide-y divide-line">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="size-5 shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="ltr-num block truncate text-[15px] text-ink" dir="ltr">
                    {p.filename}
                  </span>
                  <span className="ltr-num block truncate text-[12.5px] text-ink-3" dir="ltr">
                    {p.sender} · {p.when}
                  </span>
                </span>
                <button onClick={() => start(() => resolvePendingAction(p.id, false))} className="h-10 rounded-full px-3 text-[14px] text-ink-2 hover:bg-surface-2">
                  {t.ignore}
                </button>
                <button onClick={() => start(() => resolvePendingAction(p.id, true))} className="flex h-10 items-center gap-1 rounded-full bg-accent-soft px-3 text-[14px] font-medium text-accent">
                  <Check className="size-4" aria-hidden />
                  {t.import}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <form action={disconnectGmailAction}>
          <button className="flex h-14 w-full items-center justify-center rounded-[18px] bg-surface text-[16px] text-urgent shadow-[var(--shadow)] active:bg-urgent-soft">{t.disconnect}</button>
        </form>
        <p className="mt-2 px-1 text-center text-[13px] text-ink-3">{t.disconnectHint}</p>
      </section>
    </div>
  );
}

export function GmailNotice({ text, tone }: { text: string; tone: "info" | "warn" }) {
  return <Notice tone={tone}>{text}</Notice>;
}

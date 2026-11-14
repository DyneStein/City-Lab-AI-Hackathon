"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Camera, Loader2, RefreshCw, Smartphone, Wifi } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionaries";
import { Button } from "./ui";
import { Logo } from "./logo";

/*
 * On a laptop/desktop, LabWala first offers to continue on the phone (camera, mobile-first
 * layout) via a QR code. Only if the person chooses to stay does the computer version open.
 * The choice is remembered on this computer; the phone button in the top bar reopens it.
 */

const STAY_KEY = "labwala.stayOnComputer";
const FORCE_KEY = "labwala.showHandoff";
const EVENT = "labwala:handoff";

const safeGet = (s: Storage | undefined, k: string) => {
  try {
    return s?.getItem(k) ?? null;
  } catch {
    return null;
  }
};
const safeSet = (s: Storage | undefined, k: string, v: string | null) => {
  try {
    if (v === null) s?.removeItem(k);
    else s?.setItem(k, v);
  } catch {}
};

function isComputer() {
  return window.matchMedia("(pointer: fine) and (hover: hover)").matches && window.innerWidth >= 900;
}

function subscribe(cb: () => void) {
  window.addEventListener("resize", cb);
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("resize", cb);
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function shouldShow() {
  if (!isComputer()) return false;
  if (safeGet(window.sessionStorage, FORCE_KEY) === "1") return true;
  return safeGet(window.localStorage, STAY_KEY) !== "1";
}

/** Call from any "Open on phone" button. */
export function openHandoff() {
  safeSet(window.sessionStorage, FORCE_KEY, "1");
  window.dispatchEvent(new Event(EVENT));
}

export function DesktopHandoff({ t, appName }: { t: Dict["handoff"]; appName: string }) {
  const path = usePathname();
  const show = useSyncExternalStore(subscribe, shouldShow, () => false) && !path.startsWith("/handoff");
  const [qr, setQr] = useState<{ url: string; svg: string; signedIn: boolean } | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    fetch("/api/handoff", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        // Only replace the code with a valid one; on errors (e.g. too many refreshes) keep the current code.
        if (!cancelled && r.ok && typeof d?.url === "string" && typeof d?.svg === "string") setQr(d);
      })
      .catch(() => {});
    // One-time codes expire after 5 minutes: refresh a little before that.
    const timer = setTimeout(() => setNonce((n) => n + 1), 4.5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [show, nonce, path]);

  if (!show) return null;

  function stay() {
    safeSet(window.localStorage, STAY_KEY, "1");
    safeSet(window.sessionStorage, FORCE_KEY, null);
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="handoff-title" className="fixed inset-0 z-[80] overflow-y-auto bg-bg fade-in">
      <div className="mx-auto flex min-h-full max-w-4xl flex-col px-8 py-8">
        <Logo label={appName} />
        <div className="grid flex-1 items-center gap-14 py-10 md:grid-cols-[1fr_auto]">
          <div className="rise-in">
            <span className="mb-6 grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
              <Smartphone className="size-7" aria-hidden />
            </span>
            <h1 id="handoff-title" className="font-display text-[44px] leading-[1.1] tracking-[-0.015em] text-ink">
              {t.title}
            </h1>
            <p className="mt-4 max-w-[46ch] text-[18px] leading-relaxed text-ink-2">{t.body}</p>
            <ol className="mt-8 flex flex-col gap-4">
              {[
                { Icon: Camera, text: t.step1 },
                { Icon: Wifi, text: t.step2 },
              ].map(({ Icon, text }, i) => (
                <li key={i} className="flex items-start gap-4 text-[16px] leading-relaxed text-ink">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-ink-2 shadow-[var(--shadow)]">
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <span className="pt-1.5">{text}</span>
                </li>
              ))}
            </ol>
            <p className="mt-6 max-w-[48ch] text-[14px] leading-relaxed text-ink-3">{qr?.signedIn ? t.signedIn : t.signedOut}</p>
          </div>

          <div className="flex flex-col items-center gap-4 rise-in [animation-delay:100ms]">
            <div className="grid size-[280px] place-items-center rounded-[28px] bg-white p-5 shadow-[0_2px_6px_rgb(20_33_58/0.06),0_24px_60px_-24px_rgb(20_33_58/0.35)]">
              {qr ? (
                <div className="size-full [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qr.svg }} />
              ) : (
                <Loader2 className="size-8 animate-spin text-ink-3" aria-hidden />
              )}
            </div>
            {qr && (
              <p className="ltr-num max-w-[280px] truncate text-center text-[13px] text-ink-3" dir="ltr" title={qr.url}>
                {(qr.url ?? "").replace(/\/handoff\/.+$/, "")}
              </p>
            )}
            <button onClick={() => setNonce((n) => n + 1)} className="flex h-10 items-center gap-2 rounded-full px-4 text-[14px] text-ink-2 hover:bg-surface-2">
              <RefreshCw className="size-4" aria-hidden />
              {t.refresh}
            </button>
          </div>
        </div>
        <div className="flex justify-center pb-4">
          <Button variant="secondary" onClick={stay} className="px-8">
            {t.stay}
          </Button>
        </div>
      </div>
    </div>
  );
}

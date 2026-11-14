"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, Home, ScanLine, Smartphone, UserRound, Users } from "lucide-react";
import { openHandoff } from "@/components/desktop-handoff";
import type { Dict } from "@/lib/i18n/dictionaries";
import { cx } from "@/components/ui";

const tabs = [
  { href: "/home", id: "home", Icon: Home, match: ["/home", "/reports"] },
  { href: "/history", id: "history", Icon: History, match: ["/history"] },
  { href: "/family", id: "family", Icon: Users, match: ["/family"] },
  { href: "/settings", id: "me", Icon: UserRound, match: ["/settings", "/doctors", "/shared"] },
] as const;

const active = (path: string, match: readonly string[]) => match.some((m) => path === m || path.startsWith(m + "/"));

/** Phone: bottom tab bar with a raised Scan button in the thumb zone. */
export function TabBar({ t, nav }: { t: Dict["tabs"]; nav: string }) {
  const path = usePathname();
  const [a, b, c, d] = tabs;
  // Document screens have their own bottom toolbar (like a scanner app's document view).
  if (/^\/reports\/[^/]+/.test(path)) return null;
  return (
    <nav aria-label={nav} className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid h-[68px] max-w-md grid-cols-5 items-center px-1">
        <Tab {...a} label={t[a.id]} on={active(path, a.match)} />
        <Tab {...b} label={t[b.id]} on={active(path, b.match)} />
        <Link href="/scan" className="flex flex-col items-center gap-1" aria-label={t.scan}>
          <span className="-mt-7 grid size-[60px] place-items-center rounded-full bg-accent text-white shadow-[0_8px_24px_-6px_rgb(29_107_103/0.55)] ring-4 ring-bg transition active:scale-95">
            <ScanLine className="size-7" aria-hidden />
          </span>
          <span className="text-[11px] font-medium leading-none text-accent">{t.scan}</span>
        </Link>
        <Tab {...c} label={t[c.id]} on={active(path, c.match)} />
        <Tab {...d} label={t[d.id]} on={active(path, d.match)} />
      </div>
    </nav>
  );
}

function Tab({ href, Icon, label, on }: { href: string; Icon: typeof Home; label: string; on: boolean }) {
  return (
    <Link href={href} aria-current={on ? "page" : undefined} className={cx("flex h-full flex-col items-center justify-center gap-1 transition-colors", on ? "text-accent" : "text-ink-3")}>
      <Icon className="size-[24px]" strokeWidth={on ? 2.3 : 1.9} aria-hidden />
      <span className={cx("max-w-full truncate px-1 text-[11px] leading-none", on && "font-semibold")}>{label}</span>
    </Link>
  );
}

/** Large screens: the same destinations in a slim top bar. */
export function TopNav({ t, nav, appName, phoneLabel }: { t: Dict["tabs"]; nav: string; appName: React.ReactNode; phoneLabel: string }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 hidden border-b border-line/80 bg-bg/85 backdrop-blur-xl lg:block">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-6">
        <Link href="/home">{appName}</Link>
        <nav aria-label={nav} className="flex flex-1 items-center gap-1">
          {tabs.map((x) => {
            const on = active(path, x.match);
            return (
              <Link key={x.href} href={x.href} aria-current={on ? "page" : undefined} className={cx("flex h-10 items-center gap-2 rounded-full px-4 text-[15px] transition-colors", on ? "bg-surface font-medium text-ink shadow-[var(--shadow)]" : "text-ink-2 hover:text-ink")}>
                <x.Icon className={cx("size-[18px]", on ? "text-accent" : "text-ink-3")} aria-hidden />
                {t[x.id]}
              </Link>
            );
          })}
        </nav>
        <button onClick={openHandoff} className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-[15px] text-ink-2 hover:bg-surface-2 hover:text-ink">
          <Smartphone className="size-5" aria-hidden />
          {phoneLabel}
        </button>
        <Link href="/scan" className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-[15px] font-medium text-white transition hover:brightness-105">
          <ScanLine className="size-5" aria-hidden />
          {t.scan}
        </Link>
      </div>
    </header>
  );
}

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, CircleDot, Info, Minus, OctagonAlert } from "lucide-react";
import type { ResultStatus } from "@/lib/reports/types";

/*
 * Mobile-first primitives.
 * - Touch targets are at least 48px (Fitts's law).
 * - Related items live in one grouped container (Gestalt: common region, closure).
 * - One primary action per screen; secondary actions are quieter.
 */

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ── Buttons ── */

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "dark";
const btn: Record<BtnVariant, string> = {
  primary: "bg-accent text-accent-ink active:brightness-95 hover:brightness-105",
  secondary: "bg-surface text-ink border border-line-strong active:bg-surface-2 hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 active:bg-surface-2",
  danger: "bg-urgent-soft text-urgent active:brightness-95",
  dark: "bg-white/12 text-white active:bg-white/20 hover:bg-white/18",
};
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-[14px] px-5 h-12 text-[16px] font-medium transition-[background,filter,color,transform] duration-150 active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none select-none";

export function Button({ variant = "primary", block, className, ...p }: ComponentProps<"button"> & { variant?: BtnVariant; block?: boolean }) {
  return <button className={cx(btnBase, btn[variant], block && "w-full", className)} {...p} />;
}

export function ButtonLink({ variant = "primary", block, className, ...p }: ComponentProps<typeof Link> & { variant?: BtnVariant; block?: boolean }) {
  return <Link className={cx(btnBase, btn[variant], block && "w-full", className)} {...p} />;
}

export function IconButton({ label, className, children, ...p }: ComponentProps<"button"> & { label: string }) {
  return (
    <button aria-label={label} title={label} className={cx("grid size-11 place-items-center rounded-full text-ink-2 transition hover:bg-surface-2 active:bg-surface-2", className)} {...p}>
      {children}
    </button>
  );
}

/* ── Screen structure ── */

/** Top app bar for inner screens: back · title · actions. Sticky, translucent. */
export function AppBar({ backHref, backLabel, title, actions }: { backHref?: string; backLabel?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 lg:top-16 -mx-4 mb-2 flex h-14 items-center gap-1 bg-bg/85 px-2 backdrop-blur-xl sm:-mx-6">
      {backHref ? (
        <Link href={backHref} aria-label={backLabel} className="grid size-11 place-items-center rounded-full text-ink hover:bg-surface-2">
          <ChevronLeft className="size-6 rtl:-scale-x-100" aria-hidden />
        </Link>
      ) : (
        <span className="w-2" />
      )}
      <div className="min-w-0 flex-1 truncate text-center text-[16px] font-semibold text-ink">{title}</div>
      <div className="flex min-w-11 items-center justify-end">{actions}</div>
    </header>
  );
}

/** Large page title for top-level tabs. */
export function LargeTitle({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4 pt-3 rise-in">
      <div className="min-w-0">
        <h1 className="font-display text-[34px] leading-[1.15] tracking-[-0.01em] text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

/* ── Grouped lists (iOS-style inset groups) ── */

export function Group({ title, footer, children, className }: { title?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("mb-7", className)}>
      {title && <h2 className="mb-2 px-1 text-[14px] font-semibold text-ink-2">{title}</h2>}
      <div className="overflow-hidden rounded-[18px] bg-surface shadow-[var(--shadow)] divide-y divide-line">{children}</div>
      {footer && <p className="mt-2 px-1 text-[13px] leading-relaxed text-ink-3">{footer}</p>}
    </section>
  );
}

type RowProps = {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  chevron?: boolean;
  danger?: boolean;
};

export function Row({ icon, title, subtitle, trailing, href, chevron = !!href, danger }: RowProps) {
  const inner = (
    <>
      {icon && <span className={cx("grid size-9 shrink-0 place-items-center rounded-[10px]", danger ? "bg-urgent-soft text-urgent" : "bg-surface-2 text-ink-2")}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span dir="auto" className={cx("block truncate text-start text-[16px]", danger ? "text-urgent" : "text-ink")}>{title}</span>
        {subtitle && <span className="mt-0.5 block text-[13.5px] leading-snug text-ink-3">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0 text-[14px] text-ink-3">{trailing}</span>}
      {chevron && <ChevronRight className="size-5 shrink-0 text-ink-3/70 rtl:-scale-x-100" aria-hidden />}
    </>
  );
  const cls = "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-start";
  return href ? (
    <Link href={href} className={cx(cls, "transition-colors active:bg-surface-2 hover:bg-surface-2/60")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cx("rounded-[18px] bg-surface shadow-[var(--shadow)]", className)} {...p} />;
}

/* ── Forms ── */

export function Field({ label, hint, error, children, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[15px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[13.5px] leading-relaxed text-ink-3">{hint}</p>}
      {error && <p className="text-[13.5px] text-urgent">{error}</p>}
    </div>
  );
}

const inputCls =
  "h-[52px] w-full rounded-[14px] border border-line-strong bg-surface px-4 text-[16px] text-ink placeholder:text-ink-3 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10";

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input className={cx(inputCls, className)} {...p} />;
}

export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select className={cx(inputCls, "appearance-none", className)} {...p} />;
}

/* ── Status ── */

const statusStyle: Record<ResultStatus, { cls: string; Icon: typeof Check }> = {
  within: { cls: "bg-within-soft text-within", Icon: Check },
  outside: { cls: "bg-outside-soft text-outside", Icon: CircleDot },
  review: { cls: "bg-review-soft text-review", Icon: AlertTriangle },
  urgent: { cls: "bg-urgent-soft text-urgent", Icon: OctagonAlert },
  unknown: { cls: "bg-unknown-soft text-unknown", Icon: Minus },
};

export function StatusBadge({ status, label, compact }: { status: ResultStatus; label: string; compact?: boolean }) {
  const { cls, Icon } = statusStyle[status];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap leading-tight", compact ? "min-h-6 px-2 py-0.5 text-[12px]" : "min-h-7 px-2.5 py-1 text-[13px]", cls)}>
      <Icon aria-hidden className={compact ? "size-3.5" : "size-4"} strokeWidth={2.2} />
      {label}
    </span>
  );
}

export const statusDot: Record<ResultStatus, string> = {
  within: "bg-within",
  outside: "bg-outside",
  review: "bg-review",
  urgent: "bg-urgent",
  unknown: "bg-unknown",
};

export const statusText: Record<ResultStatus, string> = {
  within: "text-within",
  outside: "text-outside",
  review: "text-review",
  urgent: "text-urgent",
  unknown: "text-unknown",
};

/* ── Notices ── */

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warn" | "urgent"; children: ReactNode; className?: string }) {
  const map = {
    info: { cls: "bg-accent-soft text-ink", Icon: Info, ic: "text-accent" },
    warn: { cls: "bg-outside-soft text-ink", Icon: AlertTriangle, ic: "text-outside" },
    urgent: { cls: "bg-urgent-soft text-ink", Icon: OctagonAlert, ic: "text-urgent" },
  }[tone];
  return (
    <div role={tone === "urgent" ? "alert" : "note"} className={cx("flex gap-3 rounded-[16px] px-4 py-3.5 text-[14.5px] leading-relaxed", map.cls, className)}>
      <map.Icon aria-hidden className={cx("mt-0.5 size-5 shrink-0", map.ic)} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

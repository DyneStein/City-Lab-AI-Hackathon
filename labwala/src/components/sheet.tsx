"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cx } from "./ui";

/**
 * Bottom sheet on phones, centered dialog on large screens.
 * Escape and backdrop close it; focus moves into it and back to the opener.
 */
export function Sheet({
  open,
  onClose,
  title,
  closeLabel,
  children,
  footer,
  tall,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  tall?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center lg:items-center" role="presentation">
      <div className="absolute inset-0 bg-ink/35 fade-in" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cx(
          "relative flex w-full max-w-xl flex-col rounded-t-[26px] bg-bg shadow-[0_-12px_48px_-12px_rgb(20_33_58/0.35)] outline-none sheet-in lg:rounded-[26px]",
          tall ? "h-[92dvh] lg:h-[80vh]" : "max-h-[88dvh] lg:max-h-[80vh]",
        )}
      >
        <div className="flex shrink-0 items-center gap-2 px-5 pb-2 pt-3">
          <span aria-hidden className="absolute start-1/2 top-2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-line-strong rtl:translate-x-1/2 lg:hidden" />
          <div className="mt-3 min-w-0 flex-1 text-[18px] font-semibold text-ink">{title}</div>
          <button onClick={onClose} aria-label={closeLabel} className="mt-3 grid size-10 place-items-center rounded-full bg-surface-2 text-ink-2 hover:text-ink">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">{children}</div>
        {footer && <div className="shrink-0 border-t border-line px-5 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

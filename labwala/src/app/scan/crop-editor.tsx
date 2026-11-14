"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Maximize, ScanSearch, X } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionaries";
import { cx } from "@/components/ui";

export type Corners = [number, number][]; // TL, TR, BR, BL — normalized 0..1

/** Scanner-style crop: the detected page outline with four draggable corner handles. */
export function CropEditor({
  src,
  detected,
  initial,
  t,
  onCancel,
  onConfirm,
}: {
  src: string;
  detected: Corners;
  initial: Corners;
  t: Dict["scan"];
  onCancel: () => void;
  onConfirm: (c: Corners) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [corners, setCorners] = useState<Corners>(initial);
  const drag = useRef<number | null>(null);

  // Where the photo actually sits inside the box (object-contain letterboxing)
  useEffect(() => {
    const measure = () => {
      const b = box.current;
      const i = img.current;
      if (!b || !i || !i.naturalWidth) return;
      const bw = b.clientWidth;
      const bh = b.clientHeight;
      const s = Math.min(bw / i.naturalWidth, bh / i.naturalHeight);
      const w = i.naturalWidth * s;
      const h = i.naturalHeight * s;
      setRect({ x: (bw - w) / 2, y: (bh - h) / 2, w, h });
    };
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    img.current?.addEventListener("load", measure);
    measure();
    return () => ro.disconnect();
  }, [src]);

  function move(e: React.PointerEvent) {
    if (drag.current === null || !rect || !box.current) return;
    const b = box.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - b.left - rect.x) / rect.w));
    const y = Math.min(1, Math.max(0, (e.clientY - b.top - rect.y) / rect.h));
    setCorners((c) => c.map((p, i) => (i === drag.current ? [x, y] : p)) as Corners);
  }

  const px = (c: [number, number]) => (rect ? [rect.x + c[0] * rect.w, rect.y + c[1] * rect.h] : [0, 0]);
  const pts = corners.map(px);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0e1116] text-white fade-in" dir="ltr">
      <header className="flex h-14 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)]">
        <button onClick={onCancel} aria-label={t.retake} className="grid size-11 place-items-center rounded-full hover:bg-white/10">
          <X className="size-6" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-[16px] font-semibold">{t.crop}</p>
          <p className="text-[12.5px] text-white/60">{t.cropHint}</p>
        </div>
        <span className="w-11" />
      </header>

      <div ref={box} className="relative min-h-0 flex-1 touch-none select-none" onPointerMove={move} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={img} src={src} alt="" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
        {rect && (
          <>
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              <defs>
                <mask id="hole">
                  <rect width="100%" height="100%" fill="white" />
                  <polygon points={pts.map((p) => p.join(",")).join(" ")} fill="black" />
                </mask>
              </defs>
              <rect width="100%" height="100%" fill="rgba(0,0,0,0.45)" mask="url(#hole)" />
              <polygon points={pts.map((p) => p.join(",")).join(" ")} fill="rgba(29,107,103,0.12)" stroke="#5eead4" strokeWidth="2.5" strokeLinejoin="round" />
            </svg>
            {pts.map(([x, y], i) => (
              <button
                key={i}
                aria-label={`${t.crop} ${i + 1}`}
                onPointerDown={(e) => {
                  drag.current = i;
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                }}
                onPointerMove={move}
                onPointerUp={() => (drag.current = null)}
                className="absolute grid size-12 -translate-x-1/2 -translate-y-1/2 cursor-grab place-items-center active:cursor-grabbing"
                style={{ left: x, top: y }}
              >
                <span className="size-6 rounded-full border-[3px] border-[#5eead4] bg-white/90 shadow-lg" />
              </button>
            ))}
          </>
        )}
      </div>

      <footer className="grid shrink-0 grid-cols-3 items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
        <button onClick={() => setCorners(detected)} className="flex flex-col items-center gap-1 text-[12px] text-white/80">
          <span className="grid size-11 place-items-center rounded-full bg-white/10">
            <ScanSearch className="size-5" aria-hidden />
          </span>
          {t.autoCrop}
        </button>
        <button onClick={() => onConfirm(corners)} aria-label={t.usePage} className="grid size-[68px] place-items-center justify-self-center rounded-full bg-accent text-white shadow-lg transition active:scale-95">
          <Check className="size-8" strokeWidth={2.6} />
        </button>
        <button
          onClick={() => setCorners([[0, 0], [1, 0], [1, 1], [0, 1]])}
          className={cx("flex flex-col items-center gap-1 text-[12px] text-white/80")}
        >
          <span className="grid size-11 place-items-center rounded-full bg-white/10">
            <Maximize className="size-5" aria-hidden />
          </span>
          {t.fullPage}
        </button>
      </footer>
    </div>
  );
}

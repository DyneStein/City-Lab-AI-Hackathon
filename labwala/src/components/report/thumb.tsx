"use client";

import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { loadPdfjs } from "@/lib/pdf-client";
import { cx } from "@/components/ui";

/**
 * Page-1 thumbnail of a stored report, rendered on the device (nothing extra is stored).
 * Lazy: only renders when scrolled into view.
 */
export function ReportThumb({ reportId, mimeType, className }: { reportId: string; mimeType: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let cancelled = false;
    let url: string | null = null;
    const io = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      try {
        const blob = await fetch(`/api/reports/${reportId}/file`).then((r) => {
          if (!r.ok) throw new Error();
          return r.blob();
        });
        if (mimeType !== "application/pdf") {
          url = URL.createObjectURL(blob);
          if (!cancelled) setSrc(url);
          return;
        }
        const pdfjs = await loadPdfjs();
        const task = pdfjs.getDocument({ data: await blob.arrayBuffer() });
        const doc = await task.promise;
        const page = await doc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: (360 / base.width) * Math.min(window.devicePixelRatio || 1, 2) });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width;
        canvas.height = vp.height;
        await page.render({ canvas, viewport: vp }).promise;
        if (!cancelled) setSrc(canvas.toDataURL("image/jpeg", 0.82));
        await task.destroy();
      } catch {
        if (!cancelled) setFailed(true);
      }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
      if (url) URL.revokeObjectURL(url);
    };
  }, [reportId, mimeType]);

  return (
    <div ref={box} className={cx("relative overflow-hidden bg-white", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover object-top fade-in" />
      ) : (
        <div className={cx("grid h-full w-full place-items-center", !failed && "skeleton rounded-none")}>
          {failed && <FileText className="size-7 text-ink-3" aria-hidden />}
        </div>
      )}
    </div>
  );
}

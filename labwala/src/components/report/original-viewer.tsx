"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { loadPdfjs } from "@/lib/pdf-client";
import { cx, statusDot } from "@/components/ui";
import type { ViewResult } from "./types";

type PageDim = { page: number; width: number; height: number };

/**
 * The original report, page by page, with a small marker beside every result we located.
 * Markers sit in one aligned column in the margin so they never cover report text.
 * Results we could not locate stay reachable from the results list.
 */
export function OriginalViewer({
  reportId,
  mimeType,
  pages,
  results,
  selected,
  onSelect,
  labels,
}: {
  reportId: string;
  mimeType: string;
  pages: PageDim[];
  results: ViewResult[];
  selected: string | null;
  onSelect: (id: string) => void;
  labels: { explain: string; loadError: string; page: string };
}) {
  const url = `/api/reports/${reportId}/file`;
  return (
    <div dir="ltr" className="flex flex-col gap-4">
      {mimeType === "application/pdf" ? (
        <PdfPages url={url} pages={pages} results={results} selected={selected} onSelect={onSelect} labels={labels} />
      ) : (
        <ImagePage url={url} dim={pages[0]} results={results} selected={selected} onSelect={onSelect} labels={labels} />
      )}
    </div>
  );
}

function Markers({ results, page, scale, pageWidth, selected, onSelect, label }: { results: ViewResult[]; page: number; scale: number; pageWidth: number; selected: string | null; onSelect: (id: string) => void; label: string }) {
  const onPage = results.filter((r) => r.page === page && r.box).sort((a, b) => a.box![1] - b.box![1]);
  const rightEdge = Math.max(0, ...onPage.map((r) => r.box![0] + r.box![2]));
  // Size markers from the real row spacing so they never overlap, on any screen.
  const gaps = onPage.slice(1).map((r, i) => r.box![1] - onPage[i].box![1]).filter((g) => g > 0).sort((a, b) => a - b);
  const pitch = (gaps[Math.floor(gaps.length / 2)] ?? 22) * scale;
  const dot = Math.max(10, Math.min(26, pitch - 4));
  const markerX = Math.min(rightEdge * scale + 6, pageWidth * scale - dot - 4);
  return (
    <>
      {onPage.map((r) => {
        const [x, y, w, h] = r.box!;
        const active = selected === r.id;
        const cy = (y + h / 2) * scale;
        // The whole row is the tap target (as tall as the row pitch); the dot is the visual cue.
        return (
          <button
            key={r.id}
            onClick={() => onSelect(r.id)}
            aria-label={`${label}: ${r.name}`}
            className={cx("group absolute rounded-[4px] transition-colors", active ? "bg-accent/15 ring-2 ring-accent/70" : "hover:bg-accent/10 active:bg-accent/15")}
            style={{ left: x * scale - 4, top: cy - pitch / 2, width: markerX + dot - x * scale + 8, height: pitch }}
          >
            <span
              className={cx("absolute top-1/2 grid -translate-y-1/2 place-items-center rounded-full font-bold text-white shadow ring-2 ring-white", statusDot[r.status])}
              style={{ left: markerX - x * scale + 4, width: dot, height: dot, fontSize: Math.max(8, dot * 0.5) }}
            >
              {dot >= 16 ? "i" : ""}
            </span>
          </button>
        );
      })}
    </>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

type Common = { results: ViewResult[]; selected: string | null; onSelect: (id: string) => void; labels: { explain: string; loadError: string; page: string } };

function PdfPages({ url, pages, ...rest }: { url: string; pages: PageDim[] } & Common) {
  const [wrap, width] = useWidth<HTMLDivElement>();
  const [doc, setDoc] = useState<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const data = await fetch(url).then((r) => r.arrayBuffer());
        const d = await pdfjs.getDocument({ data }).promise;
        if (!cancelled) setDoc(d);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div ref={wrap} className="flex flex-col gap-4">
      {error && <p className="text-[15px] text-urgent">{rest.labels.loadError}</p>}
      {!doc && !error && (
        <div className="grid aspect-[3/4] place-items-center rounded-[12px] bg-surface">
          <Loader2 className="size-6 animate-spin text-ink-3" />
        </div>
      )}
      {doc && width > 0 && pages.map((p) => <PdfPage key={p.page} doc={doc} dim={p} width={width} {...rest} />)}
    </div>
  );
}

function PdfPage({ doc, dim, width, results, selected, onSelect, labels }: { doc: import("pdfjs-dist").PDFDocumentProxy; dim: PageDim; width: number } & Common) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scale = width / dim.width;
  useEffect(() => {
    let task: { cancel: () => void } | null = null;
    (async () => {
      const page = await doc.getPage(dim.page);
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const vp = page.getViewport({ scale: scale * dpr });
      const c = canvas.current!;
      c.width = vp.width;
      c.height = vp.height;
      const r = page.render({ canvas: c, viewport: vp });
      task = r;
      await r.promise.catch(() => {});
    })();
    return () => task?.cancel();
  }, [doc, dim.page, scale]);
  return (
    <div className="relative overflow-hidden rounded-[10px] bg-white shadow-[0_1px_3px_rgb(0_0_0/0.08),0_10px_30px_-14px_rgb(20_33_58/0.3)]" style={{ width, height: dim.height * scale }}>
      <canvas ref={canvas} className="block" style={{ width, height: dim.height * scale }} aria-label={labels.page.replace("{n}", String(dim.page))} />
      <Markers results={results} page={dim.page} scale={scale} pageWidth={dim.width} selected={selected} onSelect={onSelect} label={labels.explain} />
    </div>
  );
}

function ImagePage({ url, dim, results, selected, onSelect, labels }: { url: string; dim: PageDim } & Common) {
  const [wrap, width] = useWidth<HTMLDivElement>();
  const scale = width && dim ? width / dim.width : 0;
  return (
    <div ref={wrap} className="relative overflow-hidden rounded-[10px] bg-white shadow-[0_1px_3px_rgb(0_0_0/0.08)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={labels.page.replace("{n}", "1")} className="block w-full" />
      {scale > 0 && <Markers results={results} page={1} scale={scale} pageWidth={dim.width} selected={selected} onSelect={onSelect} label={labels.explain} />}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crop, FileText, ImagePlus, Loader2, RotateCw, Sparkles, Trash2, X, Zap } from "lucide-react";
import { fmt, type Dict } from "@/lib/i18n/dictionaries";
import { renderPdfPages } from "@/lib/pdf-client";
import { Sheet } from "@/components/sheet";
import { cx } from "@/components/ui";
import { CropEditor, type Corners } from "./crop-editor";

/*
 * Document-scanner flow. The phone captures; the laptop does the heavy work:
 *   capture (live camera on HTTPS, or the phone camera app on plain Wi-Fi)
 *   → laptop finds the page edges (OpenCV) → person adjusts corners
 *   → laptop flattens + cleans the page → pages become one PDF → upload → OCR → check values.
 * If the laptop scanner is unreachable, pages are processed on the phone instead.
 */

type Page = {
  id: string;
  source: Blob;
  sourceUrl: string;
  detected: Corners;
  corners: Corners;
  processed: Blob;
  preview: string;
  rotation: 0 | 90 | 180 | 270;
};
type Editing = { pageId: string | null; source: Blob; sourceUrl: string; detected: Corners; corners: Corners };
type Phase = { kind: "idle" } | { kind: "busy"; label: string } | { kind: "error"; message: string };

const MAX_SIDE = 2400;
const PDF_WIDTH = 595;
const FULL: Corners = [[0.03, 0.03], [0.97, 0.03], [0.97, 0.97], [0.03, 0.97]];

export function Scanner({ t, closeLabel, maxMb }: { t: Dict["scan"]; closeLabel: string; maxMb: number }) {
  const router = useRouter();
  const camera = useRef<HTMLInputElement>(null);
  const importer = useRef<HTMLInputElement>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [viewing, setViewing] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [enhance, setEnhance] = useState(true);
  const [auto, setAuto] = useState(true);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [samples, setSamples] = useState(false);
  const [liveOk, setLiveOk] = useState<boolean | null>(null);

  useEffect(() => {
    // A live camera needs a secure page (HTTPS or localhost).
    setLiveOk(window.isSecureContext && !!navigator.mediaDevices?.getUserMedia); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);
  const liveUnavailable = useCallback(() => setLiveOk(false), []);

  /* ── capture → detect → crop editor ── */

  const ingest = useCallback(
    async (blob: Blob, hint?: Corners) => {
      try {
        setPhase({ kind: "busy", label: t.detecting });
        const oriented = await orient(blob);
        let detected = hint ?? FULL;
        if (!hint) {
          const res = await fetch("/api/scan/detect", { method: "POST", body: oriented, headers: { "content-type": "image/jpeg" } }).catch(() => null);
          if (res?.ok) detected = (await res.json()).corners;
        }
        setEditing({ pageId: null, source: oriented, sourceUrl: URL.createObjectURL(oriented), detected, corners: detected });
        setPhase({ kind: "idle" });
      } catch {
        setPhase({ kind: "error", message: t.failed });
      }
    },
    [t],
  );

  async function flatten(source: Blob, corners: Corners, clean: boolean): Promise<Blob> {
    const q = new URLSearchParams({ corners: JSON.stringify(corners), enhance: clean ? "1" : "0" });
    const res = await fetch(`/api/scan/warp?${q}`, { method: "POST", body: source, headers: { "content-type": "image/jpeg" } }).catch(() => null);
    if (res?.ok) return res.blob();
    return localProcess(source, 0, clean); // laptop unreachable: process on the phone
  }

  async function confirmCrop(corners: Corners) {
    if (!editing) return;
    const e = editing;
    setEditing(null);
    setPhase({ kind: "busy", label: t.flattening });
    try {
      const processed = await flatten(e.source, corners, enhance);
      const preview = URL.createObjectURL(processed);
      setPages((ps) =>
        e.pageId
          ? ps.map((p) => (p.id === e.pageId ? { ...p, corners, processed, preview } : p))
          : [...ps, { id: crypto.randomUUID(), source: e.source, sourceUrl: e.sourceUrl, detected: e.detected, corners, processed, preview, rotation: 0 }],
      );
      setPhase({ kind: "idle" });
    } catch {
      setPhase({ kind: "error", message: t.failed });
    }
  }

  async function toggleEnhance() {
    const next = !enhance;
    setEnhance(next);
    if (!pages.length) return;
    setPhase({ kind: "busy", label: t.flattening });
    const updated: Page[] = [];
    for (const p of pages) {
      const processed = await flatten(p.source, p.corners, next);
      updated.push({ ...p, processed, preview: URL.createObjectURL(processed) });
    }
    setPages(updated);
    setPhase({ kind: "idle" });
  }

  /* ── upload ── */

  async function uploadFile(file: File, scanned: { blob: Blob; scale: number }[] | null) {
    if (file.size > maxMb * 1024 * 1024) return setPhase({ kind: "error", message: fmt(t.tooLarge, { mb: maxMb }) });
    try {
      setPhase({ kind: "busy", label: t.uploading });
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/reports", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) return setPhase({ kind: "error", message: data.error === "invalid_type" ? t.invalidType : data.error === "too_large" ? fmt(t.tooLarge, { mb: maxMb }) : t.failed });
      if (data.duplicate) {
        setPhase({ kind: "busy", label: t.duplicate });
        router.push(`/reports/${data.reportId}`);
        return;
      }
      if (data.needsOcr) {
        const imgs = scanned ?? (await renderPdfPages(file, (n, total) => setPhase({ kind: "busy", label: fmt(t.reading, { n, total }) })));
        setPhase({ kind: "busy", label: t.extracting });
        const ocr = new FormData();
        ocr.set("scale", String(imgs[0]?.scale ?? 2));
        imgs.forEach((p, i) => ocr.append("page", p.blob, `page-${i + 1}.jpg`));
        const r = await fetch(`/api/reports/${data.reportId}/ocr`, { method: "POST", body: ocr });
        if (!r.ok) throw new Error("ocr");
      }
      router.push(`/reports/${data.reportId}/confirm`);
    } catch {
      setPhase({ kind: "error", message: t.failed });
    }
  }

  async function finish() {
    if (!pages.length) return;
    try {
      setPhase({ kind: "busy", label: t.building });
      const finals: Blob[] = [];
      for (const p of pages) finals.push(p.rotation ? await localProcess(p.processed, p.rotation, false) : p.processed);
      const sized = await Promise.all(finals.map(async (b) => ({ blob: b, ...(await dims(b)) })));
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.create();
      for (const p of sized) {
        const img = await doc.embedJpg(await p.blob.arrayBuffer());
        const h = (p.height / p.width) * PDF_WIDTH;
        doc.addPage([PDF_WIDTH, h]).drawImage(img, { x: 0, y: 0, width: PDF_WIDTH, height: h });
      }
      const file = new File([(await doc.save()) as BlobPart], "scan.pdf", { type: "application/pdf" });
      await uploadFile(file, sized.map((p) => ({ blob: p.blob, scale: p.width / PDF_WIDTH })));
    } catch {
      setPhase({ kind: "error", message: t.failed });
    }
  }

  function onImport(files: File[]) {
    const pdf = files.find((f) => f.type === "application/pdf");
    if (pdf) return uploadFile(pdf, null);
    // Text reports exported by lab systems (.md / .txt)
    const txt = files.find((f) => /\.(md|markdown|txt)$/i.test(f.name) || f.type === "text/markdown" || f.type === "text/plain");
    if (txt) return uploadFile(txt, null);
    const img = files.find((f) => f.type === "image/jpeg" || f.type === "image/png");
    if (!img) return setPhase({ kind: "error", message: t.invalidType });
    ingest(img);
  }

  async function loadSample(name: string) {
    setSamples(false);
    setPhase({ kind: "busy", label: t.uploading });
    const blob = await fetch(`/samples/${name}`).then((r) => r.blob());
    await uploadFile(new File([blob], name, { type: "application/pdf" }), null);
  }

  const viewPage = pages.find((p) => p.id === viewing) ?? null;
  const busy = phase.kind === "busy";

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0e1116] text-white">
      <header className="flex h-14 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)]">
        <Link href="/home" aria-label={closeLabel} className="grid size-11 place-items-center rounded-full hover:bg-white/10">
          <X className="size-6" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-center text-[16px] font-semibold">{t.title}</h1>
        {liveOk && (
          <Toggle on={auto} onClick={() => setAuto((a) => !a)} label={t.auto}>
            <Zap className="size-4" aria-hidden />
          </Toggle>
        )}
        <Toggle on={enhance} onClick={toggleEnhance} label={t.enhance}>
          <Sparkles className="size-4" aria-hidden />
        </Toggle>
      </header>

      <main className="relative flex min-h-0 flex-1 items-center justify-center">
        {liveOk ? (
          <LiveCamera t={t} auto={auto} paused={!!editing || busy || !!viewPage} onCapture={(blob, quad) => ingest(blob, quad ?? undefined)} onUnavailable={liveUnavailable} />
        ) : (
          <EmptyFrame t={t} />
        )}
        {phase.kind === "error" && (
          <div role="alert" className="absolute inset-x-4 top-3 rounded-[14px] bg-[#3a1d1b] px-4 py-3 text-[14.5px] text-[#ffd9d4]">
            {phase.message}
          </div>
        )}
      </main>

      {pages.length > 0 && (
        <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto px-4 pb-3 pt-2" role="list" aria-label={fmt(t.pages, { n: pages.length })}>
          {pages.map((p, i) => (
            <button key={p.id} role="listitem" onClick={() => setViewing(p.id)} aria-label={fmt(t.page, { n: i + 1 })} className="relative h-[72px] w-[54px] shrink-0 overflow-hidden rounded-[8px] bg-white ring-2 ring-white/70">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" className="h-full w-full object-cover" style={{ transform: `rotate(${p.rotation}deg)` }} />
              <span className="absolute bottom-0.5 end-0.5 rounded-full bg-black/65 px-1.5 text-[10px] tabular-nums">{i + 1}</span>
            </button>
          ))}
        </div>
      )}

      {/* Controls in the thumb zone (camera layout stays the same in every language) */}
      <footer className="grid shrink-0 grid-cols-3 items-center px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-2" dir="ltr">
        <button onClick={() => importer.current?.click()} className="flex flex-col items-center gap-1.5 justify-self-start text-white/85">
          <span className="grid size-12 place-items-center rounded-full bg-white/10">
            <ImagePlus className="size-6" aria-hidden />
          </span>
          <span className="text-[12px]">{t.gallery}</span>
        </button>
        <button
          onClick={() => (liveOk ? window.dispatchEvent(new Event("labwala:shutter")) : camera.current?.click())}
          aria-label={pages.length ? t.addPage : t.camera}
          disabled={busy}
          className="grid size-[76px] place-items-center justify-self-center rounded-full border-4 border-white/90 transition active:scale-95 disabled:opacity-50"
        >
          <span className="size-[60px] rounded-full bg-white" />
        </button>
        {pages.length > 0 ? (
          <button onClick={finish} disabled={busy} className="flex h-12 items-center justify-center gap-1.5 justify-self-end whitespace-nowrap rounded-full bg-accent px-4 text-[15px] font-semibold text-white transition active:scale-95">
            {t.done}
            <span className="rounded-full bg-white/20 px-2 text-[13px] tabular-nums">{pages.length}</span>
          </button>
        ) : (
          <button onClick={() => setSamples(true)} className="flex flex-col items-center gap-1.5 justify-self-end text-white/85">
            <span className="grid size-12 place-items-center rounded-full bg-white/10">
              <FileText className="size-6" aria-hidden />
            </span>
            <span className="max-w-[84px] truncate text-[12px]">{t.sample}</span>
          </button>
        )}
      </footer>

      <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) ingest(f); e.target.value = ""; }} />
      <input ref={importer} type="file" accept="application/pdf,image/png,image/jpeg,.md,.markdown,.txt,text/markdown,text/plain" className="sr-only" onChange={(e) => { onImport([...(e.target.files ?? [])]); e.target.value = ""; }} />

      {editing && <CropEditor src={editing.sourceUrl} detected={editing.detected} initial={editing.corners} t={t} onCancel={() => setEditing(null)} onConfirm={confirmCrop} />}

      {viewPage && (
        <div className="fixed inset-0 z-[65] flex flex-col bg-[#0e1116] fade-in">
          <header className="flex h-14 shrink-0 items-center px-2 pt-[env(safe-area-inset-top)]">
            <button onClick={() => setViewing(null)} aria-label={closeLabel} className="grid size-11 place-items-center rounded-full hover:bg-white/10">
              <X className="size-6" />
            </button>
            <p className="flex-1 text-center text-[16px] font-semibold">{fmt(t.page, { n: pages.indexOf(viewPage) + 1 })}</p>
            <span className="w-11" />
          </header>
          <div className="flex min-h-0 flex-1 items-center justify-center p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewPage.preview} alt="" className="max-h-full max-w-full rounded-[6px] bg-white object-contain shadow-2xl transition-transform" style={{ transform: `rotate(${viewPage.rotation}deg)` }} />
          </div>
          <div className="grid grid-cols-3 gap-2 px-6 pb-[calc(env(safe-area-inset-bottom)+20px)]">
            <IconAction label={t.rotate} onClick={() => setPages((ps) => ps.map((p) => (p.id === viewPage.id ? { ...p, rotation: (((p.rotation + 90) % 360) as Page["rotation"]) } : p)))}>
              <RotateCw className="size-6" />
            </IconAction>
            <IconAction
              label={t.crop}
              onClick={() => {
                setViewing(null);
                setEditing({ pageId: viewPage.id, source: viewPage.source, sourceUrl: viewPage.sourceUrl, detected: viewPage.detected, corners: viewPage.corners });
              }}
            >
              <Crop className="size-6" />
            </IconAction>
            <IconAction
              label={t.remove}
              danger
              onClick={() => {
                setPages((ps) => ps.filter((p) => p.id !== viewPage.id));
                setViewing(null);
              }}
            >
              <Trash2 className="size-6" />
            </IconAction>
          </div>
        </div>
      )}

      {busy && (
        <div className="absolute inset-0 z-[90] flex flex-col items-center justify-center gap-5 bg-[#0e1116]/90 px-8 text-center fade-in" aria-live="polite">
          <Loader2 className="size-10 animate-spin text-white" aria-hidden />
          <p className="text-[17px] text-white/90">{phase.label}</p>
        </div>
      )}

      <Sheet open={samples} onClose={() => setSamples(false)} title={t.samplesTitle} closeLabel={closeLabel}>
        <p className="mb-4 text-[15px] leading-relaxed text-ink-2">{t.samplesHint}</p>
        <div className="grid gap-2">
          {["sample-report-april.pdf", "sample-report-october.pdf"].map((s, i) => (
            <button key={s} onClick={() => loadSample(s)} className="flex h-14 items-center gap-3 rounded-[14px] bg-surface px-4 text-start text-[16px] text-ink shadow-[var(--shadow)] active:bg-surface-2">
              <FileText className="size-5 text-accent" aria-hidden />
              {t.sample} {i + 1}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

/* ───────── Live camera; the laptop traces the page outline ───────── */

function LiveCamera({ t, auto, paused, onCapture, onUnavailable }: { t: Dict["scan"]; auto: boolean; paused: boolean; onCapture: (b: Blob, quad: Corners | null) => void; onUnavailable: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [quad, setQuad] = useState<Corners | null>(null);
  const [stable, setStable] = useState(false);
  const [denied, setDenied] = useState(false);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const history = useRef<Corners[]>([]);
  const lastQuad = useRef<Corners | null>(null);
  const capturing = useRef(false);

  const capture = useCallback(async () => {
    const v = video.current;
    if (!v || !v.videoWidth || capturing.current) return;
    capturing.current = true;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.92));
    history.current = [];
    onCapture(blob, lastQuad.current);
    setTimeout(() => (capturing.current = false), 1500);
  }, [onCapture]);

  useEffect(() => {
    const onShutter = () => capture();
    window.addEventListener("labwala:shutter", onShutter);
    return () => window.removeEventListener("labwala:shutter", onShutter);
  }, [capture]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => {});
        }
      })
      .catch((e) => {
        if (e?.name === "NotAllowedError") setDenied(true);
        else onUnavailable();
      });
    return () => stream?.getTracks().forEach((tr) => tr.stop());
  }, [onUnavailable]);

  useEffect(() => {
    const measure = () => {
      const v = video.current;
      const b = box.current;
      if (!v?.videoWidth || !b) return;
      const s = Math.min(b.clientWidth / v.videoWidth, b.clientHeight / v.videoHeight);
      setRect({ x: (b.clientWidth - v.videoWidth * s) / 2, y: (b.clientHeight - v.videoHeight * s) / 2, w: v.videoWidth * s, h: v.videoHeight * s });
    };
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    const v = video.current;
    v?.addEventListener("loadedmetadata", measure);
    return () => {
      ro.disconnect();
      v?.removeEventListener("loadedmetadata", measure);
    };
  }, []);

  // Small frames go to the laptop ~2.5 times a second; it returns the page outline.
  useEffect(() => {
    if (paused) return;
    let busy = false;
    const small = document.createElement("canvas");
    const timer = setInterval(async () => {
      const v = video.current;
      if (busy || !v?.videoWidth) return;
      busy = true;
      try {
        const s = 480 / Math.max(v.videoWidth, v.videoHeight);
        small.width = Math.round(v.videoWidth * s);
        small.height = Math.round(v.videoHeight * s);
        small.getContext("2d")!.drawImage(v, 0, 0, small.width, small.height);
        const blob = await new Promise<Blob>((res) => small.toBlob((b) => res(b!), "image/jpeg", 0.6));
        const r = await fetch("/api/scan/detect", { method: "POST", body: blob, headers: { "content-type": "image/jpeg" } });
        if (!r.ok) return;
        const d = await r.json();
        const q: Corners | null = d.found && d.confidence >= 0.6 ? d.corners : null;
        lastQuad.current = q;
        setQuad(q);
        if (q) {
          history.current = [...history.current.slice(-5), q];
          const steady = history.current.length >= 5 && history.current.every((h) => h.every((p, i) => Math.hypot(p[0] - q[i][0], p[1] - q[i][1]) < 0.02));
          setStable(steady);
          if (steady && auto) capture();
        } else {
          history.current = [];
          setStable(false);
        }
      } catch {
        /* a dropped frame is fine */
      } finally {
        busy = false;
      }
    }, 400);
    return () => clearInterval(timer);
  }, [paused, auto, capture]);

  const pts = quad && rect ? quad.map(([x, y]) => `${rect.x + x * rect.w},${rect.y + y * rect.h}`).join(" ") : null;

  return (
    <div ref={box} className="absolute inset-0">
      <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-contain" />
      {pts && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <polygon points={pts} fill={stable ? "rgba(94,234,212,0.18)" : "rgba(94,234,212,0.08)"} stroke="#5eead4" strokeWidth={stable ? 4 : 2.5} strokeLinejoin="round" />
        </svg>
      )}
      <p className="absolute inset-x-0 bottom-3 px-6 text-center text-[14px] text-white/85 drop-shadow">{denied ? t.cameraDenied : quad ? (stable && auto ? t.holdStill : "") : t.noPage}</p>
    </div>
  );
}

function EmptyFrame({ t }: { t: Dict["scan"] }) {
  return (
    <div className="relative flex aspect-[3/4] w-full max-w-[320px] flex-col items-center justify-center px-8 text-center">
      {["start-0 top-0 border-s-[3px] border-t-[3px] rounded-ss-[18px]", "end-0 top-0 border-e-[3px] border-t-[3px] rounded-se-[18px]", "start-0 bottom-0 border-s-[3px] border-b-[3px] rounded-es-[18px]", "end-0 bottom-0 border-e-[3px] border-b-[3px] rounded-ee-[18px]"].map((c) => (
        <span key={c} aria-hidden className={cx("absolute size-12 border-white/70", c)} />
      ))}
      <FileText className="mb-4 size-10 text-white/50" aria-hidden />
      <p className="text-[17px] leading-relaxed text-white/90">{t.empty}</p>
      <p className="mt-3 text-[14px] leading-relaxed text-white/55">{t.tips}</p>
    </div>
  );
}

function Toggle({ on, onClick, label, children }: { on: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={cx("flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors", on ? "bg-white text-[#0e1116]" : "bg-white/10 text-white/80")}>
      {children}
      <span className="max-w-[96px] truncate">{label}</span>
    </button>
  );
}

function IconAction({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cx("flex flex-col items-center gap-1.5 text-[12.5px]", danger ? "text-[#ffb4ab]" : "text-white/85")}>
      <span className="grid size-14 place-items-center rounded-full bg-white/10">{children}</span>
      {label}
    </button>
  );
}

/* ───────── Image helpers (on the phone) ───────── */

/** Respect EXIF orientation and cap the size, so uploads to the laptop stay quick. */
async function orient(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
  const s = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.92));
}

async function dims(blob: Blob) {
  const bmp = await createImageBitmap(blob);
  const d = { width: bmp.width, height: bmp.height };
  bmp.close();
  return d;
}

/** Rotate and (optionally) clean a page on the phone. Used for rotation and as an offline fallback. */
async function localProcess(blob: Blob, rotation: number, enhance: boolean): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const swap = rotation === 90 || rotation === 270;
  const c = document.createElement("canvas");
  c.width = swap ? bmp.height : bmp.width;
  c.height = swap ? bmp.width : bmp.height;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  bmp.close();
  if (enhance) {
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, (g - 128) * 1.35 + 140));
    }
    ctx.putImageData(img, 0, 0);
  }
  return new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.9));
}

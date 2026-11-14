import "server-only";
import path from "node:path";
import fs from "node:fs";
import { env } from "@/lib/env";
import type { Box, LayoutItem, LayoutLine, PageLayout, ReportLayout } from "./types";

/* ───────────── PDF text layer (digital PDFs) ───────────── */

type PdfTextItem = { str: string; transform: number[]; width: number; height: number };

export async function extractPdfLayout(data: Buffer): Promise<{ layout: ReportLayout; charCount: number; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    disableFontFace: true,
    useSystemFonts: false,
    standardFontDataUrl: path.resolve("node_modules/pdfjs-dist/standard_fonts") + path.sep,
  });
  const doc = await task.promise;

  const pages: PageLayout[] = [];
  let charCount = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: LayoutItem[] = [];
    for (const raw of content.items as PdfTextItem[]) {
      if (!("str" in raw) || !raw.str.trim()) continue;
      const tx = pdfjs.Util.transform(viewport.transform, raw.transform);
      const fontH = Math.hypot(tx[2], tx[3]) || raw.height || 10;
      const box: Box = [tx[4], tx[5] - fontH, raw.width, fontH];
      items.push({ str: raw.str, box });
      charCount += raw.str.trim().length;
    }
    pages.push({ page: p, width: viewport.width, height: viewport.height, lines: groupIntoLines(items) });
    page.cleanup();
  }
  const pageCount = doc.numPages;
  await task.destroy();
  return { layout: { method: "pdf_text", pages }, charCount, pageCount };
}

/** Cluster positioned items into visual lines (same baseline), left-to-right. */
export function groupIntoLines(items: LayoutItem[]): LayoutLine[] {
  const sorted = [...items].sort((a, b) => a.box[1] - b.box[1] || a.box[0] - b.box[0]);
  const lines: LayoutItem[][] = [];
  for (const it of sorted) {
    const cy = it.box[1] + it.box[3] / 2;
    const line = lines.find((l) => {
      const ref = l[0].box;
      return Math.abs(ref[1] + ref[3] / 2 - cy) < Math.max(ref[3], it.box[3]) * 0.5;
    });
    if (line) line.push(it);
    else lines.push([it]);
  }
  return lines
    .map((l) => l.sort((a, b) => a.box[0] - b.box[0]))
    .map((l) => {
      const x1 = Math.min(...l.map((i) => i.box[0]));
      const y1 = Math.min(...l.map((i) => i.box[1]));
      const x2 = Math.max(...l.map((i) => i.box[0] + i.box[2]));
      const y2 = Math.max(...l.map((i) => i.box[1] + i.box[3]));
      return { text: l.map((i) => i.str.trim()).join(" "), items: l, box: [x1, y1, x2 - x1, y2 - y1] as Box };
    })
    .sort((a, b) => a.box[1] - b.box[1]);
}

/* ───────────── OCR (images and scanned PDFs) ───────────── */

type TWord = { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } };
type TLine = { text: string; confidence: number; bbox: TWord["bbox"]; words: TWord[] };

/**
 * OCR one image. `scale` = image pixels per page unit (1 for photos; the render scale
 * for rasterized PDF pages) so boxes line up with the PDF viewer.
 */
export async function ocrImage(image: Buffer, pageNumber: number, scale = 1): Promise<{ page: PageLayout; confidence: number }> {
  const { createWorker } = await import("tesseract.js");
  const cachePath = path.resolve(env.DATA_DIR, "tessdata");
  fs.mkdirSync(cachePath, { recursive: true });
  // English model: Pakistani lab reports print results in English. Urdu ("urd") can be
  // added for Urdu headers, at the cost of speed.
  const worker = await createWorker("eng", 1, { cachePath });
  try {
    const { data } = await worker.recognize(image, {}, { blocks: true });
    const tLines: TLine[] =
      (data as unknown as { lines?: TLine[] }).lines ??
      ((data as unknown as { blocks?: { paragraphs: { lines: TLine[] }[] }[] }).blocks ?? []).flatMap((b) =>
        b.paragraphs.flatMap((p) => p.lines),
      );
    const toBox = (b: TWord["bbox"]): Box => [b.x0 / scale, b.y0 / scale, (b.x1 - b.x0) / scale, (b.y1 - b.y0) / scale];
    const lines: LayoutLine[] = tLines
      .filter((l) => l.text.trim())
      .map((l) => ({
        text: l.text.replace(/\s+/g, " ").trim(),
        items: l.words.map((w) => ({ str: w.text, box: toBox(w.bbox) })),
        box: toBox(l.bbox),
        confidence: l.confidence,
      }));
    const meta = imageSize(image);
    const width = (meta?.width ?? Math.max(1, ...lines.map((l) => l.box[0] + l.box[2]))) / scale;
    const height = (meta?.height ?? Math.max(1, ...lines.map((l) => l.box[1] + l.box[3]))) / scale;
    return { page: { page: pageNumber, width, height, lines }, confidence: data.confidence ?? 0 };
  } finally {
    await worker.terminate();
  }
}

/** Width/height from PNG or JPEG headers (no native dependency). */
export function imageSize(buf: Buffer): { width: number; height: number } | null {
  if (sniffMime(buf) === "image/png") return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (sniffMime(buf) === "image/jpeg") {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  return null;
}

/* ───────────── File validation (magic bytes, not the extension) ───────────── */

export function sniffMime(buf: Buffer): "application/pdf" | "image/png" | "image/jpeg" | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  return null;
}

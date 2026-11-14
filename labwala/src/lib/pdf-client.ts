"use client";

/** Browser-side pdf.js loader (worker served from /public, copied on postinstall). */
export async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs;
}

/** Rasterize an imported scanned PDF so its pages can be read by OCR. */
export async function renderPdfPages(file: File, onPage: (n: number, total: number) => void) {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const total = Math.min(doc.numPages, 10);
  const out: { blob: Blob; scale: number }[] = [];
  for (let n = 1; n <= total; n++) {
    onPage(n, total);
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = vp.width;
    canvas.height = vp.height;
    await page.render({ canvas, viewport: vp }).promise;
    out.push({ blob: await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.9)), scale: 2 });
  }
  await task.destroy();
  return out;
}

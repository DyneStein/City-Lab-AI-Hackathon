"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { fmt } from "@/lib/i18n/dictionaries";
import { renderPdfPages } from "@/lib/pdf-client";

/** A scanned PDF (e.g. from Gmail) has no text layer: read its pages, then show the check screen. */
export function NeedsOcr({ reportId, labels }: { reportId: string; labels: { reading: string; extracting: string; failed: string } }) {
  const router = useRouter();
  const [label, setLabel] = useState(labels.extracting);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const blob = await fetch(`/api/reports/${reportId}/file`).then((r) => r.blob());
        const pages = await renderPdfPages(new File([blob], "report.pdf", { type: "application/pdf" }), (n, total) => setLabel(fmt(labels.reading, { n, total })));
        setLabel(labels.extracting);
        const form = new FormData();
        form.set("scale", "2");
        pages.forEach((p, i) => form.append("page", p.blob, `page-${i + 1}.jpg`));
        const res = await fetch(`/api/reports/${reportId}/ocr`, { method: "POST", body: form });
        if (!res.ok) throw new Error();
        router.refresh();
      } catch {
        setFailed(true);
      }
    })();
  }, [reportId, labels, router]);
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center" aria-live="polite">
      {!failed && <Loader2 className="size-8 animate-spin text-accent" aria-hidden />}
      <p className="text-[16px] text-ink-2">{failed ? labels.failed : label}</p>
    </div>
  );
}

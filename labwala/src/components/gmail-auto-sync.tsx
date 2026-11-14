"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** On the home screen: quietly look for new reports from the listed senders (at most every 10 minutes). */
export function GmailAutoSync() {
  const router = useRouter();
  useEffect(() => {
    fetch("/api/gmail/sync?auto=1", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.imported || d.pending) router.refresh();
      })
      .catch(() => {});
  }, [router]);
  return null;
}

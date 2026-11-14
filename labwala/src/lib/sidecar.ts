import "server-only";
import fs from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";
import { encryptBuffer, decryptBuffer, sha256 } from "@/lib/crypto";
import type { Lang } from "@/lib/i18n/dictionaries";

/**
 * The laptop-side Python service (privacy-service/) does the heavy lifting for phones:
 * PII detection, document edge detection + flattening (OpenCV) and neural voices (edge-tts).
 */
const base = () => env.PRESIDIO_URL;

export async function sidecarImage(pathname: string, image: Buffer, query: Record<string, string> = {}) {
  const qs = new URLSearchParams(query).toString();
  return fetch(`${base()}${pathname}${qs ? `?${qs}` : ""}`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: new Uint8Array(image),
    signal: AbortSignal.timeout(20_000),
  });
}

/* ───────── Voices ───────── */

// Microsoft neural voices. Punjabi (Shahmukhi) has no Pakistani voice yet; the Urdu voice reads the same script.
const VOICE: Record<Lang, string> = { en: "en-IN-PrabhatNeural", ur: "ur-PK-AsadNeural", pa: "ur-PK-AsadNeural" };

/** Remove identifiers before text leaves the laptop (spoken text should never contain them anyway). */
function scrub(text: string) {
  return text
    .replace(/\b\d{5}-?\d{7}-?\d\b/g, " ")
    .replace(/(?:\+92|0092|\b0)[\s-]?3\d{2}[\s-]?\d{7}\b/g, " ")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, " ");
}

const cacheDir = () => {
  const d = path.resolve(env.DATA_DIR, "tts");
  fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  return d;
};

/** MP3 for the text in the given language; cached on disk, encrypted. */
export async function speak(text: string, lang: Lang): Promise<Buffer> {
  const clean = scrub(text).replace(/\s+/g, " ").trim().slice(0, 6000);
  const voice = VOICE[lang];
  const file = path.join(cacheDir(), sha256(`${voice}|${clean}`));
  if (fs.existsSync(file)) return decryptBuffer(fs.readFileSync(file));
  const call = (rate: string) =>
    fetch(`${base()}/tts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: clean, voice, rate }),
      signal: AbortSignal.timeout(45_000),
    });
  // The online voice service occasionally rejects a request: retry once at normal speed.
  let res = await call(lang === "en" ? "+0%" : "-5%");
  if (!res.ok) res = await call("+0%");
  if (!res.ok) throw new Error(`tts ${res.status}`);
  const audio = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, encryptBuffer(audio), { mode: 0o600 });
  return audio;
}

import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { encryptText, decryptText } from "@/lib/crypto";
import { newId } from "@/lib/security";
import { MEDICAL_ALLOW_LIST } from "@/lib/knowledge/library";

/**
 * Pseudonymization before anything reaches the AI provider.
 *
 *   text ─► built-in Pakistani rules ─► Presidio sidecar (NER + custom recognizers)
 *        ─► placeholders like [PERSON_1] ─► AI ─► restore from encrypted vault
 *
 * Fail-closed: if Presidio is unreachable and PII_FALLBACK=block, AI calls are refused.
 * Data minimization still applies first: explanation prompts contain only test rows,
 * never the report header where names and IDs live.
 */

export class PrivacyUnavailableError extends Error {}

type Finding = { type: string; start: number; end: number };

const MEDICAL_TERMS = [...new Set(MEDICAL_ALLOW_LIST.flatMap((t) => t.toLowerCase().split(/[^a-z0-9%+.]+/)).filter((w) => w.length > 2))];

/** Defense-in-depth rules that run even when Presidio is up. */
const BUILTIN: { type: string; re: RegExp }[] = [
  { type: "PK_CNIC", re: /\b\d{5}-?\d{7}-?\d\b/g },
  { type: "PHONE_NUMBER", re: /(?:\+92|0092|\b0)[\s-]?3\d{2}[\s-]?\d{7}\b/g },
  { type: "EMAIL_ADDRESS", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  { type: "MEDICAL_RECORD_ID", re: /\b(?:MR|MRN|Reg|Lab|Patient|Case|Visit)\s*(?:No|#|ID)?\.?\s*[:\-]?\s*[A-Z0-9][A-Z0-9\-/]{3,}\b/gi },
];

function builtinFindings(text: string): Finding[] {
  const out: Finding[] = [];
  for (const { type, re } of BUILTIN) for (const m of text.matchAll(re)) out.push({ type, start: m.index!, end: m.index! + m[0].length });
  return out;
}

async function presidioFindings(text: string): Promise<Finding[] | null> {
  try {
    const res = await fetch(`${env.PRESIDIO_URL}/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, language: "en", allow_list: MEDICAL_ALLOW_LIST }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { findings: Finding[] };
    // spaCy sometimes tags "Hemoglobin 10.5" as PERSON; names never contain digits or test names.
    return data.findings.filter((f) => {
      if (f.type !== "PERSON") return true;
      const span = text.slice(f.start, f.end).toLowerCase();
      return !/\d/.test(span) && !MEDICAL_TERMS.some((t) => span.split(/[^a-z0-9%+.]+/).includes(t));
    });
  } catch {
    return null;
  }
}

export async function privacyStatus(): Promise<"presidio" | "builtin" | "blocked"> {
  try {
    const r = await fetch(`${env.PRESIDIO_URL}/health`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) return "presidio";
  } catch {}
  return env.PII_FALLBACK === "builtin" ? "builtin" : "blocked";
}

/** Replace personal data with stable placeholders; store originals encrypted per scope. */
export async function pseudonymize(userId: string, scope: string, text: string): Promise<string> {
  if (!text.trim()) return text;
  let findings = builtinFindings(text);
  const p = await presidioFindings(text);
  if (p === null && env.PII_FALLBACK === "block") throw new PrivacyUnavailableError("Privacy service unavailable");
  if (p) findings = findings.concat(p);
  if (!findings.length) return text;

  // merge overlaps, keep longest
  findings.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: Finding[] = [];
  for (const f of findings) {
    const last = merged.at(-1);
    if (last && f.start < last.end) last.end = Math.max(last.end, f.end);
    else merged.push({ ...f });
  }

  const existing = db.select().from(schema.piiVault).where(eq(schema.piiVault.scope, scope)).all();
  const byValue = new Map(existing.map((v) => [decryptText(v.valueEnc), v.placeholder]));
  const counters: Record<string, number> = {};
  for (const v of existing) counters[v.entityType] = Math.max(counters[v.entityType] ?? 0, Number(v.placeholder.match(/_(\d+)\]$/)?.[1] ?? 0));

  let out = "";
  let cursor = 0;
  for (const f of merged) {
    const original = text.slice(f.start, f.end);
    let ph = byValue.get(original);
    if (!ph) {
      counters[f.type] = (counters[f.type] ?? 0) + 1;
      ph = `[${f.type}_${counters[f.type]}]`;
      db.insert(schema.piiVault)
        .values({ id: newId(), userId, scope, placeholder: ph, entityType: f.type, valueEnc: encryptText(original), createdAt: Date.now() })
        .run();
      byValue.set(original, ph);
    }
    out += text.slice(cursor, f.start) + ph;
    cursor = f.end;
  }
  return out + text.slice(cursor);
}

/** Restore placeholders for the data owner only. */
export function restore(userId: string, scope: string, text: string): string {
  const rows = db
    .select()
    .from(schema.piiVault)
    .where(and(eq(schema.piiVault.scope, scope), eq(schema.piiVault.userId, userId)))
    .all();
  let out = text;
  for (const r of rows) out = out.split(r.placeholder).join(decryptText(r.valueEnc));
  return out;
}

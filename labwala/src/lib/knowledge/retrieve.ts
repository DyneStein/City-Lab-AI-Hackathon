import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/security";
import { getEntry, type LibraryEntry } from "./library";

/**
 * Retrieval for RAG. Two grounded sources per test:
 *  1. The curated library entry (always available, offline).
 *  2. MedlinePlus Connect (free NLM web service, queried by LOINC code), cached locally
 *     for 30 days. Only the test's LOINC code is sent; never user data.
 */

export type RetrievedSource = { id: number; publisher: string; title: string; url: string; text: string; testKey: string };

const CONNECT = "https://connect.medlineplus.gov/service";
const TTL = 30 * 24 * 3600 * 1000;

const stripHtml = (s: string) =>
  s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

async function medlinePlusConnect(entry: LibraryEntry): Promise<{ title: string; url: string; text: string } | null> {
  if (!entry.loinc) return null;
  const cached = db.select().from(schema.knowledgeChunks).where(eq(schema.knowledgeChunks.loinc, entry.loinc)).get();
  if (cached) {
    const src = db.select().from(schema.knowledgeSources).where(eq(schema.knowledgeSources.id, cached.sourceId)).get();
    if (src && Date.now() - src.retrievedAt < TTL) return { title: src.title, url: src.url, text: cached.content };
  }
  try {
    const q = new URLSearchParams({
      "mainSearchCriteria.v.cs": "2.16.840.1.113883.6.1",
      "mainSearchCriteria.v.c": entry.loinc,
      knowledgeResponseType: "application/json",
      "informationRecipient.languageCode.c": "en",
    });
    const res = await fetch(`${CONNECT}?${q}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      feed?: { entry?: { title?: { _value?: string }; link?: { href?: string }[]; summary?: { _value?: string } }[] };
    };
    const e = data.feed?.entry?.[0];
    if (!e?.summary?._value || !e.link?.[0]?.href) return null;
    const text = stripHtml(e.summary._value).slice(0, 700);
    const title = e.title?._value ?? entry.displayName;
    const url = e.link[0].href;
    const sourceId = newId();
    db.transaction((tx) => {
      if (cached) tx.delete(schema.knowledgeChunks).where(eq(schema.knowledgeChunks.id, cached.id)).run();
      tx.insert(schema.knowledgeSources).values({ id: sourceId, publisher: "MedlinePlus Connect (NLM)", title, url, retrievedAt: Date.now() }).run();
      tx.insert(schema.knowledgeChunks).values({ id: newId(), sourceId, testKey: entry.key, loinc: entry.loinc, content: text }).run();
    });
    return { title, url, text };
  } catch {
    return null;
  }
}

export function libraryText(e: LibraryEntry) {
  return [
    `What it measures: ${e.measures}`,
    `If higher than range: ${e.whenHigh}`,
    `If lower than range: ${e.whenLow}`,
    e.reasonsHigh.length ? `Common reasons for higher values: ${e.reasonsHigh.join("; ")}` : "",
    e.reasonsLow.length ? `Common reasons for lower values: ${e.reasonsLow.join("; ")}` : "",
    `Context: ${e.context}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function retrieveForTests(keys: (string | null)[]): Promise<RetrievedSource[]> {
  const unique = [...new Set(keys.filter(Boolean) as string[])];
  const out: RetrievedSource[] = [];
  const live = await Promise.all(unique.map(async (k) => [k, await medlinePlusConnect(getEntry(k)!)] as const));
  for (const k of unique) {
    const e = getEntry(k);
    if (!e) continue;
    const s = e.sources[0];
    out.push({ id: out.length, publisher: s.publisher, title: s.title, url: s.url, text: libraryText(e), testKey: k });
    const l = live.find(([key]) => key === k)?.[1];
    if (l && l.url !== s.url) out.push({ id: out.length, publisher: "MedlinePlus Connect (NLM)", title: l.title, url: l.url, text: l.text, testKey: k });
  }
  return out;
}

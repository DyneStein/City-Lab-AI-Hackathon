import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { decryptJson, encryptJson, sha256 } from "@/lib/crypto";
import { newId } from "@/lib/security";
import { aiConfigured } from "@/lib/env";
import { getEntry, localizedEntry } from "@/lib/knowledge/library";
import { retrieveForTests, type RetrievedSource } from "@/lib/knowledge/retrieve";
import { pseudonymize, restore } from "@/lib/privacy/pii";
import { getHistory, getResults, type Report, type TestResult } from "@/lib/reports/service";
import { dictionaries, type Lang } from "@/lib/i18n/dictionaries";
import { AiError, chatJson, chatText, modelLabel } from "./provider";
import {
  fullExplanationSchema,
  summarySchema,
  type DiscussLevel,
  type FullExplanation,
  type Summary,
  type TestExplanation,
} from "./schemas";

/* ───────────── Prompting ───────────── */

const LANGUAGE_RULES: Record<Lang, string> = {
  en: "Write in plain, warm English that a person with no medical background understands (reading age about 12).",
  ur: "Write in natural, everyday Pakistani Urdu in Urdu script, the way a kind Pakistani doctor would explain to a patient. Avoid stiff literal translation and heavy Persian/Arabic vocabulary. Keep the lab test name in English in brackets the first time, e.g. ہیموگلوبن (Hemoglobin). Use Western digits.",
  pa: "Write in natural Pakistani Punjabi in Shahmukhi (Perso-Arabic) script, as spoken in Lahore/Faisalabad, not Gurmukhi and not Urdu. Keep the lab test name in English in brackets the first time. Use Western digits.",
};

const SAFETY_RULES = `You explain laboratory reports for patient education. Strict rules:
- Never diagnose. Never state or imply that the person has a specific disease. Use "can be related to", "one possible reason".
- Never invent or change any value, unit, or reference range. Do not repeat numbers; the app shows the numbers itself.
- Judge high/low ONLY from the "status" field provided, which was computed from the lab's own range. If status is "unknown", say it cannot be classified from the lab's ranges (for example because age or sex is missing); never estimate it.
- If status is "urgent", say clearly and calmly that the person should see a doctor today.
- A value inside the range does not guarantee good health; a value outside the range does not automatically mean disease. Say so where relevant.
- Never recommend starting, stopping or changing medicines, supplements, vitamins, diet plans or doses, and never say a result "requires" treatment or supplementation. Only suggest discussing it with a doctor.
- Never name a disease as the explanation for a result; describe what the test measures and list possible reasons neutrally.
- Base medical facts on the provided SOURCES. If a test has no source, keep it general and say information is limited.
- Mention missing information that would change interpretation (fasting, pregnancy, medicines, symptoms, earlier results) when relevant.
- Calm, non-alarming tone. No emojis. No markdown.
- Write every field as 1-3 complete, warm sentences that speak directly to the person ("Your ..."), starting with a capital letter. Never write fragments or lowercase phrases. Example for "meaning": "Your vitamin D is below the range printed by your lab. This is common when people spend little time in the sun."`;

type PromptTest = {
  id: string;
  name: string;
  value: string;
  unit: string | null;
  labRange: string | null;
  labFlag: string | null;
  status: TestResult["status"];
  previous: { date: string | null; value: string; unit: string | null; labRange: string | null }[];
  sourceIds: number[];
};

function ageBand(p: { ageYears: number | null; dateOfBirth: string | null } | null) {
  if (!p) return "unknown";
  let age = p.ageYears;
  if (age == null && p.dateOfBirth) age = Math.floor((Date.now() - Date.parse(p.dateOfBirth)) / (365.25 * 864e5));
  if (age == null || !Number.isFinite(age)) return "unknown";
  if (age < 18) return "under 18";
  const lo = Math.floor(age / 10) * 10;
  return `${lo}-${lo + 9}`;
}

/** Who the report is about: age band and sex AS PRINTED ON THE REPORT (or entered on the check screen). */
function personOf(report: Report) {
  return {
    ageBand: report.patientAge === null || report.patientAge === undefined ? "not stated on report" : ageBand({ ageYears: report.patientAge, dateOfBirth: null }),
    sex: report.patientSex ?? "not stated on report",
  };
}

/* ───────────── Safety post-processing (code, not AI) ───────────── */

const LEVEL_RANK: Record<DiscussLevel, number> = { routine: 0, mention_at_next_visit: 1, see_doctor_soon: 2, seek_care_promptly: 3 };
const MIN_LEVEL: Record<TestResult["status"], DiscussLevel> = {
  within: "routine",
  unknown: "routine",
  outside: "mention_at_next_visit",
  review: "see_doctor_soon",
  urgent: "seek_care_promptly",
};

function enforceLevel(status: TestResult["status"], level: DiscussLevel): DiscussLevel {
  const min = MIN_LEVEL[status];
  return LEVEL_RANK[level] >= LEVEL_RANK[min] ? level : min;
}

/** Drop English sentences that tell the person to take/stop/change treatment (prompt rule backstop). */
const TREATMENT = /\b(take|taking|start|stop|increase|decrease|begin)\b[^.]*\b(supplement\w*|tablet\w*|medicine\w*|medication\w*|dose\w*|iron pills?|vitamin [a-z0-9]+ (pills?|tablets?|injections?))\b|\b(requires?|need\w*) (supplementation|treatment|medication)\b|\bsupplementation\b/i;
export function stripTreatmentAdvice(text: string, lang: Lang) {
  if (lang !== "en") return text;
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !TREATMENT.test(s))
    .join(" ")
    .trim();
}

/* ───────────── Library fallback (no AI) ───────────── */

function libraryExplanation(t: TestResult, lang: Lang): TestExplanation {
  const d = dictionaries[lang].report;
  const e = localizedEntry(t.canonicalKey, lang);
  const high = t.valueNum !== null && t.refHigh !== null && t.valueNum > t.refHigh;
  const low = t.valueNum !== null && t.refLow !== null && t.valueNum < t.refLow;
  const level = MIN_LEVEL[t.status];
  const meaning =
    t.status === "within"
      ? d.meaningWithin
      : t.status === "unknown"
        ? d.meaningUnknown
        : high && e
          ? e.whenHigh
          : low && e
            ? e.whenLow
            : d.meaningFlagged;
  return {
    id: t.id,
    measures: e?.measures ?? d.notInLibrary,
    meaning,
    reasons: !e || t.status === "within" || t.status === "unknown" ? [] : high ? e.reasonsHigh : low ? e.reasonsLow : [],
    context: e?.context ?? "",
    discuss: { level, text: d.discussText[level] },
    sourceIds: [],
  };
}

/* ───────────── Public API ───────────── */

export type ExplanationResult<T> = { data: T; generator: string; fallbackReason?: "ai_off" | "ai_failed" | "privacy_unavailable" };

function inputHash(results: TestResult[], lang: Lang, kind: string) {
  return sha256(JSON.stringify([kind, lang, results.map((r) => [r.id, r.testName, r.valueText, r.unit, r.refText, r.labFlag, r.status])]));
}

function cached<T>(reportId: string, kind: "full" | "summary", lang: Lang, hash: string): ExplanationResult<T> | null {
  const row = db
    .select()
    .from(schema.explanations)
    .where(and(eq(schema.explanations.reportId, reportId), eq(schema.explanations.kind, kind), eq(schema.explanations.language, lang)))
    .get();
  if (!row || row.inputHash !== hash) return null;
  return { data: decryptJson<T>(row.contentEnc), generator: row.generator };
}

function store(reportId: string, kind: "full" | "summary", lang: Lang, hash: string, data: unknown, generator: string) {
  db.delete(schema.explanations)
    .where(and(eq(schema.explanations.reportId, reportId), eq(schema.explanations.kind, kind), eq(schema.explanations.language, lang)))
    .run();
  db.insert(schema.explanations)
    .values({ id: newId(), reportId, kind, language: lang, contentEnc: encryptJson(data), generator, inputHash: hash, createdAt: Date.now() })
    .run();
}

async function buildPrompt(userId: string, report: Report, results: TestResult[]) {
  const sources = await retrieveForTests(results.map((r) => r.canonicalKey));
  const history = getHistory(userId, results.map((r) => r.canonicalKey).filter(Boolean) as string[]);
  const tests: PromptTest[] = results.map((r, i) => ({
    id: `t${i + 1}`,
    name: r.testName,
    value: r.valueText,
    unit: r.unit,
    labRange: r.refText,
    labFlag: r.labFlag,
    status: r.status,
    previous: (history[r.canonicalKey ?? ""] ?? [])
      .filter((h) => h.reportId !== report.id)
      .slice(-3)
      .map((h) => ({ date: h.date, value: h.valueText, unit: h.unit, labRange: h.refText })),
    sourceIds: sources.filter((s) => s.testKey === r.canonicalKey).map((s) => s.id),
  }));
  return { tests, sources, idMap: new Map(tests.map((t, i) => [t.id, results[i]])) };
}

// Keep prompts small (free tier: 8k tokens/minute): the curated library text is enough context.
const sourceBlock = (sources: RetrievedSource[]) =>
  sources
    .filter((s) => !s.publisher.startsWith("MedlinePlus Connect"))
    .map((s) => `[${s.id}] ${s.title}\n${s.text}`)
    .join("\n\n");

export async function getFullExplanation(
  user: { id: string; profile: { ageYears: number | null; dateOfBirth: string | null; sex: string | null } | null },
  report: Report,
  lang: Lang,
): Promise<ExplanationResult<FullExplanation>> {
  const results = getResults(report.id);
  const hash = inputHash(results, lang, "full");
  const hit = cached<FullExplanation>(report.id, "full", lang, hash);
  if (hit) return hit;

  const libraryVersion = (reason: ExplanationResult<FullExplanation>["fallbackReason"]): ExplanationResult<FullExplanation> => {
    const sources = results.flatMap((r) => (getEntry(r.canonicalKey)?.sources ?? []).map((s) => ({ ...s, testKey: r.canonicalKey })));
    const uniq = [...new Map(sources.map((s) => [s.url, s])).values()].map((s, id) => ({ id, ...s }));
    return {
      data: {
        overview: "",
        tests: results.map((r) => {
          const ex = libraryExplanation(r, lang);
          const e = getEntry(r.canonicalKey);
          return { ...ex, sourceIds: e ? uniq.filter((u) => e.sources.some((s) => s.url === u.url)).map((u) => u.id) : [] };
        }),
        missingInfo: [],
        sources: uniq,
      },
      generator: "library",
      fallbackReason: reason,
    };
  };

  if (!aiConfigured()) return libraryVersion("ai_off");

  try {
    const { tests, sources, idMap } = await buildPrompt(user.id, report, results);
    const scope = `report:${report.id}`;
    const explained: TestExplanation[] = [];
    let overview = "";
    let missingInfo: string[] = [];
    // Chunk to stay inside free-tier token limits
    for (let i = 0; i < tests.length; i += 5) {
      const chunk = tests.slice(i, i + 5);
      const usedSources = sources.filter((s) => chunk.some((c) => c.sourceIds.includes(s.id)));
      const payload = await pseudonymize(
        user.id,
        scope,
        JSON.stringify({ person: personOf(report), tests: chunk }),
      );
      const out = await chatJson(
        `${SAFETY_RULES}\n\n${LANGUAGE_RULES[lang]}`,
        `SOURCES:\n${sourceBlock(usedSources)}\n\nREPORT TESTS (JSON):\n${payload}\n\nReturn JSON: {"overview": string (2-3 sentences about these tests together${i === 0 ? "" : ", may be brief"}), "tests": [{"id","measures","meaning","reasons": string[] (empty if within range),"context","discuss": {"level": "routine"|"mention_at_next_visit"|"see_doctor_soon"|"seek_care_promptly","text"},"sourceIds": number[]}] (one per test, same ids), "missingInfo": string[]}. If a test has previous values, describe the direction of change in "context" and note that different labs may use different methods.`,
        fullExplanationSchema,
        { maxTokens: 2200 },
      );
      if (i === 0) overview = out.overview;
      missingInfo = missingInfo.concat(out.missingInfo);
      for (const t of chunk) {
        const ai = out.tests.find((x) => x.id === t.id);
        const real = idMap.get(t.id)!;
        if (!ai) {
          explained.push(libraryExplanation(real, lang));
          continue;
        }
        explained.push({
          ...ai,
          id: real.id,
          measures: stripTreatmentAdvice(restore(user.id, scope, ai.measures), lang),
          meaning: stripTreatmentAdvice(restore(user.id, scope, ai.meaning), lang),
          context: stripTreatmentAdvice(restore(user.id, scope, ai.context), lang),
          reasons: ai.reasons.map((r) => restore(user.id, scope, r)),
          discuss: { level: enforceLevel(real.status, ai.discuss.level), text: stripTreatmentAdvice(restore(user.id, scope, ai.discuss.text), lang) || dictionaries[lang].report.discussText[enforceLevel(real.status, ai.discuss.level)] },
          sourceIds: ai.sourceIds.filter((s) => t.sourceIds.includes(s)),
        });
      }
    }
    const data: FullExplanation = {
      overview: restore(user.id, scope, overview),
      tests: explained,
      missingInfo: [...new Set(missingInfo)].slice(0, 6),
      sources: sources.map(({ id, title, url, publisher, testKey }) => ({ id, title, url, publisher, testKey })),
    };
    const generator = `ai:${modelLabel()}`;
    store(report.id, "full", lang, hash, data, generator);
    return { data, generator };
  } catch (e) {
    console.warn("[explain] fallback", (e as Error).message);
    return libraryVersion(e instanceof AiError ? "ai_failed" : (e as Error).name === "PrivacyUnavailableError" || (e as Error).constructor.name === "PrivacyUnavailableError" ? "privacy_unavailable" : "ai_failed");
  }
}

export type SummaryView = Summary & {
  counts: { total: number; within: number; outside: number; review: number; urgent: number; unknown: number };
};

export async function getSummary(
  user: { id: string; profile: { ageYears: number | null; dateOfBirth: string | null; sex: string | null } | null },
  report: Report,
  lang: Lang,
  fallbackQuestions: string[],
): Promise<ExplanationResult<SummaryView>> {
  const results = getResults(report.id);
  const counts = { total: results.length, within: 0, outside: 0, review: 0, urgent: 0, unknown: 0 };
  for (const r of results) counts[r.status]++;
  const flagged = results.filter((r) => r.status === "urgent" || r.status === "review");

  // Safety: every urgent/review result must appear in "attention", whatever the AI says.
  const ensureAttention = (s: Summary): Summary => {
    const ids = new Set(s.attention.map((a) => a.id));
    const extra = flagged.filter((r) => !ids.has(r.id)).map((r) => ({ id: r.id, text: "" }));
    return { ...s, attention: [...extra, ...s.attention] };
  };

  const hash = inputHash(results, lang, "summary");
  const hit = cached<SummaryView>(report.id, "summary", lang, hash);
  if (hit) return hit;

  const fallback = (reason: ExplanationResult<SummaryView>["fallbackReason"]): ExplanationResult<SummaryView> => ({
    data: {
      counts,
      ...ensureAttention({ overview: "", observations: [], attention: [], questions: fallbackQuestions }),
    },
    generator: "library",
    fallbackReason: reason,
  });
  if (!aiConfigured()) return fallback("ai_off");

  try {
    const { tests, idMap } = await buildPrompt(user.id, report, results);
    const scope = `report:${report.id}`;
    const payload = await pseudonymize(
      user.id,
      scope,
      JSON.stringify({ person: personOf(report), counts, tests: tests.map(({ sourceIds: _s, ...t }) => t) }),
    );
    const out = await chatJson(
      `${SAFETY_RULES}\n\n${LANGUAGE_RULES[lang]}`,
      `REPORT TESTS (JSON):\n${payload}\n\nWrite a short summary. Return JSON: {"overview": string (2-3 sentences), "observations": string[] (routine observations, max 5), "attention": [{"id": test id, "text": why it may need professional attention}] (only tests with status review/urgent/outside), "questions": string[] (3-5 practical questions to ask a doctor)}. Clearly separate routine observations from anything that may need prompt attention.`,
      summarySchema,
      { maxTokens: 3000 },
    );
    const mapped: Summary = {
      overview: stripTreatmentAdvice(restore(user.id, scope, out.overview), lang),
      observations: out.observations.map((o) => restore(user.id, scope, o)),
      attention: out.attention
        .filter((a) => idMap.has(a.id))
        .map((a) => ({ id: idMap.get(a.id)!.id, text: stripTreatmentAdvice(restore(user.id, scope, a.text), lang) })),
      questions: out.questions.map((q) => restore(user.id, scope, q)),
    };
    const data: SummaryView = { counts, ...ensureAttention(mapped) };
    const generator = `ai:${modelLabel()}`;
    store(report.id, "summary", lang, hash, data, generator);
    return { data, generator };
  } catch (e) {
    console.warn("[summary] fallback", (e as Error).message);
    return fallback("ai_failed");
  }
}

/** Follow-up question about one report. The question itself is pseudonymized too. */
export async function answerQuestion(
  user: { id: string; profile: { ageYears: number | null; dateOfBirth: string | null; sex: string | null } | null },
  report: Report,
  lang: Lang,
  question: string,
  history: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  if (!aiConfigured()) throw new AiError("not_configured", "AI is not configured");
  const results = getResults(report.id);
  const { tests, sources } = await buildPrompt(user.id, report, results);
  const scope = `report:${report.id}`;
  const payload = await pseudonymize(user.id, scope, JSON.stringify(tests.map(({ sourceIds: _s, ...t }) => t)));
  const q = await pseudonymize(user.id, scope, question);
  const answer = await chatText(
    `${SAFETY_RULES}\n\n${LANGUAGE_RULES[lang]} Answer in that language unless the user clearly asks for another language.\nKeep answers under 150 words. Only discuss THIS report: if asked about any other person, patient or report, politely refuse. If the question needs a diagnosis, say so kindly and suggest asking a doctor. If a status is "unknown" because age or sex is missing, say the range cannot be chosen without it; never guess it.\n\nSOURCES:\n${sourceBlock(sources)}\n\nREPORT TESTS:\n${payload}`,
    [...history.slice(-6), { role: "user", content: q }],
    900,
  );
  return restore(user.id, scope, answer.trim());
}

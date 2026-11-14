import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";

/**
 * Provider-agnostic chat layer. Any OpenAI-compatible endpoint works
 * (Groq, Cerebras, OpenRouter, local Ollama/vLLM) by changing env vars only:
 *   AI_PROVIDER, AI_BASE_URL, AI_MODEL, AI_API_KEY
 */

export class AiError extends Error {
  constructor(
    public code: "not_configured" | "rate_limited" | "provider_error" | "invalid_output" | "timeout",
    message: string,
  ) {
    super(message);
  }
}

type Msg = { role: "system" | "user" | "assistant"; content: string };

async function chat(messages: Msg[], opts: { json: boolean; maxTokens?: number; temperature?: number }) {
  if (!env.AI_API_KEY) throw new AiError("not_configured", "AI_API_KEY is not set");
  let res: Response | null = null;
  // Free tiers limit tokens per minute: on 429, wait as told (max 3 tries).
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      res = await fetch(`${env.AI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env.AI_API_KEY}` },
        body: JSON.stringify({
          model: env.AI_MODEL,
          messages,
          temperature: opts.temperature ?? 0.2,
          max_tokens: opts.maxTokens ?? 4096,
          // gpt-oss models think before answering; low effort keeps us inside free-tier limits.
          ...(/gpt-oss/i.test(env.AI_MODEL) ? { reasoning_effort: "low" } : {}),
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: AbortSignal.timeout(90_000),
      });
    } catch (e) {
      throw new AiError((e as Error).name === "TimeoutError" ? "timeout" : "provider_error", (e as Error).message);
    }
    if (res.status !== 429 || attempt === 4) break;
    const wait = Math.min(30, Math.max(5, Number(res.headers.get("retry-after")) || 10 * (attempt + 1)));
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  if (!res) throw new AiError("provider_error", "no response");
  if (res.status === 429) throw new AiError("rate_limited", "The free AI tier is busy. Please try again shortly.");
  if (!res.ok) throw new AiError("provider_error", `AI provider returned ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new AiError("invalid_output", "Empty response");
  return content;
}

/**
 * Ask for JSON and validate it against a Zod schema. One repair attempt is made with
 * the validation error; after that the caller must fall back (never show unvalidated output).
 */
export async function chatJson<T extends z.ZodTypeAny>(
  system: string,
  user: string,
  schema: T,
  opts: { maxTokens?: number } = {},
): Promise<z.infer<T>> {
  const messages: Msg[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await chat(messages, { json: true, maxTokens: opts.maxTokens });
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch {
      messages.push({ role: "assistant", content: raw }, { role: "user", content: "That was not valid JSON. Reply with only the JSON object." });
      continue;
    }
    const v = schema.safeParse(parsed);
    if (v.success) return v.data;
    messages.push(
      { role: "assistant", content: raw },
      { role: "user", content: `The JSON did not match the required schema: ${v.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}. Reply with only the corrected JSON object.` },
    );
  }
  throw new AiError("invalid_output", "AI output failed schema validation");
}

export async function chatText(system: string, messages: Msg[], maxTokens = 1200) {
  return chat([{ role: "system", content: system }, ...messages], { json: false, maxTokens, temperature: 0.3 });
}

export const modelLabel = () => `${env.AI_MODEL} via ${env.AI_PROVIDER}`;

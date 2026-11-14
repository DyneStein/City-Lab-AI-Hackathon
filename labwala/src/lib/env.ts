import "server-only";
import { z } from "zod";

/**
 * Server-side configuration. Nothing here is ever sent to the browser.
 * Optional integrations stay disabled (and the UI says so) until configured.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  /** Optional public HTTPS address for phones (e.g. a free Cloudflare quick tunnel). */
  PUBLIC_URL: z.string().url().optional(),
  DATA_DIR: z.string().default("./data"),

  /** 32-byte key, base64. Encrypts uploaded files, layouts, explanations, vault. */
  DATA_ENCRYPTION_KEY: z.string().optional(),

  /** AI (OpenAI-compatible chat completions). Default: GPT-OSS-120B on Groq free tier. */
  AI_PROVIDER: z.string().default("groq"),
  AI_BASE_URL: z.string().url().default("https://api.groq.com/openai/v1"),
  AI_MODEL: z.string().default("openai/gpt-oss-120b"),
  AI_API_KEY: z.string().optional(),

  /** Speech-to-text (Whisper, OpenAI-compatible audio endpoint). Groq key reused if unset. */
  STT_MODEL: z.string().default("whisper-large-v3"),

  /** Presidio privacy sidecar (privacy-service/). */
  PRESIDIO_URL: z.string().url().default("http://127.0.0.1:8790"),
  /** If the sidecar is unreachable: "block" (fail closed) or "builtin" (use built-in rules only). */
  PII_FALLBACK: z.enum(["block", "builtin"]).default("block"),

  MAX_UPLOAD_MB: z.coerce.number().default(15),

  /** Gmail (Google OAuth "Web application" client; free). Redirect URI: <APP_URL>/api/gmail/callback */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

export const env = schema.parse(process.env);

export const aiConfigured = () => Boolean(env.AI_API_KEY);

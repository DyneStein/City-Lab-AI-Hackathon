import { z } from "zod";
import { requireApiUser, HttpError } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security";
import { handle } from "@/lib/http";
import { speak } from "@/lib/sidecar";

const body = z.object({ text: z.string().trim().min(1).max(6000), lang: z.enum(["en", "ur", "pa"]) });

/** Natural neural voice for an explanation, in the language the person chose. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!rateLimit(`tts:${user.id}`, 40, 10 * 60_000)) throw new HttpError(429, "too_many");
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, "invalid");
  try {
    const audio = await speak(parsed.data.text, parsed.data.lang);
    return new Response(new Uint8Array(audio), { headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=86400" } });
  } catch {
    throw new HttpError(503, "voice_unavailable");
  }
});

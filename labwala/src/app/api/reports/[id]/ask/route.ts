import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser, HttpError } from "@/lib/auth/session";
import { getOwnedReport } from "@/lib/reports/service";
import { answerQuestion } from "@/lib/ai/explain";
import { AiError } from "@/lib/ai/provider";
import { PrivacyUnavailableError } from "@/lib/privacy/pii";
import { rateLimit } from "@/lib/security";
import { handle } from "@/lib/http";

const body = z.object({
  question: z.string().trim().min(1).max(1000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(12).default([]),
});

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  if (!rateLimit(`ask:${user.id}`, 20, 5 * 60_000)) throw new HttpError(429, "too_many");
  const report = getOwnedReport(user.id, id);
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, "invalid");
  try {
    const answer = await answerQuestion(user, report, user.profile?.language ?? "en", parsed.data.question, parsed.data.history);
    return NextResponse.json({ answer });
  } catch (e) {
    if (e instanceof AiError) return NextResponse.json({ error: e.code }, { status: e.code === "not_configured" ? 503 : 502 });
    if (e instanceof PrivacyUnavailableError) return NextResponse.json({ error: "privacy_unavailable" }, { status: 503 });
    throw e;
  }
});

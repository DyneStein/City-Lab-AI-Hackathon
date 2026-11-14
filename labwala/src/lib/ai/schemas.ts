import { z } from "zod";

/** Shown to the user only after passing these schemas. */

const txt = (max: number) => z.string().trim().min(1).max(max);

export const discussLevel = z.enum(["routine", "mention_at_next_visit", "see_doctor_soon", "seek_care_promptly"]);

export const testExplanationSchema = z.object({
  id: z.string(),
  measures: txt(600),
  meaning: txt(800),
  reasons: z.array(txt(200)).max(6),
  context: txt(600),
  discuss: z.object({ level: discussLevel, text: txt(400) }),
  /** citation indexes into the sources list given in the prompt */
  sourceIds: z.array(z.number().int().nonnegative()).max(5),
});

export const fullExplanationSchema = z.object({
  overview: txt(900),
  tests: z.array(testExplanationSchema),
  missingInfo: z.array(txt(300)).max(6),
});

export const summarySchema = z.object({
  overview: txt(700),
  observations: z.array(txt(300)).max(8),
  attention: z.array(z.object({ id: z.string(), text: txt(300) })).max(10),
  questions: z.array(txt(250)).min(1).max(8),
});

export type TestExplanation = z.infer<typeof testExplanationSchema>;
export type FullExplanation = z.infer<typeof fullExplanationSchema> & { sources: { id: number; title: string; url: string; publisher: string; testKey: string | null }[] };
export type Summary = z.infer<typeof summarySchema>;
export type DiscussLevel = z.infer<typeof discussLevel>;

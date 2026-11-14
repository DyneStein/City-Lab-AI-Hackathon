import type { ResultStatus } from "@/lib/reports/types";
import type { DiscussLevel } from "@/lib/ai/schemas";

export type Direction = "below" | "above" | "flagged" | "critical" | "none" | "within" | "needsAge" | "needsSex" | "needsAgeSex" | "cannot" | "unitUnconvertible" | "threshold";

/** Everything the report screen needs about one result, already in the user's language. */
export type ViewResult = {
  id: string;
  name: string; // localized when known, otherwise as printed
  source: string | null; // the report line this came from (for text reports)
  valueText: string;
  valueNum: number | null;
  unit: string | null;
  refText: string | null;
  refLow: number | null;
  refHigh: number | null;
  status: ResultStatus;
  direction: Direction;
  page: number | null;
  box: [number, number, number, number] | null;
  explanation: {
    measures: string;
    meaning: string;
    reasons: string[];
    context: string;
    discussLevel: DiscussLevel;
    discussText: string;
    sources: { n: number; url: string }[];
  } | null;
  history: { date: string; valueText: string; unit: string | null; refText: string | null }[];
  trend: "up" | "down" | "same" | "units" | null;
};

export type ViewSummary = {
  overview: string;
  attention: { id: string; text: string }[];
  observations: string[];
  questions: string[];
};

/**
 * Decide the reference range and status for one result, in this order:
 *   1. a range printed next to the result on the report
 *   2. the lab's published range sheet (sex/age band, unit-converted), if the lab is known
 *   3. otherwise: explicit "needs age/sex" or "cannot be classified" — never a guess
 * Urgent thresholds and lab critical flags always apply (see classify()).
 */
import { classify } from "./classify";
import { lookupSheet, sheetForLab } from "./range-sheets";
import type { ResultStatus } from "./types";

export type EvalInput = {
  canonicalKey: string | null;
  valueText: string;
  valueNum: number | null;
  unit: string | null;
  refText: string | null;
  refLow: number | null;
  refHigh: number | null;
  labFlag: string | null;
};
export type EvalContext = { labName: string | null; age: number | null; sex: "male" | "female" | null };
export type Evaluated = { refText: string | null; refLow: number | null; refHigh: number | null; status: ResultStatus; statusReason: string };

/** Status-reason codes the UI translates. */
export const REASONS = {
  needsAge: "needs_age",
  needsSex: "needs_sex",
  needsAgeSex: "needs_age_sex",
  notClassifiable: "not_classifiable",
  unitUnconvertible: "unit_unconvertible",
  sheet: "lab_range_sheet",
  qualitative: "qualitative",
} as const;

export function evaluateResult(r: EvalInput, ctx: EvalContext): Evaluated {
  const printed = r.refLow !== null || r.refHigh !== null;
  const base = { refText: r.refText, refLow: r.refLow, refHigh: r.refHigh };

  // Critical flags / urgent thresholds win regardless of range availability.
  const urgentCheck = classify({ ...r, refLow: null, refHigh: null });
  if (urgentCheck.status === "urgent") return { ...base, ...withRange(r, ctx), status: "urgent", statusReason: urgentCheck.reason };

  if (printed || r.labFlag) {
    const c = classify(r);
    return { ...base, status: c.status, statusReason: c.reason };
  }
  return withRange(r, ctx);
}

function withRange(r: EvalInput, ctx: EvalContext): Evaluated {
  const sheet = sheetForLab(ctx.labName);
  const none = { refText: r.refText, refLow: r.refLow, refHigh: r.refHigh };
  if (!sheet) return { ...none, status: "unknown", statusReason: REASONS.notClassifiable };
  const s = lookupSheet(sheet, r.canonicalKey, r.unit, ctx.age, ctx.sex);
  switch (s.kind) {
    case "needs": {
      const code = s.missing.length === 2 ? REASONS.needsAgeSex : s.missing[0] === "age" ? REASONS.needsAge : REASONS.needsSex;
      return { ...none, status: "unknown", statusReason: code };
    }
    case "not_on_sheet":
      return { ...none, status: "unknown", statusReason: REASONS.notClassifiable };
    case "unconvertible":
      return { ...none, status: "unknown", statusReason: REASONS.unitUnconvertible };
    case "qualitative": {
      const ok = r.valueText.trim().toLowerCase() === s.expected;
      return { refText: s.refText[0].toUpperCase() + s.refText.slice(1), refLow: null, refHigh: null, status: ok ? "within" : "outside", statusReason: REASONS.qualitative };
    }
    case "range": {
      const c = classify({ ...r, refLow: s.low, refHigh: s.high });
      return { refText: s.refText, refLow: s.low, refHigh: s.high, status: c.status, statusReason: c.status === "unknown" ? REASONS.notClassifiable : REASONS.sheet };
    }
  }
}

/** Reasons whose range was derived by the app (not typed/printed): re-derive instead of re-parsing. */
export const DERIVED_REASONS = new Set<string>(Object.values(REASONS));

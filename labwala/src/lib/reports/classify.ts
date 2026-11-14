/**
 * Informational result categories. These are NOT diagnoses.
 *
 *  within   – value inside the range printed by the lab
 *  outside  – value outside the printed range, or the lab printed H/L
 *  review   – outside, and the value is ≥ 20% beyond the nearest printed limit.
 *             (The 20% rule is an app heuristic for ordering attention, not a clinical
 *             rule. Lab H/L flags confirm "outside" but do not escalate by themselves.)
 *  urgent   – the lab itself marked the value as critical/panic (HH, LL, Critical), or the
 *             value crosses a threshold in CRITICAL_THRESHOLDS, which only contains
 *             entries with a cited source approved by a clinician.
 *  unknown  – no usable range on the report and no lab flag
 */
import type { ResultStatus } from "./types";
import { convert } from "./units";

type Input = {
  canonicalKey: string | null;
  valueNum: number | null;
  valueText: string;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  labFlag: string | null;
};

/**
 * Urgent thresholds with a recorded source. A value that hits OR passes a threshold is urgent
 * ("hit or pass" per the source). Values in other units are converted exactly before comparing;
 * if the unit cannot be converted, the threshold is not applied (no guessing).
 */
export const CRITICAL_THRESHOLDS: {
  key: string;
  unit: string;
  below?: number;
  above?: number;
  source: string;
  approvedBy: string;
}[] = [
  { key: "hemoglobin", unit: "g/dL", below: 7.0, source: "CityLab dangerous/urgent values directive", approvedBy: "CityLab Diagnostics (hackathon corpus)" },
  { key: "glucose_fasting", unit: "mg/dL", above: 300, source: "CityLab dangerous/urgent values directive", approvedBy: "CityLab Diagnostics (hackathon corpus)" },
  { key: "platelets", unit: "cells/mcL", below: 50000, source: "CityLab dangerous/urgent values directive", approvedBy: "CityLab Diagnostics (hackathon corpus)" },
  { key: "alt", unit: "U/L", above: 1000, source: "CityLab dangerous/urgent values directive", approvedBy: "CityLab Diagnostics (hackathon corpus)" },
];

const CRITICAL_FLAG = /^(HH|LL|CRITICAL|CRIT|PANIC)$/i;
const HIGH_FLAG = /^(H|HIGH|↑)$/i;
const LOW_FLAG = /^(L|LOW|↓)$/i;

export function classify(r: Input): { status: ResultStatus; reason: string } {
  const flag = r.labFlag?.trim() ?? "";
  if (CRITICAL_FLAG.test(flag)) return { status: "urgent", reason: "critical_flag" };

  if (r.valueNum !== null && r.unit) {
    for (const t of CRITICAL_THRESHOLDS) {
      if (t.key !== r.canonicalKey) continue;
      const v = convert(t.key, r.valueNum, r.unit, t.unit);
      if (v === null) continue;
      if ((t.below !== undefined && v <= t.below) || (t.above !== undefined && v >= t.above))
        return { status: "urgent", reason: "critical_threshold" };
    }
  }

  const labFlagged = HIGH_FLAG.test(flag) || LOW_FLAG.test(flag) || flag === "*" || /^A(BNORMAL)?$/i.test(flag);

  // Comparison against the lab's own printed range
  if (r.valueNum !== null && (r.refLow !== null || r.refHigh !== null)) {
    const below = r.refLow !== null && r.valueNum < r.refLow;
    const above = r.refHigh !== null && r.valueNum > r.refHigh;
    if (!below && !above) {
      return labFlagged
        ? { status: "outside", reason: "Inside the printed range, but the lab flagged it. Please check the value." }
        : { status: "within", reason: "Inside the lab's printed reference range." };
    }
    const limit = below ? r.refLow! : r.refHigh!;
    const beyond = limit !== 0 ? Math.abs(r.valueNum - limit) / Math.abs(limit) : 1;
    const dir = below ? "below" : "above";
    if (beyond >= 0.2)
      return { status: "review", reason: `Clearly ${dir} the lab's printed range (${Math.round(beyond * 100)}% beyond the limit).` };
    return { status: "outside", reason: `${dir === "below" ? "Below" : "Above"} the lab's printed range by a small margin.` };
  }

  // "<0.5" style values against an upper bound
  const lt = r.valueText.match(/^<\s*([\d.]+)/);
  if (lt && r.refHigh !== null && Number(lt[1]) <= r.refHigh)
    return { status: "within", reason: "Reported as below the detection limit, inside the lab's range." };

  if (labFlagged) return { status: "outside", reason: "The lab flagged this result as outside its range." };
  return { status: "unknown", reason: "No reference range was printed for this test." };
}

export const STATUS_ORDER: Record<ResultStatus, number> = { urgent: 0, review: 1, outside: 2, unknown: 3, within: 4 };

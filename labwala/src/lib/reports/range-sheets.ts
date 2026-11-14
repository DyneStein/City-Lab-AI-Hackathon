/**
 * Laboratory-published reference range sheets.
 *
 * Some labs print ranges in separate "range sheets" instead of next to each result.
 * These are still the LAB'S OWN ranges (not invented): each entry is transcribed from the lab's
 * sheet, with its sex and age band. Rules from the CityLab sheets:
 *  - a value exactly on a limit is NORMAL (inclusive limits)
 *  - age bands are inclusive of the upper bound
 *  - if age or sex is needed and missing, DO NOT GUESS: ask the person
 *  - tests not on the sheet, or units that cannot be converted, "cannot be classified"
 */
import { convert, round } from "./units";

type Sex = "male" | "female";
type Entry = {
  key: string;
  sex: Sex | "all";
  ageMin: number;
  ageMax: number;
  low?: number;
  high?: number;
  qualitative?: string; // e.g. "negative"
  unit: string;
};

export type RangeSheet = { id: string; name: string; matches: RegExp; source: string; entries: Entry[] };

const CITYLAB: RangeSheet = {
  id: "citylab",
  name: "CityLab Diagnostics",
  matches: /city\s*lab/i,
  source: "CityLab range sheets (hematology, biochemistry, thyroid & urinalysis)",
  entries: [
    { key: "hemoglobin", sex: "male", ageMin: 18, ageMax: 100, low: 13.8, high: 17.2, unit: "g/dL" },
    { key: "hemoglobin", sex: "female", ageMin: 18, ageMax: 100, low: 12.1, high: 15.1, unit: "g/dL" },
    { key: "wbc", sex: "all", ageMin: 18, ageMax: 100, low: 4500, high: 11000, unit: "cells/mcL" },
    { key: "platelets", sex: "all", ageMin: 18, ageMax: 100, low: 150000, high: 450000, unit: "cells/mcL" },
    { key: "glucose_fasting", sex: "all", ageMin: 18, ageMax: 100, low: 70, high: 99, unit: "mg/dL" },
    { key: "alt", sex: "male", ageMin: 18, ageMax: 100, low: 7, high: 55, unit: "U/L" },
    { key: "alt", sex: "female", ageMin: 18, ageMax: 100, low: 7, high: 45, unit: "U/L" },
    { key: "ast", sex: "male", ageMin: 18, ageMax: 100, low: 8, high: 48, unit: "U/L" },
    { key: "ast", sex: "female", ageMin: 18, ageMax: 100, low: 8, high: 43, unit: "U/L" },
    { key: "cholesterol_total", sex: "all", ageMin: 18, ageMax: 100, low: 125, high: 200, unit: "mg/dL" },
    { key: "tsh", sex: "all", ageMin: 18, ageMax: 100, low: 0.4, high: 4.0, unit: "mIU/L" },
    { key: "urine_ph", sex: "all", ageMin: 18, ageMax: 100, low: 4.5, high: 8.0, unit: "" },
    { key: "urine_protein", sex: "all", ageMin: 18, ageMax: 100, qualitative: "negative", unit: "" },
  ],
};

export const RANGE_SHEETS: RangeSheet[] = [CITYLAB];

export type SheetResult =
  | { kind: "range"; low: number | null; high: number | null; refText: string; note: string }
  | { kind: "qualitative"; expected: string; refText: string; note: string }
  | { kind: "needs"; missing: ("age" | "sex")[] }
  | { kind: "unconvertible"; sheetUnit: string }
  | { kind: "not_on_sheet" };

export function sheetForLab(labName: string | null | undefined): RangeSheet | null {
  if (!labName) return null;
  return RANGE_SHEETS.find((s) => s.matches.test(labName)) ?? null;
}

/**
 * The lab's range for this test, converted into the unit the report used.
 * Never guesses age or sex: if a needed one is missing, says which.
 */
export function lookupSheet(
  sheet: RangeSheet,
  testKey: string | null,
  reportUnit: string | null,
  age: number | null,
  sex: Sex | null,
): SheetResult {
  const candidates = sheet.entries.filter((e) => e.key === testKey);
  if (!testKey || !candidates.length) return { kind: "not_on_sheet" };
  const sexSpecific = candidates.some((e) => e.sex !== "all");
  const missing: ("age" | "sex")[] = [];
  if (age === null) missing.push("age");
  if (sexSpecific && !sex) missing.push("sex");
  if (missing.length) return { kind: "needs", missing };
  const e = candidates.find((c) => (c.sex === "all" || c.sex === sex) && age! >= c.ageMin && age! <= c.ageMax);
  if (!e) return { kind: "not_on_sheet" }; // outside the sheet's age band
  if (e.qualitative) return { kind: "qualitative", expected: e.qualitative, refText: e.qualitative, note: sheet.source };
  const low = e.low === undefined ? null : convert(testKey, e.low, e.unit, reportUnit || e.unit);
  const high = e.high === undefined ? null : convert(testKey, e.high, e.unit, reportUnit || e.unit);
  if ((e.low !== undefined && low === null) || (e.high !== undefined && high === null)) return { kind: "unconvertible", sheetUnit: e.unit };
  const sameUnit = !reportUnit || convert(testKey, 1, e.unit, reportUnit) === 1;
  const printed = `${e.low ?? ""} - ${e.high ?? ""} ${e.unit}`.trim();
  const refText = sameUnit ? printed : `${round(low!)} - ${round(high!)} (${printed})`;
  return { kind: "range", low: low === null ? null : round(low), high: high === null ? null : round(high), refText, note: sheet.source };
}

/**
 * Unit normalisation and conversion. Only conversions that are mathematically exact for the
 * given test are allowed; anything else returns null ("cannot be converted"), never a guess.
 */

/** Canonical spelling for comparing units ("cells/mcL" → "/ul", "x10^9/L" → "10^9/l"). */
export function normUnit(u: string | null | undefined): string {
  if (!u) return "";
  let s = u.toLowerCase().replace(/\s+/g, "").replace(/[µμ]/g, "u").replace(/mcl/g, "ul");
  s = s.replace(/^cells?\//, "/").replace(/cumm$/, "ul").replace(/mm3$/, "ul").replace(/\/cmm$/, "/ul");
  s = s.replace(/^x/, "").replace(/×/g, "").replace(/\*/g, "");
  s = s.replace(/^(thou|k)\/ul$/, "10^3/ul").replace(/^10e?(\d)/, "10^$1");
  if (s === "iu/l") s = "u/l";
  if (s === "miu/l" || s === "uiu/ml" || s === "uiu/l*1000") s = "miu/l"; // mIU/L ≡ µIU/mL
  return s;
}

/** Cell counts: value of 1 unit expressed in cells per µL. */
const COUNT_PER_UL: Record<string, number> = {
  "/ul": 1,
  "10^3/ul": 1e3,
  "10^9/l": 1e3, // 10^9 per litre = 10^3 per µL
  "10^6/ul": 1e6,
  "10^12/l": 1e6,
};

/** Test-specific mass/molar factors: value in unit A × factor = value in unit B. */
const FACTORS: Record<string, Record<string, number>> = {
  glucose_fasting: { "mmol/l>mg/dl": 18.016 },
  hba1c: {},
  cholesterol_total: { "mmol/l>mg/dl": 38.67 },
  ldl: { "mmol/l>mg/dl": 38.67 },
  hdl: { "mmol/l>mg/dl": 38.67 },
  triglycerides: { "mmol/l>mg/dl": 88.57 },
  creatinine: { "umol/l>mg/dl": 1 / 88.4 },
  urea: { "mmol/l>mg/dl": 6.006 },
  hemoglobin: { "g/l>g/dl": 0.1, "mmol/l>g/dl": 1.611 },
};

/** Convert a value of a given test between units. Returns null if not convertible. */
export function convert(testKey: string | null, value: number, from: string | null, to: string | null): number | null {
  const a = normUnit(from);
  const b = normUnit(to);
  if (a === b) return value;
  if (a in COUNT_PER_UL && b in COUNT_PER_UL) return (value * COUNT_PER_UL[a]) / COUNT_PER_UL[b];
  const f = testKey ? FACTORS[testKey] : undefined;
  if (f?.[`${a}>${b}`]) return value * f[`${a}>${b}`];
  if (f?.[`${b}>${a}`]) return value / f[`${b}>${a}`];
  return null;
}

/** Round for display without losing meaning (3 significant figures, max 2 decimals). */
export function round(n: number): number {
  if (Math.abs(n) >= 100) return Math.round(n);
  return Math.round(n * 100) / 100;
}

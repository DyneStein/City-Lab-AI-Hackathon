/**
 * Deterministic lab-report line parser.
 *
 * It never guesses: if a value, unit or range is unclear the row is marked
 * `needsReview` and the user must confirm it on the verification screen.
 * Reference ranges come ONLY from the text printed on the report.
 */
import { matchTest } from "@/lib/knowledge/library";
import type { Box, LayoutLine, ParsedReport, ParsedResult, ReportLayout } from "./types";

const NUM = String.raw`\d+(?:[.,]\d+)?`;
const RANGE_RE = new RegExp(String.raw`(${NUM})\s*(?:-|–|—|to)\s*(${NUM})`, "i");
const BOUND_RE = new RegExp(String.raw`(<=|>=|≤|≥|<|>|up\s*to|upto|less\s+than|more\s+than|below|above)\s*(${NUM})`, "i");
const VALUE_TOKEN_RE = new RegExp(String.raw`^([<>]=?|≤|≥)?(${NUM})(\*|[hHlL])?$`);
const FLAG_RE = /^(H|L|HH|LL|High|Low|Critical|Crit|Panic|\*|↑|↓|A|Abnormal)$/i;
const UNIT_RE =
  /^(%|[a-zµμ]*\/[a-zµμ0-9^.]+|[a-zµμ]+\/[a-zµμ0-9^.]+|x?\s?10\^?\d+\/[a-zµμ]+|fl|fL|pg|g\/dl|mg\/dl|mmol\/l|µiu\/ml|uiu\/ml|miu\/l|iu\/l|u\/l|ng\/ml|pg\/ml|meq\/l|cells\/cumm|\/cumm|\/ul|\/µl|mm\/hr|mm\/1st\s*hr|million\/cumm|lakh\/cumm|thou\/ul|10\^3\/ul|10\^6\/ul|10\^9\/l|10\^12\/l|mg\/l|µg\/dl|ug\/dl|nmol\/l|pmol\/l|ratio|sec|seconds)$/i;

/** Lines that contain numbers but are never test results. */
const NON_RESULT_RE =
  /\b(age|sex|gender|date|time|page|mr\s*(no|#)?|mrn|reg(istration)?\s*(no|#)?|lab\s*(no|#|id)|patient|phone|cell|mobile|contact|cnic|nic|referred|ref\.?\s*by|consultant|doctor|dr\.|specimen|sample\s*(no|id)|collected|received|reported|printed|invoice|receipt|bill|visit|address|email|www|http|license|pmdc|years?\s*old)\b/i;

const parseNum = (s: string) => {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const unionBox = (boxes: Box[]): Box | null => {
  if (!boxes.length) return null;
  const x1 = Math.min(...boxes.map((b) => b[0]));
  const y1 = Math.min(...boxes.map((b) => b[1]));
  const x2 = Math.max(...boxes.map((b) => b[0] + b[2]));
  const y2 = Math.max(...boxes.map((b) => b[1] + b[3]));
  return [x1, y1, x2 - x1, y2 - y1];
};

export function parseRange(text: string): { refText: string; low: number | null; high: number | null } | null {
  const r = text.match(RANGE_RE);
  if (r) {
    const low = parseNum(r[1]);
    const high = parseNum(r[2]);
    if (low !== null && high !== null && low <= high) return { refText: r[0].trim(), low, high };
  }
  const b = text.match(BOUND_RE);
  if (b) {
    const op = b[1].toLowerCase().replace(/\s+/g, "");
    const v = parseNum(b[2]);
    if (v === null) return null;
    const upper = ["<", "<=", "≤", "upto", "lessthan", "below"].includes(op);
    return { refText: b[0].trim(), low: upper ? null : v, high: upper ? v : null };
  }
  return null;
}

/** Parse a single text line into a result, or null if it is not a result row. */
export function parseLine(line: LayoutLine, page: number | null): ParsedResult | null {
  const text = line.text.replace(/\s+/g, " ").trim();
  if (text.length < 3 || !/\d/.test(text) || !/[a-z]{2}/i.test(text)) return null;

  const tokens = text.split(" ");
  // first token that looks like a measured value, with real letters before it
  let vi = -1;
  for (let i = 1; i < tokens.length; i++) {
    const startsRange = ["-", "–", "—", "to"].includes(tokens[i + 1]?.toLowerCase() ?? "");
    if (!startsRange && VALUE_TOKEN_RE.test(tokens[i]) && /[a-z]{2}/i.test(tokens.slice(0, i).join(" "))) {
      vi = i;
      break;
    }
  }
  if (vi < 0) return null;

  let name = tokens.slice(0, vi).join(" ").replace(/[:\-–|]+$/, "").trim();
  if (NON_RESULT_RE.test(name) || name.length > 60) return null;
  name = name.replace(/\s*[:|]\s*$/, "");

  const m = tokens[vi].match(VALUE_TOKEN_RE)!;
  const valueText = `${m[1] ?? ""}${m[2]}`;
  const valueNum = m[1] ? null : parseNum(m[2]); // "<0.5" is not a plain number
  let labFlag: string | null = m[3] ? m[3].toUpperCase() : null;

  const rest = tokens.slice(vi + 1);
  let unit: string | null = null;
  const restStrs: string[] = [];
  for (const tok of rest) {
    if (!unit && UNIT_RE.test(tok)) unit = tok;
    else if (!labFlag && FLAG_RE.test(tok)) labFlag = tok.toUpperCase();
    else restStrs.push(tok);
  }
  const range = parseRange(restStrs.join(" "));
  const canonical = matchTest(name);

  // Reject lines that are probably not results: no unit, no range, unknown test
  if (!unit && !range && !canonical) return null;

  const reasons: string[] = [];
  if (!unit) reasons.push("unit_missing");
  if (!range && /\d\s*(-|–|to)\s*\d|[<>]/.test(restStrs.join(" "))) reasons.push("range_unclear");
  if (line.confidence !== undefined && line.confidence < 80) reasons.push("low_ocr");
  if (valueNum !== null && range) {
    // A misread decimal point (10.5 -> 105) lands ~10x beyond the nearest limit;
    // genuinely extreme values deserve a re-check by the user too.
    const farAbove = range.high !== null && range.high > 0 && valueNum / range.high > 5;
    const farBelow = range.low !== null && range.low > 0 && valueNum >= 0 && range.low / Math.max(valueNum, 1e-9) > 5;
    if (farAbove || farBelow) reasons.push("decimal");
  }

  // Bounding box of name..value(..unit/range) items for the original-report viewer
  const itemBoxes = line.items
    .filter((it) => it.str.trim())
    .map((it) => it.box);

  return {
    testName: name,
    canonicalKey: canonical?.key ?? null,
    valueText,
    valueNum,
    unit,
    refText: range?.refText ?? null,
    refLow: range?.low ?? null,
    refHigh: range?.high ?? null,
    labFlag,
    needsReview: reasons.length > 0,
    reviewReason: reasons.join(",") || null,
    page,
    box: unionBox(itemBoxes) ?? line.box,
    sourceLine: text,
  };
}

const DATE_RE =
  /\b(\d{1,2})[\/\-.](\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\/\-.](\d{2,4})\b/i;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function toIsoDate(m: RegExpMatchArray): string | null {
  const d = Number(m[1]);
  const mon = /^\d+$/.test(m[2]) ? Number(m[2]) : MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  if (!d || !mon || d > 31 || mon > 12) return null; // ambiguous; user confirms
  return `${y}-${String(mon).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseReport(layout: ReportLayout): ParsedReport {
  const results: ParsedResult[] = [];
  let labName: string | null = null;
  let reportDate: string | null = null;
  let fallbackDate: string | null = null;

  for (const page of layout.pages) {
    for (const [i, line] of page.lines.entries()) {
      const t = line.text.trim();
      if (!labName && page.page === 1 && i < 12 && /\b(lab|laborator(y|ies)|diagnostic|pathology|hospital|clinic)\b/i.test(t) && t.length < 80)
        labName = t.replace(/\s+/g, " ");
      const dm = t.match(DATE_RE);
      if (dm) {
        const iso = toIsoDate(dm);
        if (iso && /report|result|verified|date/i.test(t) && !/birth|dob/i.test(t)) reportDate ??= iso;
        else if (iso && !/birth|dob/i.test(t)) fallbackDate ??= iso;
      }
      const r = parseLine(line, page.page);
      if (r) results.push(r);
    }
  }
  return { labName, reportDate: reportDate ?? fallbackDate, results };
}

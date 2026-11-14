import { describe, expect, it } from "vitest";
import { parseLine, parseRange } from "./parse";
import { classify } from "./classify";
import type { LayoutLine } from "./types";

const line = (text: string, confidence?: number): LayoutLine => ({ text, items: [{ str: text, box: [0, 0, 100, 10] }], box: [0, 0, 100, 10], confidence });

describe("parseRange", () => {
  it("parses dash ranges", () => expect(parseRange("12.0 - 16.0")).toMatchObject({ low: 12, high: 16 }));
  it("parses upper bounds", () => expect(parseRange("< 200")).toMatchObject({ low: null, high: 200 }));
  it("parses lower bounds", () => expect(parseRange("> 40")).toMatchObject({ low: 40, high: null }));
  it("rejects inverted ranges", () => expect(parseRange("16 - 12")).toBeNull());
});

describe("parseLine", () => {
  it("parses a standard row", () => {
    const r = parseLine(line("Hemoglobin 10.5 g/dL 12.0 - 16.0 L"), 1)!;
    expect(r).toMatchObject({ testName: "Hemoglobin", canonicalKey: "hemoglobin", valueNum: 10.5, unit: "g/dL", refLow: 12, refHigh: 16, labFlag: "L" });
  });
  it("keeps digits inside test names", () => {
    const r = parseLine(line("HbA1c 6.1 % 4.0 - 5.6 H"), 1)!;
    expect(r).toMatchObject({ testName: "HbA1c", canonicalKey: "hba1c", valueNum: 6.1, unit: "%" });
  });
  it("ignores patient header lines", () => {
    expect(parseLine(line("Age/Sex: 34 Years / Female"), 1)).toBeNull();
    expect(parseLine(line("Reg No: DL-2026-004127"), 1)).toBeNull();
    expect(parseLine(line("Phone 03001234567"), 1)).toBeNull();
  });
  it("flags missing units for review", () => {
    const r = parseLine(line("Hemoglobin 10.5 12.0 - 16.0"), 1)!;
    expect(r.needsReview).toBe(true);
  });
  it("flags low OCR confidence", () => {
    const r = parseLine(line("Hemoglobin 10.5 g/dL 12.0 - 16.0", 55), 1)!;
    expect(r.reviewReason).toContain("low_ocr");
  });
  it("flags possible decimal misreads", () => {
    const r = parseLine(line("Hemoglobin 105 g/dL 12.0 - 16.0"), 1)!;
    expect(r.reviewReason).toContain("decimal");
  });
  it("handles missing reference range", () => {
    const r = parseLine(line("Ferritin 9 ng/mL"), 1)!;
    expect(r.refText).toBeNull();
    expect(classify(r).status).toBe("unknown");
  });
});

describe("classify", () => {
  const base = { canonicalKey: "hemoglobin", unit: "g/dL", valueText: "", labFlag: null };
  it("within range", () => expect(classify({ ...base, valueNum: 13, refLow: 12, refHigh: 16 }).status).toBe("within"));
  it("slightly outside", () => expect(classify({ ...base, valueNum: 11.5, refLow: 12, refHigh: 16 }).status).toBe("outside"));
  it("lab H/L flag alone does not escalate", () => expect(classify({ ...base, valueNum: 11.5, refLow: 12, refHigh: 16, labFlag: "L" }).status).toBe("outside"));
  it("lab flag without range counts as outside", () => expect(classify({ ...base, valueNum: 11.5, refLow: null, refHigh: null, labFlag: "H" }).status).toBe("outside"));
  it("far outside needs review", () => expect(classify({ ...base, valueNum: 8, refLow: 12, refHigh: 16 }).status).toBe("review"));
  it("lab critical flag is urgent", () => expect(classify({ ...base, valueNum: 6, refLow: 12, refHigh: 16, labFlag: "LL" }).status).toBe("urgent"));
  it("never urgent from range alone (no approved thresholds)", () =>
    expect(classify({ ...base, valueNum: 3, refLow: 12, refHigh: 16 }).status).toBe("review"));
});

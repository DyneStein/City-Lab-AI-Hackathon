import { describe, expect, it } from "vitest";
import { parseReport } from "./parse";
import { evaluateResult } from "./evaluate";
import { convert } from "./units";
import type { ReportLayout } from "./types";

const layout = (text: string): ReportLayout => ({
  method: "text",
  pages: [{ page: 1, width: 0, height: 0, lines: text.split("\n").filter((l) => l.trim()).map((l) => ({ text: l.trim(), items: [], box: [0, 0, 0, 0] })) }],
});

const report = (demo: string, results: string) => `# CITYLAB DIAGNOSTICS - COMPREHENSIVE ANALYTICAL REPORT
## SECTION I: PATIENT DEMOGRAPHICS & ENCOUNTER DETAILS
* **Patient Full Name**: Test Person
${demo}
* **Medical Record Number (MRN)**: CLD-P000-9942
* **Date of Issuance**: 2026-11-13
## SECTION III: ANALYTICAL RESULTS
The analytical phase was completed successfully with no machine errors reported. The raw data output from the analyzers is presented below:
${results}
### APPENDIX 1: EXTENDED DOCUMENTATION
The reference intervals established by this laboratory were determined through a comprehensive population study of 10,000 local, healthy volunteers.
Electronic Data Interchange (EDI) for the transmission of these results is conducted via HL7 (Health Level Seven) messaging standards over TLS 1.3 encrypted conduits.`;

function run(text: string) {
  const p = parseReport(layout(text));
  return { p, rows: p.results.map((r) => ({ name: r.testName, ...evaluateResult(r, { labName: p.labName, age: p.patientAge, sex: p.patientSex }) })) };
}

const adult = (sex: string) => `* **Recorded Age**: 40\n* **Biological Sex**: ${sex}`;

describe("units", () => {
  it("converts glucose mmol/L to mg/dL", () => expect(convert("glucose_fasting", 6, "mmol/L", "mg/dL")).toBeCloseTo(108.1, 1));
  it("converts cell counts", () => expect(convert("platelets", 150, "x10^9/L", "cells/mcL")).toBe(150000));
  it("refuses unknown conversions", () => expect(convert("alt", 1, "mg/dL", "U/L")).toBeNull());
});

describe("CityLab corpus edge cases", () => {
  it("reads demographics, ignores boilerplate numbers", () => {
    const { p, rows } = run(report(adult("Female"), "- **Hemoglobin**: 13.5 g/dL"));
    expect(p).toMatchObject({ labName: "CITYLAB DIAGNOSTICS", reportDate: "2026-11-13", patientAge: 40, patientSex: "female" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "within", refText: "12.1 - 15.1 g/dL" });
  });

  it("uses the printed sex, never the name", () => {
    const { rows } = run(report(adult("Female"), "| Test Name | Result | Unit |\n| :--- | :--- | :--- |\n| SGPT | 45 | U/L |"));
    expect(rows[0]).toMatchObject({ status: "within", refText: "7 - 45 U/L" });
  });

  it("treats values exactly on a limit as normal", () => {
    expect(run(report(adult("Female"), "- **Cholesterol**: 200 mg/dL")).rows[0].status).toBe("within");
  });

  it("converts units before comparing", () => {
    const r = run(report(adult("Male"), "- **Fasting Blood Sugar**: 6.0 mmol/L")).rows[0];
    expect(r.status).toBe("outside");
    expect(r.refText).toContain("70 - 99 mg/dL");
  });

  it("asks for missing age instead of guessing", () => {
    const r = run(report("* **Recorded Age**: [DATA CORRUPTED]\n* **Biological Sex**: [DATA CORRUPTED]", "Test Conducted: Fasting Blood Sugar\nValue Recorded: 110 mg/dL"));
    expect(r.rows[0]).toMatchObject({ name: "Fasting Blood Sugar", status: "unknown", statusReason: "needs_age" });
  });

  it("asks for missing sex when the range depends on it", () => {
    const r = run(report("* **Recorded Age**: 32\n* **Biological Sex**: [NOT PROVIDED]", "Test: AST\nResult: 44 U/L"));
    expect(r.rows[0]).toMatchObject({ name: "AST", status: "unknown", statusReason: "needs_sex" });
  });

  it("admits tests it cannot classify", () => {
    expect(run(report(adult("Female"), "- **Serum Ferritin**: 25 ng/mL")).rows[0]).toMatchObject({ status: "unknown", statusReason: "not_classifiable" });
  });

  it("flags urgent thresholds (hit or pass)", () => {
    expect(run(report(adult("Female"), "- **Hemoglobin**: 6.5 g/dL")).rows[0].status).toBe("urgent");
    expect(run(report(adult("Male"), "- **Fasting Blood Sugar**: 350 mg/dL")).rows[0].status).toBe("urgent");
    expect(run(report(adult("Male"), "- **Platelet Count**: 40000 cells/mcL")).rows[0].status).toBe("urgent");
    expect(run(report(adult("Male"), "- **ALT**: 1000 U/L")).rows[0].status).toBe("urgent");
  });

  it("reads arrow-formatted urinalysis, including qualitative results", () => {
    const { rows } = run(report("* **Recorded Age**: 19\n* **Biological Sex**: Female", "* pH Level -> 5.5\n* Protein -> Negative"));
    expect(rows.map((r) => [r.name, r.status])).toEqual([
      ["pH Level", "within"],
      ["Protein", "within"],
    ]);
  });

  it("maps aliases (FBS, SGOT, PLT, WBC)", () => {
    const { rows } = run(report(adult("Female"), "- **FBS**: 85 mg/dL\n- **SGOT**: 22 U/L\n- **PLT**: 140000 cells/mcL\n- **WBC**: 12000 cells/mcL"));
    expect(rows.map((r) => r.status)).toEqual(["within", "within", "outside", "outside"]);
  });
});

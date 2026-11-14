/**
 * Generates SYNTHETIC lab reports for demos and tests. No real person's data.
 *   npx tsx scripts/make-samples.ts
 */
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Row = [name: string, value: string, unit: string, range: string, flag?: string];

const samples: { file: string; date: string; reg: string; rows: Row[] }[] = [
  {
    file: "sample-report-april.pdf",
    date: "12/04/2026",
    reg: "DL-2026-004127",
    rows: [
      ["Hemoglobin", "11.2", "g/dL", "12.0 - 16.0", "L"],
      ["RBC Count", "4.3", "x10^12/L", "4.0 - 5.2"],
      ["Hematocrit", "35.1", "%", "36.0 - 46.0", "L"],
      ["MCV", "79", "fL", "80 - 100", "L"],
      ["WBC Count", "7.1", "x10^9/L", "4.0 - 11.0"],
      ["Platelet Count", "245", "x10^9/L", "150 - 400"],
      ["Glucose Fasting", "96", "mg/dL", "70 - 100"],
      ["Serum Creatinine", "1.0", "mg/dL", "0.6 - 1.1"],
      ["HbA1c", "5.7", "%", "4.0 - 5.6", "H"],
    ],
  },
  {
    file: "sample-report-october.pdf",
    date: "28/10/2026",
    reg: "DL-2026-010954",
    rows: [
      ["Hemoglobin", "10.5", "g/dL", "12.0 - 16.0", "L"],
      ["RBC Count", "4.1", "x10^12/L", "4.0 - 5.2"],
      ["Hematocrit", "33.0", "%", "36.0 - 46.0", "L"],
      ["MCV", "76", "fL", "80 - 100", "L"],
      ["WBC Count", "8.4", "x10^9/L", "4.0 - 11.0"],
      ["Platelet Count", "262", "x10^9/L", "150 - 400"],
      ["Glucose Fasting", "104", "mg/dL", "70 - 100", "H"],
      ["Serum Creatinine", "1.3", "mg/dL", "0.6 - 1.1", "H"],
      ["Serum Urea", "38", "mg/dL", "15 - 45"],
      ["HbA1c", "6.1", "%", "4.0 - 5.6", "H"],
      ["Total Cholesterol", "212", "mg/dL", "< 200", "H"],
      ["Triglycerides", "148", "mg/dL", "< 150"],
      ["TSH", "2.4", "uIU/mL", "0.4 - 4.0"],
      ["Vitamin D", "14", "ng/mL", "30 - 100", "L"],
      ["Ferritin", "9", "ng/mL", "13 - 150", "L"],
    ],
  },
];

async function make(s: (typeof samples)[number]) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4 points
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.13, 0.2);
  const muted = rgb(0.4, 0.42, 0.48);
  const H = 842;
  const text = (t: string, x: number, yTop: number, size = 10, f = font, color = ink) =>
    page.drawText(t, { x, y: H - yTop - size, size, font: f, color });

  text("Demo Diagnostic Laboratory", 50, 40, 16, bold);
  text("SYNTHETIC SAMPLE REPORT - NOT A REAL PATIENT - FOR DEMONSTRATION ONLY", 50, 62, 8, font, rgb(0.6, 0.2, 0.2));
  text("Patient: Sample Patient", 50, 90);
  text("Age/Sex: 34 Years / Female", 330, 90);
  text(`Reg No: ${s.reg}`, 50, 106);
  text(`Report Date: ${s.date}`, 330, 106);
  text("Referred By: Self", 50, 122);
  page.drawLine({ start: { x: 50, y: H - 142 }, end: { x: 545, y: H - 142 }, thickness: 0.6, color: muted });

  const cols = { name: 50, value: 230, unit: 290, range: 380, flag: 500 };
  text("Test", cols.name, 152, 9, bold, muted);
  text("Result", cols.value, 152, 9, bold, muted);
  text("Unit", cols.unit, 152, 9, bold, muted);
  text("Reference Range", cols.range, 152, 9, bold, muted);
  text("Flag", cols.flag, 152, 9, bold, muted);

  let y = 176;
  for (const [name, value, unit, range, flag] of s.rows) {
    text(name, cols.name, y);
    text(value, cols.value, y, 10, flag ? bold : font);
    text(unit, cols.unit, y);
    text(range, cols.range, y);
    if (flag) text(flag, cols.flag, y, 10, bold);
    y += 22;
  }
  page.drawLine({ start: { x: 50, y: H - y - 6 }, end: { x: 545, y: H - y - 6 }, thickness: 0.6, color: muted });
  text("Reference ranges apply to adults and may vary by method. Results to be correlated clinically.", 50, y + 14, 8, font, muted);
  text("This is a synthetic document generated for software testing.", 50, y + 28, 8, font, muted);

  const out = path.resolve("public/samples", s.file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, await doc.save());
  console.log("wrote", out);
}

for (const s of samples) await make(s);

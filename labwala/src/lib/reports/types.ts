/** Positioned text extracted from a report page (top-left origin, page units). */
export type Box = [x: number, y: number, w: number, h: number];

export type LayoutItem = { str: string; box: Box };

export type LayoutLine = {
  text: string;
  items: LayoutItem[];
  box: Box;
  confidence?: number; // OCR confidence 0-100, absent for PDF text
};

export type PageLayout = {
  page: number; // 1-based
  width: number;
  height: number;
  lines: LayoutLine[];
};

export type ReportLayout = {
  method: "pdf_text" | "ocr";
  pages: PageLayout[];
};

export type ResultStatus = "within" | "outside" | "review" | "urgent" | "unknown";

export type ParsedResult = {
  testName: string;
  canonicalKey: string | null;
  valueText: string;
  valueNum: number | null;
  unit: string | null;
  refText: string | null;
  refLow: number | null;
  refHigh: number | null;
  labFlag: string | null;
  needsReview: boolean;
  reviewReason: string | null;
  page: number | null;
  box: Box | null;
  sourceLine: string;
};

export type ParsedReport = {
  labName: string | null;
  reportDate: string | null;
  results: ParsedResult[];
};

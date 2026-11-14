/**
 * SAMPLE family for demonstrations only (synthetic people, synthetic values).
 * Shown with a visible "Sample data" label until the real family feature (Phase 6) ships.
 * No diagnosis or risk score is derived from it.
 */
import type { Lang } from "@/lib/i18n/dictionaries";

type L = Record<Lang, string>;
export type DemoMember = {
  id: string;
  initials: string;
  name: L;
  relation: L;
  generation: 0 | 1 | 2; // 0 = grandparents, 1 = parents, 2 = children
  sharing: "summary" | "flagged" | "none" | "guardian";
  you?: boolean;
};

export const DEMO_MEMBERS: DemoMember[] = [
  { id: "nani", initials: "Z", generation: 0, sharing: "flagged", name: { en: "Zainab", ur: "زینب", pa: "زینب" }, relation: { en: "Mother", ur: "والدہ", pa: "ماں" } },
  { id: "abbu", initials: "R", generation: 0, sharing: "none", name: { en: "Rashid", ur: "راشد", pa: "راشد" }, relation: { en: "Father", ur: "والد", pa: "پیو" } },
  { id: "you", initials: "S", generation: 1, sharing: "summary", you: true, name: { en: "Sara (you)", ur: "سارہ (آپ)", pa: "سارہ (تسیں)" }, relation: { en: "You", ur: "آپ", pa: "تسیں" } },
  { id: "ahmed", initials: "A", generation: 1, sharing: "summary", name: { en: "Ahmed", ur: "احمد", pa: "احمد" }, relation: { en: "Husband", ur: "شوہر", pa: "گھر والا" } },
  { id: "bilal", initials: "B", generation: 2, sharing: "guardian", name: { en: "Bilal", ur: "بلال", pa: "بلال" }, relation: { en: "Son (12)", ur: "بیٹا (12)", pa: "پتر (12)" } },
];

/** Shared values (synthetic). Each series uses the range printed by that person's lab. */
export const DEMO_TRENDS = [
  {
    key: "hba1c",
    unit: "%",
    low: 4.0,
    high: 5.6,
    series: [
      { member: "nani", points: [["2025-11", 6.0], ["2026-03", 6.3], ["2026-08", 6.6]] },
      { member: "you", points: [["2025-12", 5.4], ["2026-04", 5.7], ["2026-10", 6.1]] },
    ],
  },
  {
    key: "hemoglobin",
    unit: "g/dL",
    low: 12.0,
    high: 16.0,
    series: [
      { member: "nani", points: [["2025-11", 11.8], ["2026-03", 11.6], ["2026-08", 11.9]] },
      { member: "you", points: [["2025-12", 11.9], ["2026-04", 11.2], ["2026-10", 10.5]] },
    ],
  },
] as const;

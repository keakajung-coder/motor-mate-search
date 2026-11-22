export const PLANNER_CARD_FIELDS = [
  ["customer", "ชื่อลูกค้า"], ["serial", "หมายเลขเครื่อง / รุ่น"],
  ["staff", "ช่าง"], ["seller", "ผู้ขาย"], ["job", "งานที่ไปทำ"],
  ["vehicle", "ทะเบียนรถ"], ["time", "เวลานัดหมาย"],
] as const;
export type PlannerCardField = typeof PLANNER_CARD_FIELDS[number][0];
export type PlannerCardFields = Record<PlannerCardField, boolean>;
export const DEFAULT_PLANNER_CARD_FIELDS: PlannerCardFields = {
  customer: true, serial: true, staff: true, seller: true, job: true, vehicle: true, time: true,
};

function shortenEach(value: string | null | undefined, maxChars: number): string {
  return (value ?? "").split(/[,/]+/).map(name => {
    const first = name.trim().split(/\s+/)[0] ?? "";
    const chars = Array.from(new Intl.Segmenter("th", { granularity: "grapheme" }).segment(first), part => part.segment);
    return chars.length > maxChars ? chars.slice(0, maxChars - 1).join("") + "…" : first;
  }).filter(Boolean).join(", ");
}

/** Display only: never write shortened names back to a job. */
export function shortPlannerName(value?: string | null): string {
  return shortenEach(value, 14);
}

/**
 * Technician list on planner cards: every assigned technician is shown,
 * each shortened tighter so several names fit compactly on the card.
 * Display only: never write shortened names back to a job.
 */
export function shortPlannerStaff(value?: string | null): string {
  return shortenEach(value, 10);
}
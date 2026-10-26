/** ตรรกะกระจายงวดเข้าบริการตามสัญญารายปี (pure function ทดสอบได้) */

const pad = (n: number) => String(n).padStart(2, "0");

export const THAI_DOW_NAMES = [
  "วันอาทิตย์",
  "วันจันทร์",
  "วันอังคาร",
  "วันพุธ",
  "วันพฤหัสบดี",
  "วันศุกร์",
  "วันเสาร์",
] as const;

export const THAI_MONTH_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
] as const;

export type SchedulePattern =
  | {
      type: "fixed_date";
      dayOfMonth: number; // 1 - 31
    }
  | {
      type: "relative_day";
      weekOfMonth: 1 | 2 | 3 | 4 | -1; // 1, 2, 3, 4 หรือ -1 (สัปดาห์สุดท้าย)
      dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=อาทิตย์, 1=จันทร์, ..., 6=เสาร์
    };

export type AutoScheduleRuleConfig = {
  startDate: string; // ISO yyyy-mm-dd
  visitsPerYear: number; // เช่น 4 ครั้ง/ปี
  pattern: SchedulePattern;
  defaultTime?: string | null;
  jobDetailPrefix?: string | null;
  partsNote?: string | null;
};

export type GeneratedVisitPreview = {
  visit_no: number;
  visit_date: string; // ISO yyyy-mm-dd
  visit_time?: string;
  dayOfWeek: number;
  dayOfWeekLabelTh: string; // เช่น "วันพุธ"
  cycleLabelTh: string; // เช่น "รอบเดือนที่ 1 (ม.ค. 2569)"
  job_detail?: string;
  parts_note?: string;
  status: "unscheduled";
};

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** บวกเดือนโดยไม่เลื่อนวันที่เกินสิ้นเดือน (31 ม.ค. + 1 เดือน → 28/29 ก.พ.) */
export function addMonthsClamped(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = (y ?? 0) * 12 + (m ?? 1) - 1 + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(ny, nm, 0).getDate();
  return `${ny}-${pad(nm)}-${pad(Math.min(d ?? 1, lastDay))}`;
}

/**
 * คำนวณหาวันที่สัมพันธ์ในเดือนที่กำหนด (เช่น สัปดาห์ที่ 2 วันพุธ หรือ สัปดาห์สุดท้ายวันศุกร์)
 */
export function calculateRelativeDate(
  year: number,
  month: number, // 1 - 12
  weekOfMonth: number, // 1..4 หรือ -1 (สัปดาห์สุดท้าย)
  dayOfWeek: number, // 0..6 (0=อาทิตย์)
): string {
  const daysInMonth = new Date(year, month, 0).getDate();

  if (weekOfMonth === -1) {
    // สัปดาห์สุดท้าย: เดินย้อนจากวันสุดท้ายของเดือน
    for (let day = daysInMonth; day >= 1; day--) {
      const d = new Date(year, month - 1, day);
      if (d.getDay() === dayOfWeek) {
        return `${year}-${pad(month)}-${pad(day)}`;
      }
    }
    return `${year}-${pad(month)}-${pad(daysInMonth)}`;
  }

  // สัปดาห์ที่ 1 - 4: หาวันแรกที่ตรงกับ dayOfWeek
  const firstDayDow = new Date(year, month - 1, 1).getDay();
  const daysUntilDow = (dayOfWeek - firstDayDow + 7) % 7;
  const firstOccurrence = 1 + daysUntilDow;
  const targetDay = firstOccurrence + (weekOfMonth - 1) * 7;

  // หากคำนวณแล้วเกินวันสุดท้ายของเดือน ให้ใช้วันที่ที่ตรงกันรอบก่อนหน้า
  const clampedDay = targetDay <= daysInMonth ? targetDay : targetDay - 7;
  return `${year}-${pad(month)}-${pad(Math.max(1, clampedDay))}`;
}

/**
 * คำนวณรันวันที่และซอยรอบเดือนอัตโนมัติทั้งสัญญาในคลิกเดียว (Auto-Schedule Rules)
 */
export function generateContractSchedule(config: AutoScheduleRuleConfig): GeneratedVisitPreview[] {
  const { startDate, visitsPerYear, pattern, defaultTime, jobDetailPrefix, partsNote } = config;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || visitsPerYear < 1) return [];

  const n = Math.min(Math.floor(visitsPerYear), 52);
  const [startY, startM] = startDate.split("-").map(Number);
  const previews: GeneratedVisitPreview[] = [];

  for (let i = 0; i < n; i++) {
    // คำนวณรอบเดือนที่ก้าวไปข้างหน้าตามสัดส่วน (เช่น 4 ครั้ง -> ก้าวทุก 3 เดือน)
    const monthStep = 12 / n;
    const monthOffset = Math.round(i * monthStep);
    const totalMonths = (startY ?? 0) * 12 + (startM ?? 1) - 1 + monthOffset;
    const targetYear = Math.floor(totalMonths / 12);
    const targetMonth = (totalMonths % 12) + 1; // 1-12

    let calculatedDate: string;
    if (pattern.type === "fixed_date") {
      const lastDay = new Date(targetYear, targetMonth, 0).getDate();
      const clampedDay = Math.min(Math.max(1, pattern.dayOfMonth), lastDay);
      calculatedDate = `${targetYear}-${pad(targetMonth)}-${pad(clampedDay)}`;
    } else {
      calculatedDate = calculateRelativeDate(
        targetYear,
        targetMonth,
        pattern.weekOfMonth,
        pattern.dayOfWeek,
      );
    }

    const dt = new Date(`${calculatedDate}T00:00:00`);
    const dow = dt.getDay();
    const thYear = targetYear + 543;
    const monthName = THAI_MONTH_SHORT[targetMonth - 1] ?? "";

    previews.push({
      visit_no: i + 1,
      visit_date: calculatedDate,
      visit_time: defaultTime || "",
      dayOfWeek: dow,
      dayOfWeekLabelTh: THAI_DOW_NAMES[dow] ?? "",
      cycleLabelTh: `งวดที่ ${i + 1} (${monthName} ${thYear})`,
      job_detail: jobDetailPrefix ? `${jobDetailPrefix} ครั้งที่ ${i + 1}` : `บริการตามสัญญารายปี ครั้งที่ ${i + 1}`,
      parts_note: partsNote || "",
      status: "unscheduled",
    });
  }

  return previews;
}

/**
 * กระจายงวด n ครั้งในรอบ 12 เดือน นับจากวันเริ่มสัญญา (เดิม)
 * เช่น start 2026-01-15, 4 ครั้ง → 15 ม.ค. / 15 เม.ย. / 15 ก.ค. / 15 ต.ค.
 * (ถ้ามากกว่า 12 ครั้ง จะกระจายแบบรายวันแทน เพื่อไม่ให้วันซ้ำกัน)
 */
export function spreadVisits(startDate: string, count: number): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || count < 1) return [];
  const n = Math.min(Math.floor(count), 52);
  if (n <= 12) {
    const step = 12 / n;
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(addMonthsClamped(startDate, Math.round(step * i)));
    return Array.from(new Set(out));
  }
  const base = new Date(`${startDate}T00:00:00`);
  const out = new Set<string>();
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + Math.round((365 / n) * i));
    out.add(toISODate(d));
  }
  return Array.from(out);
}

/** เลขที่ใบงานอัตโนมัติ (รูปแบบเดียวกับ WorkOrderDialog) */
export function autoContractJobNo(now = new Date()): string {
  return `JO-${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

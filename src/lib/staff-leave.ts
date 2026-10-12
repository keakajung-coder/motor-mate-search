export const LEAVE_PERIODS = ["full", "am", "pm"] as const;
export type LeavePeriod = typeof LEAVE_PERIODS[number];
export type StaffLeave = { id: string; staff_id: string | null; staff_name: string; leave_date: string; period: LeavePeriod };
export const LEAVE_LABELS: Record<LeavePeriod, string> = {
  full: "ลาเต็มวัน", am: "ลาครึ่งวันเช้า", pm: "ลาครึ่งวันบ่าย",
};
export const LEAVE_SHORT_LABELS: Record<LeavePeriod, string> = {
  full: "ทั้งวัน", am: "เช้า", pm: "บ่าย",
};
export function isLeavePeriod(value: unknown): value is LeavePeriod {
  return LEAVE_PERIODS.some((period) => period === value);
}
export function leaveInSession(period: LeavePeriod, session: "am" | "pm") {
  return period === "full" || period === session;
}
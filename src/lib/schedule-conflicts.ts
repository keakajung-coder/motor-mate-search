import { leaveInSession, type LeavePeriod } from "@/lib/staff-leave";

export type Session = "am" | "pm" | "full";
export type SlotJob = { id?: string | null; visit_date: string; visit_time?: string | null; staff_name?: string | null; vehicle_plate?: string | null; status?: string | null };
export type SlotLeave = { staff_name: string; leave_date: string; period: LeavePeriod };

const names = (v?: string | null) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const norm = (s: string) => s.toLowerCase();

/** ช่วงเวลาของงาน: ก่อน 12:00 = เช้า, ตั้งแต่ 12:00 = บ่าย, ไม่ระบุเวลา = ทั้งวัน */
export function sessionOf(time?: string | null): Session {
  const h = Number((time ?? "").slice(0, 2));
  if (!time || Number.isNaN(h)) return "full";
  return h < 12 ? "am" : "pm";
}
const overlaps = (a: Session, b: Session) => a === "full" || b === "full" || a === b;
const leaveHits = (period: LeavePeriod, s: Session) => s === "full" ? true : leaveInSession(period, s);

/**
 * คืนข้อความขัดแย้ง (ว่าง = บันทึกได้)
 * - ช่างลาในช่วงเวลานั้น → บล็อก
 * - ช่างคนเดียวกันอยู่คนละรถในช่วงเดียวกัน → บล็อก
 * - รถคันเดียวไปหลายงาน และช่างหลายคนขึ้นรถคันเดียวกัน → อนุญาต
 */
export function findScheduleConflicts(job: SlotJob, others: SlotJob[], leave: SlotLeave[]): string[] {
  const staff = names(job.staff_name);
  if (!job.visit_date || staff.length === 0) return [];
  const session = sessionOf(job.visit_time);
  const plates = new Set(names(job.vehicle_plate).map(norm));
  const out: string[] = [];
  for (const l of leave) {
    if (l.leave_date !== job.visit_date || !staff.some((s) => norm(s) === norm(l.staff_name))) continue;
    if (leaveHits(l.period, session)) out.push(`${l.staff_name} ${l.period === "full" ? "ลาเต็มวัน" : l.period === "am" ? "ลาครึ่งวันเช้า" : "ลาครึ่งวันบ่าย"}`);
  }
  for (const o of others) {
    if ((job.id && o.id === job.id) || o.visit_date !== job.visit_date || o.status === "cancelled") continue;
    if (!overlaps(session, sessionOf(o.visit_time))) continue;
    const otherPlates = names(o.vehicle_plate).map(norm);
    if (plates.size > 0 && otherPlates.some((p) => plates.has(p))) continue; // รถคันเดียวกัน ไปด้วยกันได้
    for (const s of names(o.staff_name)) {
      if (!staff.some((x) => norm(x) === norm(s))) continue;
      out.push(`${s} ถูกลงงานอื่นช่วงเดียวกัน${o.vehicle_plate ? ` กับรถ ${o.vehicle_plate}` : ""}${o.visit_time ? ` (${o.visit_time.slice(0, 5)})` : ""}`);
    }
  }
  return Array.from(new Set(out));
}

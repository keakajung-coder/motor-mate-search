import { findVehicleZoneConflicts, type ZoneJob } from "./vehicle-zone";

export type AgendaJob = ZoneJob & {
  id: string;
  visit_date: string;
  visit_time?: string | null;
  customer_name?: string | null;
  serial_number?: string | null;
  machine_label?: string | null;
  service_type?: string | null;
  job_detail?: string | null;
  staff_name?: string | null;
  sales_rep?: string | null;
  vehicle_plate?: string | null;
  status?: string | null;
};

export type AgendaViewer = { isAdmin: boolean; role: string | null; userName: string };

export const AGENDA_ALERT_HOUR = 8; // 08:00 Asia/Bangkok
export const AGENDA_REFRESH_MINUTE_BEFORE = 5; // silent refresh 5 min before each slot

/** Reminder slots (Bangkok minutes): 08:00 shows today, 15:30 shows tomorrow. */
export const AGENDA_SLOTS = [
  { key: "morning", at: 8 * 60, dayOffset: 0, title: "สรุปงานวันนี้", body: "เปิดดูงานวันนี้ไปไหนในแพลนเนอร์" },
  { key: "afternoon", at: 15 * 60 + 30, dayOffset: 1, title: "สรุปงานพรุ่งนี้", body: "เปิดดูงานพรุ่งนี้ไปไหนในแพลนเนอร์" },
] as const;
export type AgendaSlot = (typeof AGENDA_SLOTS)[number];

/** Latest slot whose time has passed today (or null before 08:00). */
export function dueAgendaSlot(mins: number): AgendaSlot | null {
  let hit: AgendaSlot | null = null;
  for (const s of AGENDA_SLOTS) if (mins >= s.at) hit = s;
  return hit;
}

/** Slot whose silent-refresh window (5 min before) is active. */
export function refreshAgendaSlot(mins: number): AgendaSlot | null {
  return AGENDA_SLOTS.find((s) => mins >= s.at - AGENDA_REFRESH_MINUTE_BEFORE && mins < s.at + 60) ?? null;
}

const names = (v?: string | null) => (v ?? "").split(/[,/]+/).map((s) => s.trim()).filter(Boolean);
const norm = (s: string) => s.trim().toLowerCase();

/** Today's date (YYYY-MM-DD) in Bangkok time, independent of device timezone. */
export function bangkokToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

/** Minutes since Bangkok midnight. */
export function bangkokMinutes(now: Date = new Date()): number {
  const d = new Date(now.getTime() + 7 * 3600_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whether a job belongs to the viewer: admins/general see all; tech/seller see jobs naming them. */
export function isAgendaJobForViewer(job: AgendaJob, viewer: AgendaViewer): boolean {
  if (viewer.isAdmin || !viewer.role || viewer.role === "admin" || viewer.role === "general") return true;
  const me = norm(viewer.userName);
  if (!me) return false;
  const pool = viewer.role === "seller" ? names(job.sales_rep) : names(job.staff_name);
  return pool.some((n) => norm(n) === me);
}

/** Every job booked on the date (no status/queue filtering), sorted by time. */
export function agendaForDate(jobs: AgendaJob[], date: string, viewer: AgendaViewer, techFilter = ""): AgendaJob[] {
  const tf = norm(techFilter);
  return jobs
    .filter((j) => j.visit_date === date)
    .filter((j) => isAgendaJobForViewer(j, viewer))
    .filter((j) => !tf || names(j.staff_name).some((n) => norm(n) === tf))
    .sort((a, b) => (a.visit_time || "99:99").localeCompare(b.visit_time || "99:99") || (a.customer_name ?? "").localeCompare(b.customer_name ?? "", "th"));
}

export function agendaTechnicians(jobs: AgendaJob[], date: string): string[] {
  return [...new Set(jobs.filter((j) => j.visit_date === date).flatMap((j) => names(j.staff_name)))].sort((a, b) => a.localeCompare(b, "th"));
}

export function agendaZoneWarning(job: AgendaJob, all: AgendaJob[]): string {
  return findVehicleZoneConflicts(job, all)
    .map((c) => `รถ ${c.plate} ไป ${c.province} และ ${c.otherProvinces.join(", ")} วันเดียวกัน`)
    .join("; ");
}

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export function thaiDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${TH_MONTHS[(m ?? 1) - 1]} ${(y ?? 0) + 543}`;
}

/** LINE-ready text listing every job with seller included. */
export function formatAgendaLine(date: string, jobs: AgendaJob[], all: AgendaJob[]): string {
  const head = `📋 สรุปงานวันที่ ${thaiDateLabel(date)} (${jobs.length} งาน)`;
  if (!jobs.length) return `${head}\nไม่มีงานนัดหมาย`;
  const lines = jobs.map((j, i) => {
    const zone = agendaZoneWarning(j, all);
    return [
      `${i + 1}. ${j.visit_time ? j.visit_time.slice(0, 5) : "ไม่ระบุเวลา"} ${j.customer_name || "-"}`,
      `   เครื่อง: ${j.serial_number || j.machine_label || "-"}`,
      `   งาน: ${j.service_type || j.job_detail || "-"}`,
      `   ช่าง: ${names(j.staff_name).join(", ") || "-"}`,
      `   ผู้ขาย: ${j.sales_rep?.trim() || "-"}`,
      `   ทะเบียนรถ: ${j.vehicle_plate?.trim() || "-"}`,
      zone ? `   ⚠️ ข้ามโซน: ${zone}` : "",
    ].filter(Boolean).join("\n");
  });
  return [head, ...lines].join("\n\n");
}

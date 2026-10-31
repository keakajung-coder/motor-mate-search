import { extractZoneInfo } from "./geo-zone";
import type { CustomerLocation } from "./customer-location";

export type ZoneJob = { id?: string | null; work_order_id?: string | null; visit_date?: string | null; vehicle_plate?: string | null; customer_address?: string | null; customer_name?: string | null; cust_id?: string | null; serial_number?: string | null; province?: string | null; customer_location?: CustomerLocation | null; status?: string | null };
export type VehicleZoneConflict = { plate: string; province: string; otherProvinces: string[] };
export type ZoneReview = { signature: string; conflicts: VehicleZoneConflict[]; vehicles: string[] };
export const zonePlates = (value?: string | null) => [...new Set((value ?? "").split(/[,/]+/).map(s => s.trim()).filter(Boolean))];
const normPlate = (s: string) => s.replace(/\s+/g, "").toLowerCase();
export function jobProvince(job: ZoneJob) {
  const p = extractZoneInfo(job.customer_address, job.customer_location?.province || job.province).province;
  return p === "ไม่ระบุจังหวัด" ? "" : p.replace(/^(จังหวัด|จ\.)\s*/, "").replace(/^กรุงเทพมหานคร$/, "กรุงเทพฯ").replace(/^อยุธยา$/, "พระนครศรีอยุธยา");
}
export function findVehicleZoneConflicts(job: ZoneJob, others: ZoneJob[]): VehicleZoneConflict[] {
  const province = jobProvince(job);
  if (!job.visit_date || !province) return [];
  return zonePlates(job.vehicle_plate).flatMap(plate => {
    const otherProvinces = [...new Set(others.filter(o => o.visit_date === job.visit_date && !(job.id && o.id === job.id) && !(job.work_order_id && (o.id === job.work_order_id || o.work_order_id === job.work_order_id)) && !["cancelled", "canceled"].includes(o.status ?? "") && zonePlates(o.vehicle_plate).some(p => normPlate(p) === normPlate(plate))).map(jobProvince).filter(p => p && p !== province))].sort();
    return otherProvinces.length ? [{ plate, province, otherProvinces }] : [];
  });
}
export function zoneSignature(job: ZoneJob, conflicts: VehicleZoneConflict[]) {
  return JSON.stringify([job.visit_date, zonePlates(job.vehicle_plate).map(normPlate).sort(), jobProvince(job), conflicts]);
}
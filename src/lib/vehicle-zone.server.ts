import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { findVehicleZoneConflicts, jobProvince, zoneSignature, type ZoneJob, type ZoneReview } from "./vehicle-zone";

export async function reviewVehicleZone(db: SupabaseClient<Database>, job: ZoneJob): Promise<ZoneReview> {
  if (!job.visit_date || !job.vehicle_plate?.trim()) return { conflicts: [], signature: "", vehicles: [] };
  const [a, w, c, m, v] = await Promise.all([
    db.from("appointments").select("id,work_order_id,visit_date,vehicle_plate,customer_address,customer_name,cust_id,serial_number,status").eq("visit_date", job.visit_date),
    db.from("work_orders").select("id,visit_date,vehicle_plate,customer_address,customer_name,cust_id,serial_number,status").eq("visit_date", job.visit_date),
    db.from("customers").select("name,cust_id,province"),
    db.from("machine_units").select("serial_number,province"),
    db.from("vehicles").select("plate").eq("active", true),
  ]);
  for (const result of [a, w, c, m, v]) if (result.error) throw new Error("ตรวจจังหวัดของงานไม่สำเร็จ กรุณาลองใหม่");
  const enrich = (j: ZoneJob): ZoneJob => ({ ...j, province: jobProvince(j) || m.data?.find(r => r.serial_number === j.serial_number)?.province || c.data?.find(r => j.cust_id ? r.cust_id === j.cust_id : r.name === j.customer_name)?.province || j.province });
  const target = enrich(job);
  const appointments = a.data ?? [];
  const others = [...appointments, ...(w.data ?? []).filter(r => !appointments.some(x => x.work_order_id === r.id))].map(enrich);
  const conflicts = findVehicleZoneConflicts(target, others);
  return { conflicts, signature: zoneSignature(target, conflicts), vehicles: (v.data ?? []).map(r => r.plate) };
}
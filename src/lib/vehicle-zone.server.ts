import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { findVehicleZoneConflicts, zoneSignature, type ZoneJob, type ZoneReview } from "./vehicle-zone";

export async function reviewVehicleZone(db: SupabaseClient<Database>, job: ZoneJob): Promise<ZoneReview> {
  if (!job.visit_date || !job.vehicle_plate?.trim()) return { conflicts: [], signature: "", vehicles: [] };
  const [a, w, v] = await Promise.all([
    db.from("appointments").select("id,work_order_id,visit_date,vehicle_plate,customer_address,customer_location,customer_name,cust_id,serial_number,status").eq("visit_date", job.visit_date),
    db.from("work_orders").select("id,visit_date,vehicle_plate,customer_address,customer_location,customer_name,cust_id,serial_number,status").eq("visit_date", job.visit_date),
    db.from("vehicles").select("plate").eq("active", true),
  ]);
  for (const result of [a, w, v]) if (result.error) throw new Error("ตรวจจังหวัดของงานไม่สำเร็จ กรุณาลองใหม่");
  const appointments = a.data ?? [];
  // Use the site snapshot stored on the job. Never substitute the customer's HQ or a machine's fallback province.
  const savedTarget = job.id ? appointments.find(row => row.id === job.id) : undefined;
  const target = { ...savedTarget, ...job } as ZoneJob;
  const others = [...appointments, ...(w.data ?? []).filter(row => !appointments.some(x => x.work_order_id === row.id))] as ZoneJob[];
  const conflicts = findVehicleZoneConflicts(target, others);
  return { conflicts, signature: zoneSignature(target, conflicts), vehicles: (v.data ?? []).map(row => row.plate) };
}

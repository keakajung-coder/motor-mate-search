import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { reviewVehicleZone } from "./vehicle-zone.server";

function mockDatabase(rows: { appointments?: unknown[]; work_orders?: unknown[] }) {
  return {
    from(table: string) {
      if (table === "customers" || table === "machine_units") throw new Error("must not infer a site from customer or machine fallback data");
      return {
        select: () => ({
          eq: async () => ({
            data: table === "appointments" ? rows.appointments ?? [] : table === "work_orders" ? rows.work_orders ?? [] : [],
            error: null,
          }),
        }),
      };
    },
  } as unknown as SupabaseClient<Database>;
}

test("saved job-site address wins over customer identity during server review", async () => {
  const target = { id: "new", visit_date: "2026-11-26", vehicle_plate: "กข 1234", customer_name: "บริษัท สำนักงานใหญ่กรุงเทพ", customer_address: "หน้างาน จ.ระยอง" };
  const other = { id: "old", visit_date: "2026-11-26", vehicle_plate: "กข 1234", customer_address: "จ.ชลบุรี" };
  const review = await reviewVehicleZone(mockDatabase({ appointments: [target, other] }), {
    id: target.id,
    visit_date: target.visit_date,
    vehicle_plate: target.vehicle_plate,
    customer_name: target.customer_name,
  });
  assert.deepEqual(review.conflicts, [{ plate: "กข 1234", province: "ระยอง", otherProvinces: ["ชลบุรี"] }]);
});

test("unknown job site stays unknown instead of borrowing customer or machine province", async () => {
  const other = { id: "old", visit_date: "2026-11-26", vehicle_plate: "กข 1234", customer_address: "จ.ชลบุรี" };
  const review = await reviewVehicleZone(mockDatabase({ appointments: [other] }), {
    id: "new",
    visit_date: "2026-11-26",
    vehicle_plate: "กข 1234",
    customer_name: "บริษัท สำนักงานใหญ่กรุงเทพ",
    serial_number: "SN-HQ-1",
  });
  assert.deepEqual(review.conflicts, []);
});

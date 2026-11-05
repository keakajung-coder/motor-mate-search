import { queryOptions } from "@tanstack/react-query";
import { supabase } from "./data-client";
import type { SummaryJob, SummaryMachine } from "./weekly-summary";

async function readAll(table: "work_orders" | "appointments" | "machine_units", columns: string) {
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from(table).select(columns).order("id").range(offset, offset + 499);
    if (error) throw new Error(`โหลดข้อมูลรายงานไม่สำเร็จ: ${error.message}`);
    const batch = data ?? []; rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}
export const weeklySummaryQuery = queryOptions({
  queryKey: ["weekly-summary"], staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true,
  queryFn: async () => {
    const columns = "id,customer_name,job_detail,staff_name,status,visit_date,created_at,serial_number";
    const [orders, appointments, machines] = await Promise.all([
      readAll("work_orders", columns), readAll("appointments", `${columns},work_order_id,quotation_required`), readAll("machine_units", "id,status"),
    ]);
    return { orders: orders as SummaryJob[], appointments: appointments as SummaryJob[], machines: machines as SummaryMachine[] };
  },
});
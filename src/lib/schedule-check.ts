import { supabase } from "@/lib/data-client";
import { storedAdminCode } from "@/lib/access";
import { staffLeaveRequest } from "@/lib/staff-leave.functions";
import { isLeavePeriod } from "@/lib/staff-leave";
import { findScheduleConflicts, type SlotJob } from "@/lib/schedule-conflicts";

/** โหลดงานวันเดียวกันและวันลา แล้วตรวจความขัดแย้ง */
export async function checkScheduleConflicts(job: SlotJob): Promise<string[]> {
  if (!job.visit_date || !job.staff_name?.trim()) return [];
  const code = storedAdminCode() || localStorage.getItem("pc_viewer") || "";
  const [{ data: others }, leave] = await Promise.all([
    supabase.from("appointments").select("id,visit_date,visit_time,staff_name,vehicle_plate,status").eq("visit_date", job.visit_date),
    staffLeaveRequest({ data: { code, action: "list" } }).then((r) => r.rows).catch(() => []),
  ]);
  const rows = leave.filter((r) => r.leave_date === job.visit_date && isLeavePeriod(r.period)).map((r) => ({ staff_name: r.staff_name, leave_date: r.leave_date, period: r.period as "full" | "am" | "pm" }));
  return findScheduleConflicts(job, others ?? [], rows);
}

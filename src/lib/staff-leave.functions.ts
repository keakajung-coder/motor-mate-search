import { createServerFn } from "@tanstack/react-start";
import { isLeavePeriod, type LeavePeriod } from "@/lib/staff-leave";

type Request = { code: string; action: "list" | "save" | "delete"; staffId?: string; date?: string; period?: LeavePeriod; id?: string };
export const staffLeaveRequest = createServerFn({ method: "POST" })
  .inputValidator((input: Request) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAccess } = await import("./access-session.server");
    await requireAccess(data.action === "list" ? "viewer" : "admin");
    if (data.action === "list") {
      const [{ data: rows, error }, { data: staff, error: staffError }] = await Promise.all([
        supabaseAdmin.from("staff_leave").select("id,staff_id,staff_name,leave_date,period").order("leave_date"),
        supabaseAdmin.from("service_staff").select("id,name").order("name"),
      ]);
      if (error || staffError) throw new Error("โหลดข้อมูลวันลาไม่สำเร็จ");
      return { rows: (rows ?? []).map((row) => ({ ...row, staff_name: staff?.find((s) => s.id === row.staff_id)?.name ?? row.staff_name })), staff: staff ?? [] };
    }
    if (data.action === "delete") {
      if (!data.id) throw new Error("กรุณาเลือกวันลา");
      const { error } = await supabaseAdmin.from("staff_leave").delete().eq("id", data.id);
      if (error) throw new Error("ยกเลิกวันลาไม่สำเร็จ");
      return { rows: [], staff: [] };
    }
    if (data.action !== "save" || !data.staffId || !data.date || !isLeavePeriod(data.period)) throw new Error("กรุณาเลือกพนักงาน วันที่ และช่วงการลา");
    const date = new Date(`${data.date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== data.date) throw new Error("วันที่ไม่ถูกต้อง");
    const { data: staff, error: staffError } = await supabaseAdmin.from("service_staff").select("id,name").eq("id", data.staffId).single();
    if (staffError || !staff) throw new Error("ไม่พบพนักงานในระบบ");
    const { error } = await supabaseAdmin.from("staff_leave").upsert({ staff_id: staff.id, staff_name: staff.name, leave_date: data.date, period: data.period }, { onConflict: "staff_id,leave_date" });
    if (error) throw new Error("บันทึกวันลาไม่สำเร็จ");
    return { rows: [], staff: [] };
  });
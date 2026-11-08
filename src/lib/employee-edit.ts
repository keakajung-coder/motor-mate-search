import { supabase } from "@/lib/data-client";
import { editEngineerRecords } from "./employee-records";
import type { Employee } from "./employee-selection";

/** All writes use the gateway's verified admin session. */
export async function editEmployee(employee: Employee, input: Omit<Employee, "id">): Promise<Employee> {
  const name = input.name.trim();
  if (!name) throw new Error("กรุณาระบุชื่อ-นามสกุล");
  const fields = { name, phone: input.phone.trim() || null, position: input.position.trim() || null, avatar_url: input.avatar || null };
  const sourceId = employee.id.slice(employee.department.length + 1);
  let id = employee.id;
  if (employee.department === "project") {
    const { data, error } = await supabase.from("app_settings").select("id, value").eq("key", "engineers").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("ไม่พบรายชื่อวิศวกร");
    const records: unknown = JSON.parse(data.value ?? "[]");
    if (!Array.isArray(records)) throw new Error("รูปแบบรายชื่อวิศวกรไม่ถูกต้อง");
    const next = editEngineerRecords(records, sourceId, employee.name, fields);
    const result = await supabase.from("app_settings").update({ value: JSON.stringify(next) }).eq("id", data.id).select("id");
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.length) throw new Error("บันทึกพนักงานไม่สำเร็จ");
  } else {
    const table = employee.department === "sales" ? "sales_contacts" : "service_staff";
    const isLegacy = employee.department === "sales" && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(sourceId);
    if (isLegacy) {
      const result = await supabase.from("sales_contacts").insert({ ...fields, kind: "vendor", active: true }).select("id").single();
      if (result.error) throw new Error(result.error.message);
      if (!result.data) throw new Error("บันทึกพนักงานไม่สำเร็จ");
      id = `sales:${result.data.id}`;
      // Retire the old fallback name durably when the legacy seller is renamed.
      if (name !== employee.name) {
        const marker = await supabase.from("sales_contacts").insert({ name: employee.name, kind: "vendor", active: false });
        if (marker.error) throw new Error(marker.error.message);
      }
    } else {
      const result = await supabase.from(table).update(fields).eq("id", sourceId).eq("active", true).select("id");
      if (result.error) throw new Error(result.error.message);
      if (!result.data?.length) throw new Error("ไม่พบพนักงานที่ต้องการแก้ไข กรุณารีเฟรชรายชื่อ");
    }
  }
  return { ...input, id, name, phone: fields.phone ?? "", department: employee.department };
}
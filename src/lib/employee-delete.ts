import { supabase } from "@/lib/data-client";
import { deactivateEngineerRecords } from "./employee-records";
import type { Employee } from "./employee-selection";

/** The existing gateway revalidates admin permissions for each update. */
export async function deleteEmployee(employee: Employee) {
  if (employee.department === "service") {
    const { data, error } = await supabase.from("service_staff").update({ active: false }).eq("id", employee.id.slice("service:".length)).select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("ไม่พบพนักงานที่ต้องการลบ");
  } else if (employee.department === "sales") {
    // Also covers legacy option-only sellers; inactive contacts suppress stale fallback names.
    const { data, error } = await supabase.from("sales_contacts").select("id, name");
    if (error) throw new Error(error.message);
    const matches = (data ?? []).filter(row => row.name.trim().toLocaleLowerCase() === employee.name.trim().toLocaleLowerCase());
    if (matches.length) {
      const { error: updateError } = await supabase.from("sales_contacts").update({ active: false }).in("id", matches.map(row => row.id));
      if (updateError) throw new Error(updateError.message);
    } else {
      // Durable inactive marker also suppresses stale legacy options after reload.
      const { error: insertError } = await supabase.from("sales_contacts").insert({ kind: "vendor", name: employee.name, active: false });
      if (insertError) throw new Error(insertError.message);
    }
  } else {
    const { data, error } = await supabase.from("app_settings").select("id, value").eq("key", "engineers").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("ไม่พบรายชื่อวิศวกรที่ต้องการลบ");
    const records: unknown = JSON.parse(data.value ?? "[]");
    if (!Array.isArray(records)) throw new Error("รูปแบบรายชื่อวิศวกรไม่ถูกต้อง");
    const next = deactivateEngineerRecords(records, employee.id.slice("project:".length), employee.name);
    const { error: updateError } = await supabase.from("app_settings").update({ value: JSON.stringify(next) }).eq("id", data.id);
    if (updateError) throw new Error(updateError.message);
  }
}
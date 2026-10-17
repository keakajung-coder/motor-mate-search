import { supabase } from "@/lib/data-client";
import { sendUserAlert } from "@/lib/notify.functions";
import { contactText, loadAllContacts } from "@/lib/contact";

/** สวิตช์ส่วนกลาง: ส่ง LINE ให้เซลล์และช่างอัตโนมัติเมื่อแอดมินอนุมัติงาน */
const AUTO_KEY = "auto_job_alert";

export async function loadAutoJobAlert(): Promise<boolean> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", AUTO_KEY).maybeSingle();
  return (data?.value ?? "1") === "1";
}

export async function saveAutoJobAlert(on: boolean) {
  const value = on ? "1" : "0";
  const { data } = await supabase.from("app_settings").select("id").eq("key", AUTO_KEY).maybeSingle();
  if (data?.id) await supabase.from("app_settings").update({ value }).eq("id", data.id);
  else await supabase.from("app_settings").insert({ key: AUTO_KEY, value });
}

const names = (value?: string | null) =>
  String(value ?? "")
    .split(/[,/]/)
    .map((s) => s.trim())
    .filter(Boolean);

export type JobAlertInput = {
  customer_name?: string | null;
  customer_address?: string | null;
  serial_number?: string | null;
  customer_sn?: string | null;
  machine_label?: string | null;
  job_detail?: string | null;
  visit_date?: string | null;
  visit_time?: string | null;
  staff_name?: string | null;
  sales_rep?: string | null;
  vehicle_plate?: string | null;
};

export function jobAlertText(o: JobAlertInput) {
  return [
    `ลูกค้า: ${o.customer_name ?? "-"}`,
    o.customer_address && `ที่อยู่: ${o.customer_address}`,
    o.machine_label && `เครื่อง: ${o.machine_label}`,
    o.serial_number && `S/N: ${o.serial_number}`,
    o.customer_sn && `S/N ลูกค้า: ${o.customer_sn}`,
    o.job_detail && `งาน: ${o.job_detail}`,
    (o.visit_date || o.visit_time) && `นัดหมาย: ${[o.visit_date, o.visit_time].filter(Boolean).join(" ")}`,
    o.staff_name && `ช่าง: ${o.staff_name}`,
    o.sales_rep && `เซลล์/ผู้ขาย: ${o.sales_rep}`,
    o.vehicle_plate && `รถ: ${o.vehicle_plate}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * ส่งแจ้งเตือน LINE ให้เซลล์/ผู้ขาย และช่างที่รับงาน พร้อมแนบข้อมูลผู้ติดต่อของทีม
 * คืนค่าจำนวนปลายทางที่ส่งได้
 */
export async function sendJobApprovalAlert(order: JobAlertInput) {
  try {
    const targetNames = [...names(order.staff_name), ...names(order.sales_rep)];
    if (targetNames.length === 0) return 0;
    const contacts = await loadAllContacts();
    const picked = contacts.filter((c) => targetNames.some((n) => n.toLowerCase() === c.name.toLowerCase()));
    const ids = picked.map((c) => c.line_id ?? "").filter(Boolean);
    if (ids.length === 0) return 0;
    const body = [jobAlertText(order), "", contactText(picked, "ผู้ติดต่อในงานนี้")].join("\n");
    await sendUserAlert({
      data: {
        lineIds: ids,
        title: `อนุมัติงานแล้ว: ${order.customer_name ?? ""}`.trim(),
        body,
        link: "/planner",
      },
    });
    return ids.length;
  } catch {
    return 0;
  }
}

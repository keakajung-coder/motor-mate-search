import { supabase } from "@/lib/data-client";
import { sendUserAlert } from "@/lib/notify.functions";

/** สวิตช์ส่วนกลาง: ส่ง LINE ให้ช่างอัตโนมัติเมื่อแอดมินอนุมัติปัญหา/อาการเสีย */
const AUTO_KEY = "auto_issue_alert";

export async function loadAutoIssueAlert(): Promise<boolean> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", AUTO_KEY).maybeSingle();
  return (data?.value ?? "1") === "1";
}

export async function saveAutoIssueAlert(on: boolean) {
  const value = on ? "1" : "0";
  const { data } = await supabase.from("app_settings").select("id").eq("key", AUTO_KEY).maybeSingle();
  if (data?.id) await supabase.from("app_settings").update({ value }).eq("id", data.id);
  else await supabase.from("app_settings").insert({ key: AUTO_KEY, value });
}

/** ส่งคำตอบปัญหาเข้า LINE ให้ช่างทุกคนที่ผูก LINE ไว้ คืนจำนวนที่ส่งได้ */
export async function sendIssueApprovalAlert(i: { title: string; causes?: string; check_steps?: string; fix_steps?: string }) {
  try {
    const { data } = await supabase.from("service_staff").select("line_id").eq("active", true).not("line_id", "is", null);
    const ids = (data ?? []).map((r) => r.line_id ?? "").filter(Boolean);
    if (ids.length === 0) return 0;
    const body = [
      i.causes && `สาเหตุ: ${i.causes}`,
      i.check_steps && `วิธีตรวจสอบ:\n${i.check_steps}`,
      i.fix_steps && `วิธีแก้ไข:\n${i.fix_steps}`,
    ].filter(Boolean).join("\n\n");
    const res = await sendUserAlert({ data: { lineIds: ids, title: `อนุมัติคำตอบปัญหาแล้ว: ${i.title}`, body } });
    return res.sent;
  } catch {
    return 0;
  }
}

import { supabase } from "@/integrations/supabase/client";
import { sendUserAlert } from "@/lib/notify.functions";

/** รหัสผู้ใช้ LINE เชิงเทคนิค (U…/C…/R…) ใช้ส่งแจ้งเตือนเท่านั้น ไม่ต้องแสดงในหน้าโปรไฟล์ */
export function isTechnicalLineId(value?: string | null) {
  return /^[UCR][0-9a-f]{20,}$/i.test(String(value ?? "").trim());
}

/** ค่าที่แสดงได้ในโปรไฟล์ (ซ่อนรหัสเชิงเทคนิค) */
export function visibleLineId(value?: string | null) {
  const v = String(value ?? "").trim();
  return isTechnicalLineId(v) ? "" : v;
}

export function isPhoneLike(value?: string | null) {
  return /^[0-9+\-\s()]{6,}$/.test(String(value ?? "").trim());
}

export function telHref(phone?: string | null) {
  const v = String(phone ?? "").replace(/[^\d+]/g, "");
  return v ? `tel:${v}` : "";
}

/** ลิงก์เปิดแชท LINE จาก LINE ID แบบง่าย (@official หรือ id ส่วนตัว) */
export function lineHref(lineId?: string | null) {
  const v = visibleLineId(lineId);
  if (!v) return "";
  if (isPhoneLike(v)) return "";
  if (v.startsWith("http")) return v;
  if (v.startsWith("@")) return `https://line.me/R/ti/p/${encodeURIComponent(v)}`;
  return `https://line.me/ti/p/~${encodeURIComponent(v)}`;
}

/** ลิงก์แชร์ข้อความผ่านแอป LINE */
export function lineShareHref(text: string) {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`;
}

export type ContactRow = {
  id: string;
  name: string;
  phone: string | null;
  line_contact: string | null;
  line_id: string | null;
};

export async function loadStaffContacts(): Promise<ContactRow[]> {
  const { data } = await supabase
    .from("service_staff")
    .select("id, name, phone, line_contact, line_id")
    .order("name");
  return (data ?? []) as ContactRow[];
}

export function contactText(rows: ContactRow[], heading = "ข้อมูลผู้ติดต่อ (ช่าง/ผู้ให้บริการ)") {
  const body = rows.map((r) => {
    const parts = [`• ${r.name}`];
    if (r.phone) parts.push(`โทร ${r.phone}`);
    const line = visibleLineId(r.line_contact) || visibleLineId(r.line_id);
    if (line) parts.push(`LINE ${line}`);
    return parts.join(" | ");
  });
  return [heading, ...body].join("\n");
}

const AUTO_KEY = "contact_auto_share";

export function autoShareEnabled() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTO_KEY) === "1";
}

export function setAutoShare(on: boolean) {
  localStorage.setItem(AUTO_KEY, on ? "1" : "0");
}

/**
 * ส่งข้อมูลผู้ติดต่อ (ชื่อ / เบอร์ / LINE ID) ของช่างที่เลือก เข้า LINE ของลูกค้าและช่าง
 */
export async function shareContacts(input: {
  staffNames: string[];
  customerName?: string | null;
  title: string;
}) {
  try {
    const names = input.staffNames.map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) return false;
    const rows = (await loadStaffContacts()).filter((r) => names.includes(r.name));
    if (rows.length === 0) return false;

    const ids = rows.map((r) => r.line_id ?? "").filter(Boolean);
    if (input.customerName?.trim()) {
      const { data } = await supabase
        .from("customers")
        .select("line_id")
        .eq("name", input.customerName.trim())
        .limit(1);
      if (data?.[0]?.line_id) ids.push(data[0].line_id);
    }
    if (ids.length === 0) return false;
    await sendUserAlert({ data: { lineIds: ids, title: input.title, body: contactText(rows), link: "" } });
    return true;
  } catch {
    return false;
  }
}

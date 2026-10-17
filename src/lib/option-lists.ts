import { supabase } from "@/lib/data-client";

/** รายการตัวเลือกที่ผู้ใช้เพิ่มเอง (ผู้ขาย / สถานะ) เก็บใน app_settings */
export type OptionListKey = "sellers" | "statuses";

export async function loadOptionList(key: OptionListKey): Promise<string[]> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (!data?.value) return [];
  try {
    const arr = JSON.parse(data.value);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export async function saveOptionList(key: OptionListKey, list: string[]) {
  const value = JSON.stringify(Array.from(new Set(list.map((s) => s.trim()).filter(Boolean))));
  const { data } = await supabase.from("app_settings").select("id").eq("key", key).maybeSingle();
  if (data?.id) {
    await supabase.from("app_settings").update({ value }).eq("id", data.id);
  } else {
    await supabase.from("app_settings").insert({ key, value });
  }
  // แจ้งทุกส่วนที่ใช้รายการนี้ให้โหลดใหม่ทันที (เพิ่ม/แก้ไข/ลบ → dropdown ไม่ค้างชื่อเดิม)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("option-list-changed", { detail: { key } }));
    if (key === "sellers") window.dispatchEvent(new Event("sales-contacts-changed"));
  }
}

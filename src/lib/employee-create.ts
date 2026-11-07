import { supabase } from "@/lib/data-client";
import type { Employee } from "./employee-selection";

export async function createEmployee(input: Omit<Employee, "id">): Promise<Employee> {
  const name = input.name.trim();
  if (!name) throw new Error("กรุณาระบุชื่อ-นามสกุล");
  const fields = { name, phone: input.phone.trim() || null, position: input.position.trim() || null, avatar_url: input.avatar || null, active: true };
  let id: string;
  if (input.department === "project") {
    const { data, error } = await supabase.from("app_settings").select("id, value").eq("key", "engineers").maybeSingle();
    if (error) throw new Error(error.message);
    const records: unknown = JSON.parse(data?.value ?? "[]");
    if (!Array.isArray(records)) throw new Error("รูปแบบรายชื่อวิศวกรไม่ถูกต้อง");
    id = crypto.randomUUID();
    const value = JSON.stringify([...records, { ...fields, id }]);
    const result = data ? await supabase.from("app_settings").update({ value }).eq("id", data.id).select("id") : await supabase.from("app_settings").insert({ key: "engineers", value }).select("id");
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.length) throw new Error("บันทึกพนักงานไม่สำเร็จ");
  } else {
    const result = input.department === "sales"
      ? await supabase.from("sales_contacts").insert({ ...fields, kind: "vendor" }).select("id").single()
      : await supabase.from("service_staff").insert(fields).select("id").single();
    if (result.error) throw new Error(result.error.message);
    if (!result.data) throw new Error("บันทึกพนักงานไม่สำเร็จ");
    id = result.data.id;
  }
  return { ...input, name, id: `${input.department}:${id}` };
}

export async function uploadEmployeePhoto(file: File): Promise<string> {
  const { compressImage } = await import("./image-compress");
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("เลือกไฟล์ JPG, PNG หรือ WebP");
  const compressed = await compressImage(file, { maxSize: 600, quality: 0.8 });
  if (compressed.size > 2 * 1024 * 1024) throw new Error("รูปหลังย่อต้องไม่เกิน 2 MB");
  const path = `${crypto.randomUUID()}.${compressed.type === "image/png" ? "png" : compressed.type === "image/webp" ? "webp" : "jpg"}`;
  const { error } = await supabase.storage.from("employee-photos").upload(path, compressed, { contentType: compressed.type, upsert: false });
  if (error) throw new Error(error.message);
  return `/api/data/storage/v1/object/authenticated/employee-photos/${path}`;
}
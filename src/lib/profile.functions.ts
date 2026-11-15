import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const selectProfile = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().max(250).nullable() }).parse(input))
  .handler(async ({ data }) => {
    const { requireAccess, accessSession } = await import("./access-session.server");
    await requireAccess();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const session = await accessSession();
    let id = data.id;
    if (id?.startsWith("service:") || id?.startsWith("sales:")) {
      const table = id.startsWith("service:") ? "service_staff" : "sales_contacts";
      const result = await supabaseAdmin.from(table).select("id").eq("id", id.slice(id.indexOf(":") + 1)).eq("active", true).maybeSingle();
      if (result.error || !result.data) throw new Error("ไม่พบผู้ใช้งาน กรุณาเลือกอีกครั้ง");
    } else if (id?.startsWith("project:")) {
      const { data: settings, error } = await supabaseAdmin.from("app_settings").select("value").eq("key", "engineers").maybeSingle();
      const rows: unknown[] = JSON.parse(settings?.value ?? "[]");
      if (error || !rows.some(item => typeof item === "string" ? id === `project:${item}` : !!item && typeof item === "object" && (item as { active?: boolean }).active !== false && id === `project:${(item as { id?: string; name?: string }).id ?? (item as { name?: string }).name}`)) throw new Error("ไม่พบผู้ใช้งาน กรุณาเลือกอีกครั้ง");
    } else if (id !== null) throw new Error("ไม่พบผู้ใช้งาน");
    if (!id) {
      const { createHash } = await import("node:crypto");
      id = `guest:${createHash("sha256").update(session.id ?? crypto.randomUUID()).digest("hex")}`;
    }
    await session.update({ profileId: id });
    return { id };
  });

export const currentProfile = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAccess, accessSession } = await import("./access-session.server");
  await requireAccess();
  const session = await accessSession();
  const id = session.data.profileId;
  if (!id) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (id.startsWith("service:") || id.startsWith("sales:")) {
    const result = await supabaseAdmin.from(id.startsWith("service:") ? "service_staff" : "sales_contacts").select("name, avatar_url").eq("id", id.slice(id.indexOf(":") + 1)).eq("active", true).maybeSingle();
    if (result.error) throw new Error("โหลดรูปโปรไฟล์ไม่สำเร็จ");
    return result.data ? { id, name: result.data.name, avatar: result.data.avatar_url ?? "" } : null;
  }
  const { data, error } = await supabaseAdmin.from("app_settings").select("value").eq("key", id.startsWith("guest:") ? id : "engineers").maybeSingle();
  if (error) throw new Error("โหลดรูปโปรไฟล์ไม่สำเร็จ");
  if (id.startsWith("guest:")) return { id, name: session.data.role === "admin" ? "ผู้ดูแลระบบ" : "ผู้ใช้ทั่วไป", avatar: data?.value ?? "" };
  const rows: unknown[] = JSON.parse(data?.value ?? "[]");
  for (const item of rows) {
    const row = typeof item === "string" ? { name: item } : item as { id?: string; name?: string; active?: boolean; avatar_url?: string } | null;
    if (row && row.active !== false && id === `project:${row.id ?? row.name}`) return { id, name: row.name ?? "วิศวกร", avatar: row.avatar_url ?? "" };
  }
  return null;
});

export const saveOwnPhoto = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ base64: z.string().max(700000) }).strict().parse(input))
  .handler(async ({ data }) => {
    const { requireAccess, accessSession, consumeRateLimit } = await import("./access-session.server");
    const { sessionId } = await requireAccess();
    const { requireSelectedProfile, validateProfilePhoto } = await import("./profile-policy");
    const session = await accessSession();
    const id = requireSelectedProfile(session.data.profileId);
    await consumeRateLimit("profile-photo", sessionId, 20, 3600);
    const binary = atob(data.base64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const mime = validateProfilePhoto(bytes);
    const profile = await currentProfile();
    if (!profile || profile.id !== id) throw new Error("กรุณาเลือกผู้ใช้งานอีกครั้ง");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `self/${crypto.randomUUID()}.${mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp"}`;
    const avatar = `/api/data/storage/v1/object/authenticated/employee-photos/${path}`;
    const upload = await supabaseAdmin.storage.from("employee-photos").upload(path, bytes, { contentType: mime, upsert: false });
    if (upload.error) throw new Error("อัปโหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง");
    try {
      if (id.startsWith("service:") || id.startsWith("sales:")) {
        const result = await supabaseAdmin.from(id.startsWith("service:") ? "service_staff" : "sales_contacts").update({ avatar_url: avatar }).eq("id", id.slice(id.indexOf(":") + 1)).eq("active", true).select("id");
        if (result.error || !result.data?.length) throw new Error("บันทึกรูปไม่สำเร็จ");
      } else if (id.startsWith("project:")) {
        const result = await supabaseAdmin.from("app_settings").select("id,value").eq("key", "engineers").single();
        if (result.error || result.data.value === null) throw new Error("โหลดข้อมูลวิศวกรไม่สำเร็จ");
        const previousValue = result.data.value;
        const rows: unknown[] = JSON.parse(previousValue);
        const value = JSON.stringify(rows.map(item => {
          const row = typeof item === "string" ? { name: item } : item as { id?: string; name?: string };
          return id === `project:${row.id ?? row.name}` ? { ...row, avatar_url: avatar } : item;
        }));
        const saved = await supabaseAdmin.from("app_settings").update({ value }).eq("id", result.data.id).eq("value", previousValue).select("id");
        if (saved.error || !saved.data?.length) throw new Error("ข้อมูลเปลี่ยนระหว่างบันทึก กรุณาลองอีกครั้ง");
      } else {
        const result = await supabaseAdmin.from("app_settings").upsert({ key: id, value: avatar }, { onConflict: "key" });
        if (result.error) throw new Error("บันทึกรูปไม่สำเร็จ");
      }
    } catch (error) {
      await supabaseAdmin.storage.from("employee-photos").remove([path]);
      throw error;
    }
    return { ...profile, avatar };
  });
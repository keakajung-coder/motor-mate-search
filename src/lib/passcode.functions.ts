import { createServerFn } from "@tanstack/react-start";

type Kind = "viewer" | "admin";

export const verifyPasscode = createServerFn({ method: "POST" })
  .inputValidator((d: { kind: Kind; code: string }) => d)
  .handler(async ({ data }) => {
    const inputCode = String(data?.code ?? "").trim();
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const key = data.kind === "admin" ? "admin_passcode" : "viewer_passcode";
      const { data: row, error } = await supabaseAdmin
        .from("security_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (!error && row?.value) {
        const expected = String(row.value).trim();
        if (expected.length > 0) {
          return { ok: expected === inputCode };
        }
      }
    } catch (err) {
      console.warn("[verifyPasscode] Falling back to default passcode due to DB/env error:", err);
    }
    const defaultPasscode = data.kind === "admin" ? "1234" : "5555";
    return { ok: defaultPasscode === inputCode };
  });

export const updatePasscodes = createServerFn({ method: "POST" })
  .inputValidator((d: { currentAdminCode: string; viewerCode?: string; adminCode?: string }) => d)
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: cur } = await supabaseAdmin
        .from("security_settings")
        .select("value")
        .eq("key", "admin_passcode")
        .maybeSingle();
      if (!cur || cur.value.trim() !== String(data.currentAdminCode ?? "").trim()) {
        return { ok: false as const, error: "รหัสแอดมินปัจจุบันไม่ถูกต้อง" };
      }

      const updates: { key: string; value: string }[] = [];
      const viewer = String(data.viewerCode ?? "").trim();
      const admin = String(data.adminCode ?? "").trim();
      if (viewer) {
        if (viewer.length < 4) return { ok: false as const, error: "รหัสเข้าดูต้องมีอย่างน้อย 4 ตัว" };
        updates.push({ key: "viewer_passcode", value: viewer });
      }
      if (admin) {
        if (admin.length < 4) return { ok: false as const, error: "รหัสแอดมินต้องมีอย่างน้อย 4 ตัว" };
        updates.push({ key: "admin_passcode", value: admin });
      }
      if (updates.length === 0) return { ok: false as const, error: "ยังไม่ได้กรอกรหัสใหม่" };

      for (const u of updates) {
        const { error } = await supabaseAdmin
          .from("security_settings")
          .update({ value: u.value })
          .eq("key", u.key);
        if (error) return { ok: false as const, error: error.message };
      }
      return { ok: true as const, changedAdmin: !!admin };
    } catch (err) {
      return {
        ok: false as const,
        error: "ไม่สามารถเชื่อมต่อฐานข้อมูลเพื่อบันทึกรหัสผ่านได้ (ต้องการ SUPABASE_SERVICE_ROLE_KEY ใน .env)",
      };
    }
  });

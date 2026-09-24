import { createServerFn } from "@tanstack/react-start";

/** ตารางที่อนุญาตให้ลบผ่านรหัสแอดมินเท่านั้น */
const ALLOWED_TABLES = new Set([
  "app_settings",
  "appointments",
  "brands",
  "categories",
  "compressor_models",
  "customers",
  "machine_parts",
  "machine_units",
  "maintenance_logs",
  "part_bundle_items",
  "part_bundles",
  "products",
  "sales_contacts",
  "notifications",
  "service_staff",
  "troubleshooting_issues",
  "vehicles",
  "work_orders",
]);

/**
 * ลบข้อมูลแบบปลอดภัย: ตรวจรหัสแอดมินฝั่งเซิร์ฟเวอร์ก่อนเสมอ
 * (anon ไม่มีสิทธิ์ DELETE ตามนโยบาย RLS แล้ว)
 */
export const adminDelete = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; table: string; filters: Record<string, string> }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("security_settings")
      .select("value")
      .eq("key", "admin_passcode")
      .maybeSingle();
    if (!row || row.value.trim() !== String(data.code ?? "").trim()) {
      return { ok: false as const, error: "รหัสแอดมินไม่ถูกต้องหรือยังไม่ได้ปลดล็อก" };
    }
    if (!ALLOWED_TABLES.has(data.table)) {
      return { ok: false as const, error: "ไม่อนุญาตให้ลบตารางนี้" };
    }
    const filters = data.filters ?? {};
    const keys = Object.keys(filters);
    if (keys.length === 0) return { ok: false as const, error: "ต้องระบุเงื่อนไขการลบ" };
    let q = supabaseAdmin.from(data.table as never).delete();
    for (const [k, v] of Object.entries(filters)) {
      if (!/^[a-z_][a-z0-9_]*$/.test(k)) return { ok: false as const, error: "คอลัมน์ไม่ถูกต้อง" };
      q = q.eq(k, v);
    }
    const { error } = await q;
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

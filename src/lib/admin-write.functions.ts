import { createServerFn } from "@tanstack/react-start";

/** ตารางที่อนุญาตให้ลบผ่านรหัสแอดมินเท่านั้น */
const ALLOWED_TABLES = new Set([
  "app_settings",
  "appointments",
  "brands",
  "categories",
  "checklist_templates",
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
async function verifyAdmin(_code: string) {
  const { requireAccess } = await import("./access-session.server");
  await requireAccess("admin");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { ok: true, supabaseAdmin };
}

const LABEL_COLS = ["name", "plate", "serial_number", "customer_name", "title", "part_number", "key", "staff_name"];

/** ถังขยะ: รายการที่ถูกลบล่าสุด */
export const listDeletedItems = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data }) => {
    const { ok, supabaseAdmin } = await verifyAdmin(data.code);
    if (!ok) return { ok: false as const, error: "รหัสแอดมินไม่ถูกต้อง", items: [] };
    const { data: items, error } = await supabaseAdmin
      .from("deleted_items")
      .select("id, table_name, label, deleted_at")
      .order("deleted_at", { ascending: false })
      .limit(500);
    if (error) return { ok: false as const, error: error.message, items: [] };
    return { ok: true as const, items: items ?? [] };
  });

/** กู้คืนรายการจากถังขยะกลับเข้าตารางเดิม (ใช้ id เดิม) */
export const restoreDeletedItem = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; id: string }) => d)
  .handler(async ({ data }) => {
    const { ok, supabaseAdmin } = await verifyAdmin(data.code);
    if (!ok) return { ok: false as const, error: "รหัสแอดมินไม่ถูกต้อง" };
    const { data: item } = await supabaseAdmin.from("deleted_items").select("*").eq("id", data.id).maybeSingle();
    if (!item) return { ok: false as const, error: "ไม่พบรายการ" };
    if (!ALLOWED_TABLES.has(item.table_name)) return { ok: false as const, error: "ไม่อนุญาต" };
    const { error } = await supabaseAdmin.from(item.table_name as never).upsert(item.row_data as never);
    if (error) return { ok: false as const, error: error.message };
    await supabaseAdmin.from("deleted_items").delete().eq("id", data.id);
    return { ok: true as const, table: item.table_name };
  });

/** ลบถาวรออกจากถังขยะ */
export const purgeDeletedItem = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; id: string }) => d)
  .handler(async ({ data }) => {
    const { ok, supabaseAdmin } = await verifyAdmin(data.code);
    if (!ok) return { ok: false as const, error: "รหัสแอดมินไม่ถูกต้อง" };
    const { error } = await supabaseAdmin.from("deleted_items").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const adminDelete = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; table: string; filters: Record<string, string> }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await verifyAdmin(data.code);
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
    // เก็บสำเนาลงถังขยะก่อนลบ เพื่อกู้คืนได้
    let sel = supabaseAdmin.from(data.table as never).select("*");
    for (const [k, v] of Object.entries(filters)) sel = sel.eq(k, v);
    const { data: snap } = await sel;
    const { error } = await q;
    if (!error && Array.isArray(snap) && snap.length) {
      await supabaseAdmin.from("deleted_items").insert(
        (snap as Record<string, unknown>[]).map((r) => ({
          table_name: data.table,
          label: String(LABEL_COLS.map((c) => r[c]).find((x) => x) ?? r.id ?? ""),
          row_data: r as never,
        })),
      );
    }
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

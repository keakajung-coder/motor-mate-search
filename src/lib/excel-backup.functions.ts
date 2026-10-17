import { createServerFn } from "@tanstack/react-start";
import { safeSpreadsheetValue } from "./security-policy";

const BUCKET = "excel-backups";
const K_INTERVAL = "excel_backup_interval";
const K_LAST = "excel_backup_last";
export type BackupInterval = "off" | "daily" | "weekly";

const BACKUP_TABLES = [
  "customers", "machine_units", "products", "machine_parts", "brands", "compressor_models", "categories",
  "work_orders", "appointments", "maintenance_logs", "service_staff", "vehicles", "sales_contacts",
  "part_bundles", "part_bundle_items", "troubleshooting_issues", "checklist_templates",
] as const;

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function getSetting(key: string) {
  const db = await admin();
  const { data } = await db.from("security_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value ?? "").trim();
}

async function setSetting(key: string, value: string) {
  const db = await admin();
  const { data } = await db.from("security_settings").select("id").eq("key", key).maybeSingle();
  if (data) await db.from("security_settings").update({ value }).eq("key", key);
  else await db.from("security_settings").insert({ key, value });
}

async function verifyAdmin(_code: string) {
  const { requireAccess } = await import("./access-session.server");
  await requireAccess("admin");
  return true;
}

/** วันครบกำหนดสำรองถัดไป: daily = 24 ชม., weekly = 7 วัน */
export function isBackupDue(interval: string, last: string, now = Date.now()) {
  if (interval !== "daily" && interval !== "weekly") return false;
  const t = Date.parse(last);
  if (!Number.isFinite(t)) return true;
  return now - t >= (interval === "daily" ? 1 : 7) * 86_400_000;
}

async function runBackup() {
  const db = await admin();
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const t of BACKUP_TABLES) {
    const { data } = await db.from(t).select("*").limit(20000);
    const rows = ((data ?? []) as Record<string, unknown>[]).map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, safeSpreadsheetValue(value)])));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), t.slice(0, 31));
  }
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const now = new Date();
  const name = `backup-${now.toISOString().replace(/[:.]/g, "-")}.xlsx`;
  const { error } = await db.storage.from(BUCKET).upload(name, new Uint8Array(out), {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  if (error) throw new Error(error.message);
  await setSetting(K_LAST, now.toISOString());
  return name;
}

/** เรียกตอนเปิดแอป: ถ้าครบกำหนดจะสำรอง Excel เข้าโฟลเดอร์บนระบบให้อัตโนมัติ */
export const maybeAutoBackup = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAccess, consumeRateLimit } = await import("./access-session.server");
  const access = await requireAccess("admin");
  await consumeRateLimit("backup", access.sessionId, 2, 300);
  const [interval, last] = await Promise.all([getSetting(K_INTERVAL), getSetting(K_LAST)]);
  if (!isBackupDue(interval, last)) return { ran: false };
  // จองเวลาไว้ก่อน กันหลายเครื่องสำรองซ้ำพร้อมกัน
  await setSetting(K_LAST, new Date().toISOString());
  try {
    return { ran: true, file: await runBackup() };
  } catch {
    await setSetting(K_LAST, last);
    return { ran: false };
  }
});

export const getBackupInfo = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data }) => {
    if (!(await verifyAdmin(data.code))) return { ok: false as const, error: "ต้องปลดล็อกแอดมินก่อน" };
    const db = await admin();
    const { data: files } = await db.storage.from(BUCKET).list("", { limit: 30, sortBy: { column: "name", order: "desc" } });
    return {
      ok: true as const,
      interval: ((await getSetting(K_INTERVAL)) || "off") as BackupInterval,
      last: await getSetting(K_LAST),
      files: (files ?? []).filter((f) => f.name.endsWith(".xlsx")).map((f) => ({ name: f.name, size: (f.metadata as { size?: number } | null)?.size ?? 0 })),
    };
  });

export const saveBackupInterval = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; interval: BackupInterval }) => d)
  .handler(async ({ data }) => {
    if (!(await verifyAdmin(data.code))) return { ok: false as const, error: "ต้องปลดล็อกแอดมินก่อน" };
    await setSetting(K_INTERVAL, ["off", "daily", "weekly"].includes(data.interval) ? data.interval : "off");
    return { ok: true as const };
  });

export const backupNow = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data }) => {
    if (!(await verifyAdmin(data.code))) return { ok: false as const, error: "ต้องปลดล็อกแอดมินก่อน" };
    try {
      return { ok: true as const, file: await runBackup() };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "สำรองไม่สำเร็จ" };
    }
  });

export const backupDownloadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; name: string }) => d)
  .handler(async ({ data }) => {
    if (!(await verifyAdmin(data.code))) return { ok: false as const, error: "ต้องปลดล็อกแอดมินก่อน" };
    const db = await admin();
    const { data: s, error } = await db.storage.from(BUCKET).createSignedUrl(data.name, 600, { download: true });
    if (error || !s) return { ok: false as const, error: error?.message ?? "ไม่พบไฟล์" };
    return { ok: true as const, url: s.signedUrl };
  });

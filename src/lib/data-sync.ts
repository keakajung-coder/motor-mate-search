import { getQueryClient } from "@/lib/query-client";
import { refreshDirectory } from "@/lib/directory";

const globallyRemoved = new Set<string>();

/**
 * บันทึกค่าที่ถูกลบ เพื่อให้ Combobox / Select / MultiCombobox ทุกตัวตัดรายการนี้ทิ้งทันทีแบบเรียลไทม์
 */
export function markValueRemoved(value: string) {
  const clean = value.trim().toLowerCase();
  if (!clean) return;
  globallyRemoved.add(clean);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app:option-removed", { detail: { value } }));
  }
}

/**
 * ตรวจสอบว่าค่านั้นถูกลบไปแล้วหรือไม่
 */
export function isValueRemoved(value: string | null | undefined): boolean {
  if (!value) return false;
  return globallyRemoved.has(value.trim().toLowerCase());
}

/**
 * ตารางและความสัมพันธ์ที่ต้อง invalidate พร้อมกัน
 */
const TABLE_DEPENDENCIES: Record<string, string[]> = {
  brands: ["brands", "compressor_models", "machine_units", "products", "directory"],
  compressor_models: ["compressor_models", "machine_units", "pump_types", "checklist_templates", "directory"],
  pump_types: ["pump_types", "compressor_models", "checklist_templates", "app_settings", "directory"],
  statuses: ["statuses", "machine_statuses", "machine_units", "app_settings"],
  machine_statuses: ["statuses", "machine_statuses", "machine_units", "app_settings"],
  customers: ["customers", "machine_units", "appointments", "work_orders", "directory"],
  machine_units: ["machine_units", "machine_parts", "maintenance_logs", "appointments", "work_orders", "directory"],
  machine_parts: ["machine_parts", "machine_units", "products"],
  products: ["products", "categories", "machine_parts", "part_bundles"],
  categories: ["categories", "products"],
  service_staff: ["service_staff", "staff_leave", "appointments", "work_orders", "directory"],
  vehicles: ["vehicles", "appointments", "work_orders", "directory"],
  engineers: ["engineers", "app_settings", "directory"],
  sellers: ["sellers", "sales_contacts", "machine_units", "directory"],
  sales_contacts: ["sales_contacts", "sellers", "machine_units", "directory"],
  checklist_templates: ["checklist_templates", "pump_types"],
  part_bundles: ["part_bundles", "part_bundle_items"],
  part_bundle_items: ["part_bundle_items", "part_bundles"],
  appointments: ["appointments", "work_orders"],
  work_orders: ["work_orders", "appointments"],
  troubleshooting_issues: ["troubleshooting_issues"],
  holidays: ["holidays", "app_settings"],
  app_settings: [
    "app_settings",
    "pump_types",
    "statuses",
    "machine_statuses",
    "sellers",
    "engineers",
    "holidays",
    "directory",
  ],
  directory: ["directory", "customers", "machine_units", "service_staff", "vehicles", "engineers"],
  deleted_items: ["deleted_items"],
};

/**
 * บังคับ Re-fetch & Invalidate ข้อมูลทั่วทั้งแอปพลิเคชัน
 * 1. สั่ง queryClient.invalidateQueries() สำหรับทุก Query Key ที่เกี่ยวข้อง
 * 2. ซิงก์ข้อมูล Directory กลางใหม่
 * 3. ส่ง CustomEvent แจ้งเตือนทุก Component และ Dropdown ให้อัปเดตทันที
 */
export function invalidateData(
  tables: string | string[],
  options?: { removedValue?: string },
) {
  if (options?.removedValue) {
    markValueRemoved(options.removedValue);
  }

  const rawTables = Array.isArray(tables) ? tables : [tables];
  const allTablesToInvalidate = new Set<string>();

  for (const t of rawTables) {
    allTablesToInvalidate.add(t);
    const deps = TABLE_DEPENDENCIES[t];
    if (deps) {
      for (const d of deps) allTablesToInvalidate.add(d);
    }
  }

  // 1. Invalidate TanStack Query Client
  try {
    const qc = getQueryClient();
    for (const key of allTablesToInvalidate) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  } catch (err) {
    console.error("Failed to invalidate queries:", err);
  }

  // 2. ซิงก์ Directory กลางถ้ามีตารางที่เกี่ยวข้อง
  const affectsDirectory = [
    "customers",
    "machine_units",
    "service_staff",
    "vehicles",
    "engineers",
    "sellers",
    "sales_contacts",
    "directory",
  ].some((t) => allTablesToInvalidate.has(t));

  if (affectsDirectory) {
    void refreshDirectory().catch(() => {});
  }

  // 3. ยิง Event ให้ Dropdown และ Component ทุกตัวอัปเดตทันที
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("app:data-changed", {
        detail: { tables: Array.from(allTablesToInvalidate) },
      }),
    );
    window.dispatchEvent(new Event("app:connection-restored"));

    if (allTablesToInvalidate.has("pump_types")) {
      window.dispatchEvent(new Event("pump-types-changed"));
      window.dispatchEvent(new CustomEvent("option-list-changed", { detail: { key: "pump_types" } }));
    }
    if (allTablesToInvalidate.has("sellers") || allTablesToInvalidate.has("sales_contacts")) {
      window.dispatchEvent(new Event("sales-contacts-changed"));
      window.dispatchEvent(new CustomEvent("option-list-changed", { detail: { key: "sellers" } }));
    }
    if (allTablesToInvalidate.has("statuses") || allTablesToInvalidate.has("machine_statuses")) {
      window.dispatchEvent(new CustomEvent("option-list-changed", { detail: { key: "statuses" } }));
    }
    if (allTablesToInvalidate.has("service_staff")) {
      window.dispatchEvent(new Event("service-staff-changed"));
    }
    if (allTablesToInvalidate.has("engineers")) {
      window.dispatchEvent(new Event("engineers-changed"));
    }
    if (allTablesToInvalidate.has("part_bundles")) {
      window.dispatchEvent(new Event("part-bundles-changed"));
    }
    if (allTablesToInvalidate.has("holidays")) {
      window.dispatchEvent(new Event("app:holidays-changed"));
    }
  }
}

/**
 * ซิงก์ข้อมูลล่าสุดทั้งระบบทันที (ดึงข้อมูลงาน คิวงาน และตารางตัวเลือกล่าสุด)
 */
export async function syncLatestData(): Promise<void> {
  if (typeof window !== "undefined") {
    invalidateData([
      "appointments",
      "work_orders",
      "machine_units",
      "customers",
      "directory",
      "service_staff",
      "sales_contacts",
      "sellers",
    ]);
    window.dispatchEvent(new CustomEvent("planner:reload"));
    window.dispatchEvent(new CustomEvent("app:data-changed"));
    try {
      await refreshDirectory();
    } catch {
      /* ignore */
    }
  }
}

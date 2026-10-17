import { supabase } from "@/lib/data-client";
import { xlsxBlob } from "@/lib/report";
import { sanitizeSheetName, sanitizeFileName } from "@/lib/excel-layout";

type Sheet = { table: string; label: string };

/** ตารางข้อมูลที่ส่งออกตามหน้าที่เปิดอยู่ */
export const PAGE_SHEETS: Record<string, { title: string; sheets: Sheet[] }> = {
  "/": {
    title: "ค้นหาอะไหล่",
    sheets: [
      { table: "products", label: "อะไหล่" },
      { table: "machine_units", label: "เครื่อง S/N" },
      { table: "customers", label: "ลูกค้า" },
      { table: "machine_parts", label: "อะไหล่ตามเครื่อง" },
    ],
  },
  "/planner": {
    title: "แพลนเนอร์งาน",
    sheets: [
      { table: "work_orders", label: "ใบสั่งงาน" },
      { table: "appointments", label: "นัดหมาย" },
      { table: "maintenance_logs", label: "ประวัติซ่อม" },
    ],
  },
  "/admin": {
    title: "ข้อมูลทั้งหมด",
    sheets: [
      { table: "customers", label: "ลูกค้า" },
      { table: "machine_units", label: "เครื่อง S/N" },
      { table: "products", label: "อะไหล่" },
      { table: "brands", label: "ยี่ห้อ" },
      { table: "compressor_models", label: "รุ่น" },
      { table: "service_staff", label: "ช่าง" },
      { table: "vehicles", label: "รถ" },
      { table: "sales_contacts", label: "ผู้ขาย" },
      { table: "work_orders", label: "ใบสั่งงาน" },
      { table: "appointments", label: "นัดหมาย" },
      { table: "troubleshooting_issues", label: "อาการเสีย" },
    ],
  },
};

export function sheetsForPath(path: string) {
  return PAGE_SHEETS[path] ?? PAGE_SHEETS["/admin"];
}

export async function buildPageWorkbook(path: string) {
  const cfg = sheetsForPath(path);
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const s of cfg.sheets) {
    const { data } = await supabase.from(s.table as never).select("*").limit(20000);
    const rows = (data ?? []) as Record<string, unknown>[];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), sanitizeSheetName(s.label, used));
  }
  const date = new Date().toISOString().slice(0, 10);
  return {
    blob: xlsxBlob(XLSX.write(wb, { bookType: "xlsx", type: "array" })),
    filename: `${sanitizeFileName(cfg.title)}-${date}.xlsx`,
    title: cfg.title,
  };
}

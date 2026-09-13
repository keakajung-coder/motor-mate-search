import { supabase } from "@/integrations/supabase/client";
import { storedAdminCode } from "@/lib/access";

export type AuditAction = "create" | "update" | "delete";

export type AuditRow = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  actor: string;
  summary: string | null;
  changes: unknown;
  created_at: string;
};

/** บันทึกประวัติการแก้ไขข้อมูล (ใคร แก้อะไร เมื่อไหร่) */
export async function logAudit(input: {
  table: string;
  recordId?: string | null;
  action: AuditAction;
  summary?: string;
  changes?: Record<string, unknown> | null;
}) {
  const actor = storedAdminCode() ? "admin" : "viewer";
  try {
    await supabase.from("audit_log").insert({
      table_name: input.table,
      record_id: input.recordId ?? null,
      action: input.action,
      actor,
      summary: input.summary ?? null,
      changes: (input.changes ?? null) as never,
    });
  } catch {
    /* ไม่ให้ประวัติล้มเหลวไปกระทบการบันทึกข้อมูลหลัก */
  }
}

export const AUDIT_ACTION_TH: Record<string, string> = {
  create: "เพิ่มข้อมูล",
  update: "แก้ไขข้อมูล",
  delete: "ลบข้อมูล",
};

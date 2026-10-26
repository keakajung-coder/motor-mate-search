import { supabase } from "@/lib/data-client";
export { matchesType, findChecklistTemplate } from "@/lib/checklist-matching";

export type ChecklistKind = "number" | "status" | "status_number";
export type ChecklistItem = { id: string; label: string; kind: ChecklistKind; fields: string[] };
export type ChecklistTemplate = {
  id: string;
  name: string;
  machine_types: string | null;
  pump_type: string | null;
  items: ChecklistItem[];
  sort_order: number;
};
export type ChecklistStatus = "normal" | "replace" | "abnormal";
export const STATUS_LABEL: Record<ChecklistStatus, string> = {
  normal: "ผ่าน (ปกติ)",
  replace: "ควรเฝ้าระวัง (เปลี่ยน)",
  abnormal: "ต้องแก้ไข (ไม่ปกติ)",
};
export const STATUS_SHORT_LABEL: Record<ChecklistStatus, string> = {
  normal: "ผ่าน",
  replace: "ควรเฝ้าระวัง",
  abnormal: "ต้องแก้ไข",
};

export function normalizeChecklistStatus(status?: string | null): ChecklistStatus | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "normal" || s === "pass" || s === "ok" || s === "ผ่าน" || s === "ปกติ") return "normal";
  if (s === "replace" || s === "warn" || s === "warning" || s === "เฝ้าระวัง" || s === "ควรเฝ้าระวัง" || s === "เปลี่ยน") return "replace";
  if (s === "abnormal" || s === "fail" || s === "bad" || s === "แก้ไข" || s === "ต้องแก้ไข" || s === "ไม่ปกติ") return "abnormal";
  return null;
}

export const KIND_LABEL: Record<ChecklistKind, string> = {
  number: "กรอกตัวเลข",
  status: "เลือกสถานะ",
  status_number: "สถานะ + ตัวเลข",
};

/** ผลที่บันทึกในใบงาน */
export type ChecklistResult = {
  template_id: string | null;
  template_name: string;
  check_no: string;
  year: string;
  items: { id: string; label: string; kind: ChecklistKind; fields: string[]; status?: ChecklistStatus | null; values: string[] }[];
};

export async function loadTemplates(): Promise<ChecklistTemplate[]> {
  const { data, error } = await supabase
    .from("checklist_templates" as never)
    .select("*")
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((t) => ({ ...t, items: Array.isArray(t.items) ? t.items : [] }));
}

export function newResult(t: ChecklistTemplate, prev?: ChecklistResult | null): ChecklistResult {
  return {
    template_id: t.id,
    template_name: t.name,
    check_no: prev?.check_no ?? "",
    year: prev?.year ?? String(new Date().getFullYear() + 543),
    items: t.items.map((it) => {
      const old = prev?.items.find((p) => p.id === it.id);
      return {
        id: it.id,
        label: it.label,
        kind: it.kind,
        fields: it.fields,
        status: old?.status ?? null,
        values: it.fields.length ? it.fields.map((_, i) => old?.values[i] ?? "") : [old?.values[0] ?? ""],
      };
    }),
  };
}

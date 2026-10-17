import { supabase } from "@/lib/data-client";

export type ChecklistKind = "number" | "status" | "status_number";
export type ChecklistItem = { id: string; label: string; kind: ChecklistKind; fields: string[] };
export type ChecklistTemplate = {
  id: string;
  name: string;
  machine_types: string | null;
  items: ChecklistItem[];
  sort_order: number;
};
export type ChecklistStatus = "normal" | "replace" | "abnormal";
export const STATUS_LABEL: Record<ChecklistStatus, string> = {
  normal: "ปกติ",
  replace: "เปลี่ยน",
  abnormal: "ไม่ปกติ",
};
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
  const { data } = await supabase
    .from("checklist_templates" as never)
    .select("*")
    .order("sort_order")
    .order("created_at");
  return ((data ?? []) as any[]).map((t) => ({ ...t, items: Array.isArray(t.items) ? t.items : [] }));
}

export function matchesType(t: ChecklistTemplate, type: string | null | undefined) {
  if (!type) return false;
  const types = (t.machine_types ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const ty = type.toLowerCase();
  return types.some((x) => ty.includes(x) || x.includes(ty));
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

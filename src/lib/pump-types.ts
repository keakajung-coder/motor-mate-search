import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/data-client";
import { loadOptionList, saveOptionList } from "@/lib/option-lists";
import { splitNames, joinNames } from "@/components/ui/multi-combobox";
import { logAudit } from "@/lib/audit";
import { invalidateData, isValueRemoved, markValueRemoved } from "@/lib/data-sync";
import { getQueryClient, QUERY_KEYS } from "@/lib/query-client";

export const PUMP_TYPE_PRESETS = ["ปั๊มลมสกรู", "ปั๊มลมสกอร์", "ปั๊มลมลูกสูบ", "อื่นๆ"];
export const DEFAULT_PUMP_TYPES = PUMP_TYPE_PRESETS;
const EVENT = "pump-types-changed";

export type PumpTypeUsage = {
  modelCount: number;
  unitCount: number;
  templateCount: number;
  modelNames: string[];
  templateNames: string[];
};

/** โหลดรายการประเภทปั๊มลมทั้งหมด (จาก app_settings + ฐานข้อมูลรุ่นเครื่อง + เทมเพลต + ค่าเริ่มต้น) */
export async function loadPumpTypes(): Promise<string[]> {
  const [models, templates, custom] = await Promise.all([
    supabase.from("compressor_models").select("pump_type"),
    supabase.from("checklist_templates" as never).select("pump_type,machine_types" as never),
    loadOptionList("pump_types"),
  ]);
  if (models.error) throw new Error(models.error.message);
  if (templates.error) throw new Error(templates.error.message);

  const values = [
    ...PUMP_TYPE_PRESETS,
    ...custom,
    ...(models.data ?? []).map((m) => m.pump_type ?? ""),
    ...((templates.data ?? []) as { pump_type?: string | null; machine_types?: string | null }[]).flatMap((t) =>
      t.pump_type ? [t.pump_type] : splitNames(t.machine_types)
    ),
  ];

  const unique = new Map<string, string>();
  for (const value of values) {
    const clean = value.trim();
    if (clean && !unique.has(clean.toLowerCase()) && !isValueRemoved(clean)) {
      unique.set(clean.toLowerCase(), clean);
    }
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, "th"));
}

/** ตรวจสอบและบันทึกประเภทปั๊มใหม่หากยังไม่มีในระบบ */
export async function ensurePumpType(value: string): Promise<string> {
  const clean = value.trim();
  if (!clean) return "";
  const known = await loadPumpTypes();
  const existing = known.find((type) => type.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;
  const { data, error } = await supabase.from("app_settings").select("id,value").eq("key", "pump_types").maybeSingle();
  if (error) throw new Error(error.message);
  let saved: string[] = [];
  try {
    const parsed = JSON.parse(data?.value ?? "[]");
    if (Array.isArray(parsed)) saved = parsed.filter((v) => typeof v === "string");
  } catch {
    /* recover malformed old list */
  }
  const payload = { value: JSON.stringify([...new Set([...saved, clean])]) };
  const result = data?.id
    ? await supabase.from("app_settings").update(payload).eq("id", data.id)
    : await supabase.from("app_settings").insert({ key: "pump_types", ...payload });
  if (result.error) throw new Error(result.error.message);
  notifyPumpTypesChanged();
  return clean;
}

/** เพิ่มประเภทปั๊มลมใหม่ */
export async function addPumpType(name: string): Promise<string[]> {
  const n = name.trim();
  if (!n) return await loadPumpTypes();
  await ensurePumpType(n);
  await logAudit({
    table: "compressor_models",
    action: "create",
    summary: `เพิ่มประเภทปั๊มลมใหม่: "${n}"`,
    changes: { name: n },
  });
  return await loadPumpTypes();
}

/** ตรวจสอบการใช้งานประเภทปั๊มลมว่ามีรุ่นเครื่อง/เครื่องจักร/เทมเพลตกี่รายการที่ผูกอยู่ */
export async function getPumpTypeUsage(name: string): Promise<PumpTypeUsage> {
  const target = name.trim().toLowerCase();
  const [modelsRes, unitsRes, tplsRes] = await Promise.all([
    supabase.from("compressor_models").select("id, name, pump_type"),
    supabase.from("machine_units").select("id, model_id"),
    supabase.from("checklist_templates" as never).select("id, name, pump_type, machine_types" as never),
  ]);

  const matchingModels = (modelsRes.data ?? []).filter(
    (m) => (m.pump_type ?? "").trim().toLowerCase() === target
  );
  const matchingModelIds = new Set(matchingModels.map((m) => m.id));

  const matchingUnits = (unitsRes.data ?? []).filter(
    (u) => u.model_id && matchingModelIds.has(u.model_id)
  );

  const matchingTemplates = ((tplsRes.data ?? []) as {
    id: string;
    name: string;
    pump_type?: string | null;
    machine_types?: string | null;
  }[]).filter(
    (t) =>
      (t.pump_type ?? "").trim().toLowerCase() === target ||
      splitNames(t.machine_types).some((x) => x.toLowerCase() === target)
  );

  return {
    modelCount: matchingModels.length,
    unitCount: matchingUnits.length,
    templateCount: matchingTemplates.length,
    modelNames: matchingModels.map((m) => m.name).slice(0, 5),
    templateNames: matchingTemplates.map((t) => t.name).slice(0, 5),
  };
}

/**
 * แก้ไขชื่อประเภทปั๊มลม (Cascading Update)
 * ปรับเปลี่ยนชื่อประเภทใน compressor_models และ checklist_templates อัตโนมัติทันที
 */
export async function renamePumpType(
  oldName: string,
  newName: string
): Promise<{ updatedModels: number; updatedTemplates: number }> {
  const o = oldName.trim();
  const n = newName.trim();
  if (!n || o.toLowerCase() === n.toLowerCase()) {
    return { updatedModels: 0, updatedTemplates: 0 };
  }

  // 1. ค้นหารุ่นเครื่องทั้งหมดที่ใช้ประเภทเดิม
  const { data: models } = await supabase.from("compressor_models").select("id, pump_type");
  const matchingModels = (models ?? []).filter(
    (m) => (m.pump_type ?? "").trim().toLowerCase() === o.toLowerCase()
  );

  for (const m of matchingModels) {
    await supabase.from("compressor_models").update({ pump_type: n }).eq("id", m.id);
  }

  // 2. ปรับปรุงใน checklist_templates (ทั้ง pump_type และ machine_types)
  const { data: tpls } = await supabase
    .from("checklist_templates" as never)
    .select("id, pump_type, machine_types" as never);

  let updatedTemplates = 0;
  for (const t of (tpls ?? []) as { id: string; pump_type?: string | null; machine_types?: string | null }[]) {
    const isSingleHit = (t.pump_type ?? "").trim().toLowerCase() === o.toLowerCase();
    const types = splitNames(t.machine_types);
    const hitIdx = types.findIndex((x) => x.toLowerCase() === o.toLowerCase());

    if (isSingleHit || hitIdx !== -1) {
      const updatedTypes = hitIdx !== -1
        ? Array.from(new Set(types.map((x) => (x.toLowerCase() === o.toLowerCase() ? n : x))))
        : types;
      const updatedSingle = isSingleHit ? n : t.pump_type;

      await supabase
        .from("checklist_templates" as never)
        .update({
          pump_type: updatedSingle || null,
          machine_types: updatedTypes.length ? joinNames(updatedTypes) : updatedSingle || null,
        } as never)
        .eq("id", t.id);
      updatedTemplates++;
    }
  }

  // 3. ปรับปรุงใน app_settings
  const current = await loadPumpTypes();
  const next = current.map((x) => (x.toLowerCase() === o.toLowerCase() ? n : x));
  await saveOptionList("pump_types", Array.from(new Set(next)));

  // 4. บันทึก Audit Log
  await logAudit({
    table: "compressor_models",
    action: "update",
    summary: `เปลี่ยนชื่อประเภทปั๊มลม "${o}" เป็น "${n}" (อัปเดต ${matchingModels.length} รุ่นเครื่อง, ${updatedTemplates} เทมเพลต)`,
    changes: {
      oldName: o,
      newName: n,
      updatedModels: matchingModels.length,
      updatedTemplates,
    },
  });

  // 5. แจ้ง Event ให้ UI อัปเดตทันที
  notifyPumpTypesChanged();

  return { updatedModels: matchingModels.length, updatedTemplates };
}

/**
 * ลบประเภทปั๊มลมออกจากระบบ
 * - หากระบุ migrateTo: ย้ายรุ่นเครื่องและเทมเพลตไปยังประเภทใหม่
 * - หากไม่ระบุ migrateTo: ปรับประเภทในรุ่นเครื่องให้เป็น null และนำออกจากเทมเพลต
 */
export async function deletePumpType(
  name: string,
  migrateTo?: string | null
): Promise<{ affectedModels: number; affectedTemplates: number }> {
  const targetName = name.trim();
  const destName = migrateTo?.trim() || null;

  // 1. ปรับปรุง compressor_models
  const { data: models } = await supabase.from("compressor_models").select("id, pump_type");
  const matchingModels = (models ?? []).filter(
    (m) => (m.pump_type ?? "").trim().toLowerCase() === targetName.toLowerCase()
  );

  for (const m of matchingModels) {
    await supabase
      .from("compressor_models")
      .update({ pump_type: destName })
      .eq("id", m.id);
  }

  // 2. ปรับปรุง checklist_templates
  const { data: tpls } = await supabase
    .from("checklist_templates" as never)
    .select("id, pump_type, machine_types" as never);

  let affectedTemplates = 0;
  for (const t of (tpls ?? []) as { id: string; pump_type?: string | null; machine_types?: string | null }[]) {
    const isSingleHit = (t.pump_type ?? "").trim().toLowerCase() === targetName.toLowerCase();
    const types = splitNames(t.machine_types);
    const isMultiHit = types.some((x) => x.toLowerCase() === targetName.toLowerCase());

    if (isSingleHit || isMultiHit) {
      let updatedTypes: string[];
      if (destName) {
        updatedTypes = types.map((x) => (x.toLowerCase() === targetName.toLowerCase() ? destName : x));
      } else {
        updatedTypes = types.filter((x) => x.toLowerCase() !== targetName.toLowerCase());
      }
      const uniqueTypes = Array.from(new Set(updatedTypes));
      const nextSingle = isSingleHit ? destName : t.pump_type;

      await supabase
        .from("checklist_templates" as never)
        .update({
          pump_type: nextSingle || null,
          machine_types: uniqueTypes.length ? joinNames(uniqueTypes) : nextSingle || null,
        } as never)
        .eq("id", t.id);
      affectedTemplates++;
    }
  }

  // 3. ปรับปรุง app_settings
  const current = await loadPumpTypes();
  const next = current.filter((x) => x.toLowerCase() !== targetName.toLowerCase());
  if (destName && !next.some((x) => x.toLowerCase() === destName.toLowerCase())) {
    next.push(destName);
  }
  await saveOptionList("pump_types", next);

  // 4. บันทึก Audit Log
  await logAudit({
    table: "compressor_models",
    action: "delete",
    summary: destName
      ? `ลบประเภทปั๊มลม "${targetName}" และย้ายไป "${destName}" (${matchingModels.length} รุ่น)`
      : `ลบประเภทปั๊มลม "${targetName}" และปรับเป็นค่าว่าง (${matchingModels.length} รุ่น)`,
    changes: {
      deleted: targetName,
      migratedTo: destName,
      affectedModels: matchingModels.length,
      affectedTemplates,
    },
  });

  // 5. แจ้ง Event และ Invalidate ข้อมูลทั่วทั้งระบบ
  markValueRemoved(targetName);
  try {
    const qc = getQueryClient();
    qc.setQueryData(QUERY_KEYS.pumpTypes, (old?: string[]) =>
      (old ?? []).filter((x) => x.toLowerCase() !== targetName.toLowerCase()),
    );
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.pumpTypes });
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.models });
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.checklistTemplates });
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.settings });
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.directory });
  } catch {
    /* ignore */
  }
  notifyPumpTypesChanged();

  return { affectedModels: matchingModels.length, affectedTemplates };
}

export function notifyPumpTypesChanged() {
  invalidateData(["pump_types", "compressor_models", "checklist_templates", "app_settings"]);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
    window.dispatchEvent(new CustomEvent("option-list-changed", { detail: { key: "pump_types" } }));
  }
}

export function usePumpTypes(): string[] {
  const qc = useQueryClient();
  const [, setTick] = useState(0);

  const query = useQuery({
    queryKey: QUERY_KEYS.pumpTypes,
    queryFn: loadPumpTypes,
    staleTime: 1000 * 30,
    select: (list) => list.filter((t) => !isValueRemoved(t)),
  });

  useEffect(() => {
    const onOptionRemoved = () => {
      setTick((n) => n + 1);
    };
    const onReload = () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.pumpTypes });
    };

    window.addEventListener(EVENT, onReload);
    window.addEventListener("app:option-removed", onOptionRemoved);
    window.addEventListener("app:data-changed", onReload);
    return () => {
      window.removeEventListener(EVENT, onReload);
      window.removeEventListener("app:option-removed", onOptionRemoved);
      window.removeEventListener("app:data-changed", onReload);
    };
  }, [qc]);

  return (query.data ?? []).filter((t) => !isValueRemoved(t));
}
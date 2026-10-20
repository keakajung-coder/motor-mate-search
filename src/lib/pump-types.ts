import { useEffect, useState } from "react";
import { supabase } from "@/lib/data-client";
import { loadOptionList } from "@/lib/option-lists";

export const PUMP_TYPE_PRESETS = ["ปั๊มลมสกรู", "ปั๊มลมสกอร์", "ปั๊มลมลูกสูบ", "อื่นๆ"];
const EVENT = "pump-types-changed";

export async function loadPumpTypes(): Promise<string[]> {
  const [models, templates, custom] = await Promise.all([
    supabase.from("compressor_models").select("pump_type"),
    supabase.from("checklist_templates").select("pump_type,machine_types"),
    loadOptionList("pump_types"),
  ]);
  if (models.error) throw new Error(models.error.message);
  if (templates.error) throw new Error(templates.error.message);
  const values = [...PUMP_TYPE_PRESETS, ...custom,
    ...(models.data ?? []).map((m) => m.pump_type ?? ""),
    ...(templates.data ?? []).flatMap((t) => t.pump_type ? [t.pump_type] : (t.machine_types ?? "").split(",")),
  ];
  const unique = new Map<string, string>();
  for (const value of values) {
    const clean = value.trim();
    if (clean && !unique.has(clean.toLowerCase())) unique.set(clean.toLowerCase(), clean);
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, "th"));
}

export async function ensurePumpType(value: string): Promise<string> {
  const clean = value.trim();
  if (!clean) return "";
  const known = await loadPumpTypes();
  const existing = known.find((type) => type.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;
  const { data, error } = await supabase.from("app_settings").select("id,value").eq("key", "pump_types").maybeSingle();
  if (error) throw new Error(error.message);
  let saved: string[] = [];
  try { const parsed = JSON.parse(data?.value ?? "[]"); if (Array.isArray(parsed)) saved = parsed.filter((v) => typeof v === "string"); } catch { /* recover malformed old list */ }
  const payload = { value: JSON.stringify([...new Set([...saved, clean])]) };
  const result = data?.id
    ? await supabase.from("app_settings").update(payload).eq("id", data.id)
    : await supabase.from("app_settings").insert({ key: "pump_types", ...payload });
  if (result.error) throw new Error(result.error.message);
  notifyPumpTypesChanged();
  return clean;
}

export function notifyPumpTypesChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function usePumpTypes() {
  const [types, setTypes] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    const reload = () => { void loadPumpTypes().then((list) => { if (active) setTypes(list); }).catch(() => {}); };
    reload();
    window.addEventListener(EVENT, reload);
    return () => { active = false; window.removeEventListener(EVENT, reload); };
  }, []);
  return types;
}
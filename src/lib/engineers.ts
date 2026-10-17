import { supabase } from "@/lib/data-client";
import { logAudit } from "@/lib/audit";

export type Engineer = {
  id: string;
  name: string;
  phone?: string | null;
  line_contact?: string | null;
  active: boolean;
  created_at?: string;
};

const SETTINGS_KEY = "engineers";

/** โหลดรายชื่อวิศวกรผู้ควบคุมงานจาก app_settings */
export async function loadEngineers(includeInactive = false): Promise<Engineer[]> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  if (!data?.value) return [];
  try {
    const raw = JSON.parse(data.value);
    if (!Array.isArray(raw)) return [];
    const list: Engineer[] = raw
      .map((item: any, idx: number) => {
        if (typeof item === "string") {
          const trimmed = item.trim();
          return {
            id: `eng-${idx}-${trimmed}`,
            name: trimmed,
            phone: null,
            line_contact: null,
            active: true,
          };
        }
        return {
          id: item.id || `eng-${idx}-${item.name || "item"}`,
          name: String(item.name ?? "").trim(),
          phone: item.phone ? String(item.phone).trim() : null,
          line_contact: item.line_contact ? String(item.line_contact).trim() : null,
          active: item.active !== false,
          created_at: item.created_at || new Date().toISOString(),
        };
      })
      .filter((e) => e.name.length > 0);

    return includeInactive ? list : list.filter((e) => e.active);
  } catch {
    return [];
  }
}

/** บันทึกรายการวิศวกรทั้งหมดลง app_settings พร้อมส่ง Event แจ้งเตือน */
export async function saveEngineers(list: Engineer[]): Promise<boolean> {
  const value = JSON.stringify(list);
  const { data } = await supabase
    .from("app_settings")
    .select("id")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  let error;
  if (data?.id) {
    const res = await supabase.from("app_settings").update({ value }).eq("id", data.id);
    error = res.error;
  } else {
    const res = await supabase.from("app_settings").insert({ key: SETTINGS_KEY, value });
    error = res.error;
  }

  if (error) return false;

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("engineers-changed"));
  }
  return true;
}

/** เพิ่มวิศวกรผู้ควบคุมงานคนใหม่ */
export async function addEngineer(input: {
  name: string;
  phone?: string | null;
  line_contact?: string | null;
}): Promise<{ success: boolean; engineer?: Engineer; error?: string }> {
  const name = input.name.trim();
  if (!name) return { success: false, error: "กรุณาระบุชื่อวิศวกร" };

  const current = await loadEngineers(true);
  const exists = current.find(
    (e) => e.name.toLowerCase() === name.toLowerCase() && e.active,
  );
  if (exists) {
    return { success: false, error: "มีชื่อวิศวกรนี้อยู่ในระบบแล้ว" };
  }

  // หากเคยลบไว้ (inactive) ให้นำกลับมาใช้งานใหม่
  const inactiveMatch = current.find(
    (e) => e.name.toLowerCase() === name.toLowerCase() && !e.active,
  );

  let updatedList: Engineer[];
  let savedEngineer: Engineer;

  if (inactiveMatch) {
    savedEngineer = {
      ...inactiveMatch,
      active: true,
      phone: input.phone?.trim() || inactiveMatch.phone,
      line_contact: input.line_contact?.trim() || inactiveMatch.line_contact,
    };
    updatedList = current.map((e) => (e.id === inactiveMatch.id ? savedEngineer : e));
  } else {
    savedEngineer = {
      id: `eng_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name,
      phone: input.phone?.trim() || null,
      line_contact: input.line_contact?.trim() || null,
      active: true,
      created_at: new Date().toISOString(),
    };
    updatedList = [...current, savedEngineer];
  }

  const ok = await saveEngineers(updatedList);
  if (!ok) return { success: false, error: "บันทึกลงฐานข้อมูลไม่สำเร็จ" };

  await logAudit({
    table: "engineers",
    recordId: savedEngineer.id,
    action: inactiveMatch ? "restore" : "create",
    summary: `เพิ่มวิศวกรผู้ควบคุมงาน: ${savedEngineer.name}`,
    changes: savedEngineer as unknown as Record<string, unknown>,
  });

  return { success: true, engineer: savedEngineer };
}

/** แก้ไขข้อมูลวิศวกร */
export async function updateEngineer(
  id: string,
  patch: Partial<Pick<Engineer, "name" | "phone" | "line_contact">>,
): Promise<{ success: boolean; error?: string }> {
  const current = await loadEngineers(true);
  const target = current.find((e) => e.id === id);
  if (!target) return { success: false, error: "ไม่พบข้อมูลวิศวกรที่ต้องการแก้ไข" };

  if (patch.name !== undefined && !patch.name.trim()) {
    return { success: false, error: "ชื่อวิศวกรต้องไม่ว่างเปล่า" };
  }

  const updated: Engineer = {
    ...target,
    name: patch.name !== undefined ? patch.name.trim() : target.name,
    phone: patch.phone !== undefined ? (patch.phone?.trim() || null) : target.phone,
    line_contact:
      patch.line_contact !== undefined ? (patch.line_contact?.trim() || null) : target.line_contact,
  };

  const updatedList = current.map((e) => (e.id === id ? updated : e));
  const ok = await saveEngineers(updatedList);
  if (!ok) return { success: false, error: "บันทึกการแก้ไขไม่สำเร็จ" };

  await logAudit({
    table: "engineers",
    recordId: id,
    action: "update",
    summary: `แก้ไขข้อมูลวิศวกร: ${updated.name}`,
    changes: { before: target, after: updated },
  });

  return { success: true };
}

/** ลบวิศวกร (Soft delete: active = false) */
export async function removeEngineer(
  id: string,
  permanent = false,
): Promise<{ success: boolean; error?: string }> {
  const current = await loadEngineers(true);
  const target = current.find((e) => e.id === id);
  if (!target) return { success: false, error: "ไม่พบข้อมูลวิศวกรที่ต้องการลบ" };

  let updatedList: Engineer[];
  if (permanent) {
    updatedList = current.filter((e) => e.id !== id);
  } else {
    updatedList = current.map((e) => (e.id === id ? { ...e, active: false } : e));
  }

  const ok = await saveEngineers(updatedList);
  if (!ok) return { success: false, error: "ลบข้อมูลไม่สำเร็จ" };

  await logAudit({
    table: "engineers",
    recordId: id,
    action: permanent ? "delete" : "soft_delete",
    summary: `${permanent ? "ลบถาวร" : "ลบชั่วคราว (Soft Delete)"} วิศวกรผู้ควบคุมงาน: ${target.name}`,
    changes: { id, name: target.name, active: false },
  });

  return { success: true };
}

/** กู้คืนวิศวกรที่ถูกลบ */
export async function restoreEngineer(id: string): Promise<{ success: boolean; error?: string }> {
  const current = await loadEngineers(true);
  const target = current.find((e) => e.id === id);
  if (!target) return { success: false, error: "ไม่พบข้อมูลวิศวกร" };

  const updatedList = current.map((e) => (e.id === id ? { ...e, active: true } : e));
  const ok = await saveEngineers(updatedList);
  if (!ok) return { success: false, error: "กู้คืนข้อมูลไม่สำเร็จ" };

  await logAudit({
    table: "engineers",
    recordId: id,
    action: "restore",
    summary: `กู้คืนวิศวกรผู้ควบคุมงาน: ${target.name}`,
    changes: { id, name: target.name, active: true },
  });

  return { success: true };
}

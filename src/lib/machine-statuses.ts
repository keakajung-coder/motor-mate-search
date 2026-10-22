import { useEffect, useState } from "react";
import { supabase } from "@/lib/data-client";
import { loadOptionList } from "@/lib/option-lists";
import { MACHINE_STATUSES } from "@/lib/report";
import { isValueRemoved } from "@/lib/data-sync";

/** โหลดรายการสถานะเครื่องทั้งหมด (จาก Preset + app_settings + ฐานข้อมูล) พร้อมตัดค่าที่ถูกลบออก */
export async function loadMachineStatuses(): Promise<string[]> {
  try {
    const [custom, unitsRes] = await Promise.all([
      loadOptionList("statuses").catch(() => []),
      supabase.from("machine_units").select("status"),
    ]);

    const unitStatuses = (unitsRes.data ?? [])
      .map((u: any) => (u.status ?? "").trim())
      .filter(Boolean);

    const merged = Array.from(new Set([...MACHINE_STATUSES, ...custom, ...unitStatuses]))
      .map((s) => s.trim())
      .filter((s) => Boolean(s) && !isValueRemoved(s));

    return merged.sort((a, b) => a.localeCompare(b, "th"));
  } catch {
    return MACHINE_STATUSES.filter((s) => !isValueRemoved(s));
  }
}

/** Hook สำหรับดึงสถานะเครื่องแบบ Live ซิงก์ทันทีเมื่อมีการลบหรือเพิ่มสถานะใหม่ */
export function useMachineStatuses(): string[] {
  const [statuses, setStatuses] = useState<string[]>(() =>
    MACHINE_STATUSES.filter((s) => !isValueRemoved(s)),
  );

  useEffect(() => {
    let alive = true;
    const reload = () => {
      void loadMachineStatuses().then((list) => {
        if (alive) setStatuses(list);
      });
    };

    reload();

    const onOptionRemoved = () => {
      setStatuses((prev) => prev.filter((s) => !isValueRemoved(s)));
    };

    window.addEventListener("option-list-changed", reload);
    window.addEventListener("app:data-changed", reload);
    window.addEventListener("app:option-removed", onOptionRemoved);

    return () => {
      alive = false;
      window.removeEventListener("option-list-changed", reload);
      window.removeEventListener("app:data-changed", reload);
      window.removeEventListener("app:option-removed", onOptionRemoved);
    };
  }, []);

  return statuses;
}

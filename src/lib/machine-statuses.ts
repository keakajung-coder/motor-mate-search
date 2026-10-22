import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/data-client";
import { loadOptionList } from "@/lib/option-lists";
import { MACHINE_STATUSES } from "@/lib/report";
import { isValueRemoved } from "@/lib/data-sync";
import { QUERY_KEYS } from "@/lib/query-client";

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

/** Hook สำหรับดึงสถานะเครื่องแบบ Live ซิงก์ทันทีเมื่อมีการลบหรือเพิ่มสถานะใหม่ ผ่าน TanStack Query */
export function useMachineStatuses(): string[] {
  const qc = useQueryClient();
  const [, setTick] = useState(0);

  const query = useQuery({
    queryKey: QUERY_KEYS.machineStatuses,
    queryFn: loadMachineStatuses,
    initialData: () => MACHINE_STATUSES.filter((s) => !isValueRemoved(s)),
    staleTime: 1000 * 30,
    select: (list) => list.filter((s) => !isValueRemoved(s)),
  });

  useEffect(() => {
    const onOptionRemoved = () => {
      setTick((n) => n + 1);
    };
    const reload = () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.machineStatuses });
      void qc.invalidateQueries({ queryKey: ["statuses"] });
    };

    window.addEventListener("option-list-changed", reload);
    window.addEventListener("app:data-changed", reload);
    window.addEventListener("app:option-removed", onOptionRemoved);

    return () => {
      window.removeEventListener("option-list-changed", reload);
      window.removeEventListener("app:data-changed", reload);
      window.removeEventListener("app:option-removed", onOptionRemoved);
    };
  }, [qc]);

  return (query.data ?? []).filter((s) => !isValueRemoved(s));
}


import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Holiday = {
  id: string;
  date: string; // "YYYY-MM-DD"
  title: string; // ชื่อวันหยุด เช่น "วันขึ้นปีใหม่", "วันสงกรานต์", "หยุดประจำปี"
  note?: string; // สาเหตุ/รายละเอียด เช่น "หยุดทำการทั้งบริษัท ไม่มีช่างเข้าบริการ", "หยุดชดเชยวันแรงงาน"
  color?: string; // "rose" | "amber" | "purple" | "blue" | "emerald"
  created_at?: string;
};

const STORAGE_KEY = "app_calendar_holidays";
const SETTINGS_KEY = "calendar_holidays";

// วันหยุดเริ่มต้น (วันหยุดนักขัตฤกษ์สากล/ไทย)
const DEFAULT_HOLIDAYS: Holiday[] = [
  {
    id: "def-newyear",
    date: "2026-01-01",
    title: "วันขึ้นปีใหม่",
    note: "หยุดทำการเนื่องในวันขึ้นปีใหม่",
    color: "rose",
  },
  {
    id: "def-songkran-1",
    date: "2026-04-13",
    title: "วันสงกรานต์",
    note: "หยุดเทศกาลสงกรานต์ประจำปี",
    color: "rose",
  },
  {
    id: "def-songkran-2",
    date: "2026-04-14",
    title: "วันสงกรานต์",
    note: "หยุดเทศกาลสงกรานต์ประจำปี",
    color: "rose",
  },
  {
    id: "def-songkran-3",
    date: "2026-04-15",
    title: "วันสงกรานต์",
    note: "หยุดเทศกาลสงกรานต์ประจำปี",
    color: "rose",
  },
  {
    id: "def-labor",
    date: "2026-05-01",
    title: "วันแรงงานแห่งชาติ",
    note: "หยุดทำการเนื่องในวันแรงงาน",
    color: "amber",
  },
];

function readLocal(): Holiday[] {
  if (typeof window === "undefined") return DEFAULT_HOLIDAYS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_HOLIDAYS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_HOLIDAYS;
  } catch {
    return DEFAULT_HOLIDAYS;
  }
}

function writeLocal(list: Holiday[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export async function loadHolidays(): Promise<Holiday[]> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    if (!error && data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed)) {
        writeLocal(parsed);
        return parsed;
      }
    }
  } catch {
    // offline or error -> fallback to local
  }
  return readLocal();
}

export async function saveHolidays(list: Holiday[]): Promise<boolean> {
  writeLocal(list);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app:holidays-changed"));
  }

  try {
    const value = JSON.stringify(list);
    const { data: exists } = await supabase
      .from("app_settings")
      .select("id")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    if (exists?.id) {
      await supabase.from("app_settings").update({ value }).eq("key", SETTINGS_KEY);
    } else {
      await supabase.from("app_settings").insert({ key: SETTINGS_KEY, value });
    }
    return true;
  } catch {
    return false;
  }
}

export async function addHoliday(data: Omit<Holiday, "id">): Promise<Holiday> {
  const current = await loadHolidays();
  const newHoliday: Holiday = {
    ...data,
    id: "hol-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    created_at: new Date().toISOString(),
  };
  const updated = [...current.filter((h) => h.date !== data.date), newHoliday].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  await saveHolidays(updated);
  return newHoliday;
}

export async function updateHoliday(holiday: Holiday): Promise<boolean> {
  const current = await loadHolidays();
  const updated = current
    .map((h) => (h.id === holiday.id ? holiday : h))
    .sort((a, b) => a.date.localeCompare(b.date));
  return saveHolidays(updated);
}

export async function deleteHoliday(idOrDate: string): Promise<boolean> {
  const current = await loadHolidays();
  const updated = current.filter((h) => h.id !== idOrDate && h.date !== idOrDate);
  return saveHolidays(updated);
}

export function useHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>(readLocal);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const list = await loadHolidays();
    setHolidays(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();

    const onChange = () => {
      setHolidays(readLocal());
    };

    window.addEventListener("app:holidays-changed", onChange);
    window.addEventListener("app:connection-restored", reload);

    return () => {
      window.removeEventListener("app:holidays-changed", onChange);
      window.removeEventListener("app:connection-restored", reload);
    };
  }, [reload]);

  const holidaysMap = useMemo(() => {
    const map: Record<string, Holiday> = {};
    for (const h of holidays) {
      map[h.date] = h;
    }
    return map;
  }, [holidays]);

  const handleAdd = useCallback(async (data: Omit<Holiday, "id">) => {
    const created = await addHoliday(data);
    setHolidays((prev) =>
      [...prev.filter((h) => h.date !== data.date), created].sort((a, b) =>
        a.date.localeCompare(b.date)
      )
    );
    return created;
  }, []);

  const handleUpdate = useCallback(async (h: Holiday) => {
    await updateHoliday(h);
    setHolidays((prev) =>
      prev.map((item) => (item.id === h.id ? h : item)).sort((a, b) => a.date.localeCompare(b.date))
    );
  }, []);

  const handleDelete = useCallback(async (idOrDate: string) => {
    await deleteHoliday(idOrDate);
    setHolidays((prev) => prev.filter((h) => h.id !== idOrDate && h.date !== idOrDate));
  }, []);

  return {
    holidays,
    holidaysMap,
    loading,
    reload,
    addHoliday: handleAdd,
    updateHoliday: handleUpdate,
    deleteHoliday: handleDelete,
  };
}

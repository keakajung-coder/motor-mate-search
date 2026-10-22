import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/data-client";
import { loadOptionList, saveOptionList } from "@/lib/option-lists";
import { isValueRemoved, invalidateData } from "@/lib/data-sync";
import { QUERY_KEYS, getQueryClient } from "@/lib/query-client";

/** รวมรายชื่อเซลล์/ผู้ขายจากทุกแหล่ง เพื่อใช้เป็นตัวเลือกใน Dropdown */
export async function loadSellerNames(): Promise<string[]> {
  const [contacts, list] = await Promise.all([
    supabase.from("sales_contacts").select("name").order("name"),
    loadOptionList("sellers"),
  ]);
  const names = [...(contacts.data ?? []).map((r: any) => r.name as string), ...list]
    .map((n) => (n ?? "").trim())
    .filter((n) => Boolean(n) && !isValueRemoved(n));
  const seen = new Map<string, string>();
  for (const n of names) if (!seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n);
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, "th"));
}

/** เพิ่มชื่อเซลล์ใหม่เข้าระบบอัตโนมัติ ถ้ายังไม่มีอยู่ */
export async function ensureSeller(name?: string | null) {
  const value = (name ?? "").trim();
  if (!value || isValueRemoved(value)) return false;
  try {
    const existing = await loadSellerNames();
    if (existing.some((n) => n.toLowerCase() === value.toLowerCase())) return false;
    await supabase.from("sales_contacts").insert({ kind: "vendor", name: value });
    const sellers = await loadOptionList("sellers");
    await saveOptionList("sellers", [...sellers, value]);
    invalidateData(["sellers", "sales_contacts", "directory"]);
    try {
      const qc = getQueryClient();
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.sellers });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.salesContacts });
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("sales-contacts-changed"));
    return true;
  } catch {
    return false;
  }
}

/** ตัวเลือกเซลล์แบบสด รีเฟรชเมื่อมีการเพิ่มหรือลบรายชื่อใหม่ ผ่าน TanStack Query */
export function useSellerNames(): string[] {
  const qc = useQueryClient();
  const [, setTick] = useState(0);

  const query = useQuery({
    queryKey: QUERY_KEYS.sellers,
    queryFn: loadSellerNames,
    staleTime: 1000 * 30,
    select: (list) => list.filter((n) => !isValueRemoved(n)),
  });

  useEffect(() => {
    const onOptionRemoved = () => {
      setTick((n) => n + 1);
    };
    const load = () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.sellers });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.salesContacts });
    };

    window.addEventListener("sales-contacts-changed", load);
    window.addEventListener("app:option-removed", onOptionRemoved);
    window.addEventListener("app:data-changed", load);
    return () => {
      window.removeEventListener("sales-contacts-changed", load);
      window.removeEventListener("app:option-removed", onOptionRemoved);
      window.removeEventListener("app:data-changed", load);
    };
  }, [qc]);

  return (query.data ?? []).filter((n) => !isValueRemoved(n));
}


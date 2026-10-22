import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/data-client";
import { loadOffline, saveOffline } from "@/lib/offline";

export type BundleItem = { product_id: string; quantity: number; part_number: string; name: string };
export type PartBundle = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number | null;
  items: BundleItem[];
};

const CACHE_KEY = "part_bundles";

export async function fetchBundles(): Promise<PartBundle[]> {
  const { data, error } = await supabase
    .from("part_bundles")
    .select("id, name, description, sort_order, part_bundle_items ( product_id, quantity, products ( part_number, name ) )")
    .order("sort_order")
    .order("name");
  if (error || !data) return loadOffline<PartBundle[]>(CACHE_KEY) ?? [];
  const mapped: PartBundle[] = (data as any[]).map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    sort_order: b.sort_order,
    items: (b.part_bundle_items ?? []).map((it: any) => ({
      product_id: it.product_id,
      quantity: it.quantity ?? 1,
      part_number: it.products?.part_number ?? "",
      name: it.products?.name ?? "",
    })),
  }));
  saveOffline(CACHE_KEY, mapped);
  return mapped;
}

/** โหลดชุดอะไหล่ (รองรับออฟไลน์ด้วยข้อมูลที่แคชไว้) */
export function useBundles() {
  const [bundles, setBundles] = useState<PartBundle[]>(() => loadOffline<PartBundle[]>(CACHE_KEY) ?? []);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setBundles(await fetchBundles());
    setLoading(false);
  }, []);
  useEffect(() => {
    void reload();
    window.addEventListener("part-bundles-changed", reload);
    window.addEventListener("app:data-changed", reload);
    return () => {
      window.removeEventListener("part-bundles-changed", reload);
      window.removeEventListener("app:data-changed", reload);
    };
  }, [reload]);
  return { bundles, loading, reload };
}

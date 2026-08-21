import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** ข้อมูลกลางสำหรับ Dropdown ทุกหน้า (ลูกค้า / เครื่องจักร / ช่าง / รถ) */
export type DirCustomer = { name: string; phone: string; address: string };
export type DirMachine = {
  serial: string;
  label: string;
  customer: string;
  address: string;
  phone: string;
  seller: string;
};
export type Directory = {
  customers: DirCustomer[];
  machines: DirMachine[];
  staff: string[];
  vehicles: string[];
  loading: boolean;
};

const EMPTY: Directory = { customers: [], machines: [], staff: [], vehicles: [], loading: true };

let cache: Directory = EMPTY;
let inflight: Promise<void> | null = null;
const listeners = new Set<(d: Directory) => void>();

async function fetchAll() {
  const [c, m, s, v] = await Promise.all([
    supabase.from("customers").select("name, phone, address").order("name"),
    supabase
      .from("machine_units")
      .select("serial_number, seller, address_line, district, province, customers ( name, phone, address ), compressor_models ( name, brands ( name ) )")
      .order("serial_number"),
    supabase.from("service_staff").select("name").order("name"),
    supabase.from("vehicles").select("plate").order("plate"),
  ]);

  cache = {
    loading: false,
    customers: (c.data ?? []).map((r: any) => ({
      name: r.name ?? "",
      phone: r.phone ?? "",
      address: r.address ?? "",
    })),
    machines: (m.data ?? []).map((r: any) => ({
      serial: r.serial_number ?? "",
      label: [r.compressor_models?.brands?.name, r.compressor_models?.name].filter(Boolean).join(" "),
      customer: r.customers?.name ?? "",
      address:
        [r.address_line, r.district, r.province].filter(Boolean).join(" ") || (r.customers?.address ?? ""),
      phone: r.customers?.phone ?? "",
      seller: r.seller ?? "",
    })),
    staff: (s.data ?? []).map((r: any) => r.name).filter(Boolean),
    vehicles: (v.data ?? []).map((r: any) => r.plate).filter(Boolean),
  };
  listeners.forEach((fn) => fn(cache));
}

/** โหลดข้อมูลใหม่ทั้งระบบ (เรียกหลังบันทึกลูกค้า/เครื่องจักรใหม่) */
export async function refreshDirectory() {
  inflight = fetchAll().finally(() => {
    inflight = null;
  });
  await inflight;
}

export function useDirectory(): Directory {
  const [dir, setDir] = useState<Directory>(cache);

  useEffect(() => {
    listeners.add(setDir);
    if (!inflight) refreshDirectory();
    return () => {
      listeners.delete(setDir);
    };
  }, []);

  return dir;
}

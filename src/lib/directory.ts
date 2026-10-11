import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";


/** ข้อมูลกลางสำหรับ Dropdown ทุกหน้า (ลูกค้า / เครื่องจักร / ช่าง / รถ) */
export type DirCustomer = { cust_id: string; name: string; phone: string; address: string };
export type DirMachine = {
  serial: string;
  label: string;
  brand: string;
  model: string;
  customer_sn: string;
  customer: string;
  cust_id: string;
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
    supabase.from("customers").select("cust_id, name, phone, address").order("name"),
    supabase
      .from("machine_units")
      .select("serial_number, customer_sn, seller, address_line, district, province, customers ( cust_id, name, phone, address ), compressor_models ( name, brands ( name ) )")
      .order("serial_number"),
    supabase.from("service_staff").select("name").order("name"),
    supabase.from("vehicles").select("plate").order("plate"),
  ]);

  cache = {
    loading: false,
    customers: (c.data ?? []).map((r: any) => ({
      cust_id: r.cust_id ?? "",
      name: r.name ?? "",
      phone: r.phone ?? "",
      address: r.address ?? "",
    })),
    machines: (m.data ?? []).map((r: any) => ({
      serial: r.serial_number ?? "",
      label: [r.compressor_models?.brands?.name, r.compressor_models?.name].filter(Boolean).join(" "),
      brand: r.compressor_models?.brands?.name ?? "",
      model: r.compressor_models?.name ?? "",
      customer_sn: r.customer_sn ?? "",

      customer: r.customers?.name ?? "",
      cust_id: r.customers?.cust_id ?? "",
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
  inflight = fetchAll()
    .catch(() => {
      // โหลดไม่สำเร็จ — คงแคชเดิมไว้ ไม่ให้ตัวเลือกหายหรือค้าง
    })
    .finally(() => {
      inflight = null;
    });
  await inflight;
}

/**
 * ซิงก์ข้อมูลใหม่ที่ผู้ใช้พิมพ์เพิ่มในกล่องตัวเลือก กลับเข้าตารางหลักอัตโนมัติ
 * (ลูกค้า / เครื่องจักร / ช่าง / ทะเบียนรถ) แล้วรีเฟรชตัวเลือกทุกหน้า
 */
export async function ensureDirectoryEntries(input: {
  customer_name?: string | null;
  cust_id?: string | null;
  machine_label?: string | null;
  customer_address?: string | null;
  contact_phone?: string | null;
  serial_number?: string | null;
  staff_name?: string | null;
  vehicle_plate?: string | null;
}) {
  const norm = (v?: string | null) => (v ?? "").trim();
  const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const customer = norm(input.customer_name);
  const custId = norm(input.cust_id);
  const serial = norm(input.serial_number);
  const staffNames = norm(input.staff_name)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const plate = norm(input.vehicle_plate);
  let changed = false;
  let customerId: string | null = null;

  try {
    if (customer || custId) {
      // หาลูกค้าจากรหัสก่อน แล้วค่อยหาจากชื่อ (เชื่อมโยงสองทาง)
      let existing: { id: string; name: string; cust_id: string | null; phone: string | null; address: string | null } | null = null;
      if (custId) {
        const { data } = await supabase.from("customers").select("id, name, cust_id, phone, address").eq("cust_id", custId).maybeSingle();
        existing = data ?? null;
      }
      if (!existing && customer) {
        const { data } = await supabase.from("customers").select("id, name, cust_id, phone, address").ilike("name", customer).limit(1);
        existing = data?.[0] ?? null;
      }
      if (!existing && customer) {
        const { data } = await supabase
          .from("customers")
          .insert({
            name: customer,
            cust_id: custId || null,
            phone: norm(input.contact_phone) || null,
            address: norm(input.customer_address) || null,
          })
          .select("id")
          .single();
        customerId = data?.id ?? null;
        changed = true;
      } else if (existing) {
        customerId = existing.id;
        // เติมข้อมูลที่ยังว่างให้ลูกค้าเดิม (รหัส / เบอร์ / ที่อยู่)
        const patch: { cust_id?: string; phone?: string; address?: string } = {};
        if (custId && !existing.cust_id) patch.cust_id = custId;
        if (norm(input.contact_phone) && !existing.phone) patch.phone = norm(input.contact_phone);
        if (norm(input.customer_address) && !existing.address) patch.address = norm(input.customer_address);
        if (Object.keys(patch).length) {
          await supabase.from("customers").update(patch).eq("id", existing.id);
          changed = true;
        }
      }
    }

    if (serial) {
      const { data: unit } = await supabase
        .from("machine_units")
        .select("id, customer_id, model_id")
        .ilike("serial_number", serial)
        .limit(1);
      const u = unit?.[0];
      if (!u) {
        const modelId = await ensureBrandModel(input.machine_label);
        await supabase.from("machine_units").insert({ serial_number: serial, customer_id: customerId, model_id: modelId });
        changed = true;
      } else {
        // เชื่อมเครื่องเดิมกับลูกค้า/รุ่นที่ยังไม่ได้ผูก
        const patch: { customer_id?: string; model_id?: string } = {};
        if (!u.customer_id && customerId) patch.customer_id = customerId;
        if (!u.model_id) {
          const modelId = await ensureBrandModel(input.machine_label);
          if (modelId) patch.model_id = modelId;
        }
        if (Object.keys(patch).length) {
          await supabase.from("machine_units").update(patch).eq("id", u.id);
          changed = true;
        }
      }
    } else if (norm(input.machine_label)) {
      // ไม่มี S/N แต่มียี่ห้อ/รุ่นใหม่ — บันทึกยี่ห้อ/รุ่นเข้าฐานกลาง
      await ensureBrandModel(input.machine_label);
    }

    for (const staffName of staffNames) {
      if (!cache.staff.some((s) => eq(s, staffName))) {
        await supabase.from("service_staff").insert({ name: staffName });
        changed = true;
      }
    }

    if (plate && !cache.vehicles.some((v) => eq(v, plate))) {
      await supabase.from("vehicles").insert({ plate });
      changed = true;
    }
  } catch {
    // เงียบไว้ — การซิงก์ต้องไม่ทำให้การบันทึกงานหลักล้มเหลว
  }

  if (changed) await refreshDirectory();
  return changed;
}

/**
 * แยก "ยี่ห้อ รุ่น" แล้วสร้างยี่ห้อ/รุ่นใหม่ในฐานข้อมูลกลางถ้ายังไม่มี คืน model id
 * คำแรกคือยี่ห้อ ส่วนที่เหลือคือรุ่น
 */
export async function ensureBrandModel(label?: string | null): Promise<string | null> {
  const text = (label ?? "").split(",")[0].trim();
  if (!text) return null;
  const [brandName, ...rest] = text.split(/\s+/);
  const modelName = rest.join(" ").trim();
  try {
    const { data: brands } = await supabase.from("brands").select("id, name").ilike("name", brandName);
    let brandId = brands?.[0]?.id ?? null;
    if (!brandId) {
      const { data } = await supabase.from("brands").insert({ name: brandName }).select("id").single();
      brandId = data?.id ?? null;
    }
    if (!brandId || !modelName) return null;
    const { data: models } = await supabase
      .from("compressor_models")
      .select("id")
      .eq("brand_id", brandId)
      .ilike("name", modelName);
    if (models?.[0]?.id) return models[0].id;
    const { data } = await supabase
      .from("compressor_models")
      .insert({ brand_id: brandId, name: modelName })
      .select("id")
      .single();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

/** บันทึกชื่ออะไหล่ที่พิมพ์ใหม่ลงคลังอะไหล่กลาง (ถ้ายังไม่มี) */
export async function ensureParts(names: string[]) {
  const list = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  if (!list.length) return;
  try {
    const { data } = await supabase.from("products").select("name, part_number");
    const known = new Set((data ?? []).flatMap((p: any) => [String(p.name).toLowerCase(), String(p.part_number).toLowerCase()]));
    const fresh = list.filter((n) => !known.has(n.toLowerCase()));
    if (fresh.length) await supabase.from("products").insert(fresh.map((n) => ({ name: n, part_number: n })));
  } catch {
    // ไม่ให้กระทบการบันทึกหลัก
  }
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

export type DirectoryKind = "customer" | "cust_id" | "serial" | "staff" | "vehicle" | "seller";

/** แอดมินเท่านั้น: ลบรายการที่ผิดออกจากฐานข้อมูลกลาง แล้วรีเฟรชตัวเลือกทุกหน้า */
export async function deleteDirectoryEntry(kind: DirectoryKind, value: string) {
  const { deleteAsAdmin } = await import("@/lib/access");
  const { toast } = await import("sonner");
  const map: Record<DirectoryKind, [string, string]> = {
    customer: ["customers", "name"],
    cust_id: ["customers", "cust_id"],
    serial: ["machine_units", "serial_number"],
    staff: ["service_staff", "name"],
    vehicle: ["vehicles", "plate"],
    seller: ["sales_contacts", "name"],
  };
  const [table, col] = map[kind];
  const { error } = await deleteAsAdmin(table, { [col]: value });
  if (error) {
    toast.error(error.message);
    return false;
  }
  if (kind === "seller") window.dispatchEvent(new Event("sales-contacts-changed"));

  // ตัดรายการออกจากแคชทันที เพื่อให้ Dropdown ทุกจุดอัปเดตแบบเรียลไทม์โดยไม่ต้องรอโหลดใหม่
  const target = value.trim().toLowerCase();
  cache = {
    ...cache,
    customers: cache.customers.filter(
      (c) =>
        (kind !== "customer" || c.name.trim().toLowerCase() !== target) &&
        (kind !== "cust_id" || c.cust_id.trim().toLowerCase() !== target),
    ),
    machines: cache.machines.filter((m) => kind !== "serial" || m.serial.trim().toLowerCase() !== target),
    staff: kind === "staff" ? cache.staff.filter((s) => s.trim().toLowerCase() !== target) : cache.staff,
    vehicles: kind === "vehicle" ? cache.vehicles.filter((v) => v.trim().toLowerCase() !== target) : cache.vehicles,
  };
  listeners.forEach((fn) => fn(cache));

  toast.success(`ลบ "${value}" แล้ว`);
  // ซิงก์ข้อมูลจริงจากฐานข้อมูลอีกครั้งเบื้องหลัง (กันกรณีมีการลบซ้ำ/ข้อมูลเปลี่ยนจากที่อื่น)
  await refreshDirectory().catch(() => {});
  return true;
}

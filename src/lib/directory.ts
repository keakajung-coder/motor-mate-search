import { useEffect, useState } from "react";
import { supabase } from "@/lib/data-client";
import { isValueRemoved, markValueRemoved, invalidateData } from "@/lib/data-sync";

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
  district?: string;
  province?: string;
  phone: string;
  seller: string;
};

export type Directory = {
  customers: DirCustomer[];
  machines: DirMachine[];
  staff: string[];
  vehicles: string[];
  engineers: string[];
  loading: boolean;
};

const EMPTY: Directory = { customers: [], machines: [], staff: [], vehicles: [], engineers: [], loading: true };

let cache: Directory = EMPTY;
let inflight: Promise<void> | null = null;
const listeners = new Set<(d: Directory) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("engineers-changed", () => {
    void refreshDirectory();
  });
  window.addEventListener("app:data-changed", () => {
    void refreshDirectory();
  });
}

async function fetchAll() {
  const [c, m, s, v, eng] = await Promise.all([
    supabase.from("customers").select("cust_id, name, phone, address").order("name"),
    supabase
      .from("machine_units")
      .select(
        "serial_number, customer_sn, seller, address_line, district, province, customers ( cust_id, name, phone, address ), compressor_models ( name, brands ( name ) )",
      )
      .order("serial_number"),
    supabase.from("service_staff").select("name").neq("active", false).order("name"),
    supabase.from("vehicles").select("plate").neq("active", false).order("plate"),
    supabase.from("app_settings").select("value").eq("key", "engineers").maybeSingle(),
  ]);

  let engineerNames: string[] = [];
  if (eng.data?.value) {
    try {
      const parsed = JSON.parse(eng.data.value);
      if (Array.isArray(parsed)) {
        engineerNames = parsed
          .map((item: any) =>
            typeof item === "string" ? item : item?.active !== false ? item?.name : null,
          )
          .filter(Boolean)
          .map((s: string) => String(s).trim())
          .filter(Boolean);
      }
    } catch {}
  }

  cache = {
    loading: false,
    customers: (c.data ?? [])
      .map((r: any) => ({
        cust_id: r.cust_id ?? "",
        name: r.name ?? "",
        phone: r.phone ?? "",
        address: r.address ?? "",
      }))
      .filter((cust) => !isValueRemoved(cust.name) && !isValueRemoved(cust.cust_id)),
    machines: (m.data ?? [])
      .map((r: any) => ({
        serial: r.serial_number ?? "",
        label: [r.compressor_models?.brands?.name, r.compressor_models?.name]
          .filter(Boolean)
          .join(" "),
        brand: r.compressor_models?.brands?.name ?? "",
        model: r.compressor_models?.name ?? "",
        customer_sn: r.customer_sn ?? "",
        customer: r.customers?.name ?? "",
        cust_id: r.customers?.cust_id ?? "",
        address:
          [r.address_line, r.district, r.province].filter(Boolean).join(" ") ||
          (r.customers?.address ?? ""),
        district: r.district ?? "",
        province: r.province ?? "",
        phone: r.customers?.phone ?? "",
        seller: r.seller ?? "",
      }))
      .filter((mach) => !isValueRemoved(mach.serial)),
    staff: (s.data ?? []).map((r: any) => r.name).filter((name) => Boolean(name) && !isValueRemoved(name)),
    vehicles: (v.data ?? []).map((r: any) => r.plate).filter((plate) => Boolean(plate) && !isValueRemoved(plate)),
    engineers: engineerNames.filter((name) => !isValueRemoved(name)),
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
      let existing: {
        id: string;
        name: string;
        cust_id: string | null;
        phone: string | null;
        address: string | null;
      } | null = null;
      if (custId) {
        const { data } = await supabase
          .from("customers")
          .select("id, name, cust_id, phone, address")
          .eq("cust_id", custId)
          .maybeSingle();
        existing = data ?? null;
      }
      if (!existing && customer) {
        const { data } = await supabase
          .from("customers")
          .select("id, name, cust_id, phone, address")
          .ilike("name", customer)
          .limit(1);
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
        if (norm(input.customer_address) && !existing.address)
          patch.address = norm(input.customer_address);
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
        await supabase
          .from("machine_units")
          .insert({ serial_number: serial, customer_id: customerId, model_id: modelId });
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
    const { data: brands } = await supabase
      .from("brands")
      .select("id, name")
      .ilike("name", brandName);
    let brandId = brands?.[0]?.id ?? null;
    if (!brandId) {
      const { data } = await supabase
        .from("brands")
        .insert({ name: brandName })
        .select("id")
        .single();
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
    const known = new Set(
      (data ?? []).flatMap((p: any) => [
        String(p.name).toLowerCase(),
        String(p.part_number).toLowerCase(),
      ]),
    );
    const fresh = list.filter((n) => !known.has(n.toLowerCase()));
    if (fresh.length)
      await supabase.from("products").insert(fresh.map((n) => ({ name: n, part_number: n })));
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

export type DirectoryKind =
  | "customer"
  | "cust_id"
  | "serial"
  | "staff"
  | "vehicle"
  | "seller"
  | "engineer";

/** แอดมินเท่านั้น: ลบรายการที่ผิดออกจากฐานข้อมูลกลาง แล้วรีเฟรชตัวเลือกทุกหน้า */
export async function deleteDirectoryEntry(kind: DirectoryKind, value: string) {
  const { deleteAsAdmin } = await import("@/lib/access");
  const { toast } = await import("sonner");
  if (kind === "staff") {
    // Soft Delete: ตั้งค่า active = false เพื่อรักษาประวัติการปฏิบัติงานและวันลาย้อนหลัง
    const { error } = await supabase
      .from("service_staff")
      .update({ active: false })
      .eq("name", value);
    if (error) {
      toast.error(error.message);
      return false;
    }
    const { logAudit } = await import("@/lib/audit");
    await logAudit({
      table: "service_staff",
      action: "soft_delete",
      summary: `ลบพนักงาน/ช่าง (Soft Delete: active = false): ${value}`,
      changes: { name: value, active: false },
    });
    window.dispatchEvent(new Event("service-staff-changed"));
  } else if (kind === "engineer") {
    const { loadEngineers, removeEngineer } = await import("@/lib/engineers");
    const list = await loadEngineers(true);
    const target = list.find((e) => e.name.trim().toLowerCase() === value.trim().toLowerCase());
    if (target) {
      const res = await removeEngineer(target.id);
      if (!res.success) {
        toast.error(res.error || "ลบวิศวกรไม่สำเร็จ");
        return false;
      }
    }
  } else {
    const map: Record<Exclude<DirectoryKind, "staff" | "engineer">, [string, string]> = {
      customer: ["customers", "name"],
      cust_id: ["customers", "cust_id"],
      serial: ["machine_units", "serial_number"],
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
  }

  // ตัดรายการออกจากแคชทันที เพื่อให้ Dropdown ทุกจุดอัปเดตแบบเรียลไทม์โดยไม่ต้องรอโหลดใหม่
  markValueRemoved(value);
  const target = value.trim().toLowerCase();
  cache = {
    ...cache,
    customers: cache.customers.filter(
      (c) =>
        (kind !== "customer" || c.name.trim().toLowerCase() !== target) &&
        (kind !== "cust_id" || c.cust_id.trim().toLowerCase() !== target),
    ),
    machines: cache.machines.filter(
      (m) => kind !== "serial" || m.serial.trim().toLowerCase() !== target,
    ),
    staff:
      kind === "staff" ? cache.staff.filter((s) => s.trim().toLowerCase() !== target) : cache.staff,
    vehicles:
      kind === "vehicle"
        ? cache.vehicles.filter((v) => v.trim().toLowerCase() !== target)
        : cache.vehicles,
    engineers:
      kind === "engineer"
        ? cache.engineers.filter((e) => e.trim().toLowerCase() !== target)
        : cache.engineers,
  };
  listeners.forEach((fn) => fn(cache));

  toast.success(`ลบ "${value}" แล้ว`);
  const tablesToInvalidate = ["directory"];
  if (kind === "staff") tablesToInvalidate.push("service_staff");
  if (kind === "vehicle") tablesToInvalidate.push("vehicles");
  if (kind === "engineer") tablesToInvalidate.push("engineers");
  if (kind === "seller") tablesToInvalidate.push("sellers", "sales_contacts");
  if (kind === "customer" || kind === "cust_id") tablesToInvalidate.push("customers");
  if (kind === "serial") tablesToInvalidate.push("machine_units");
  invalidateData(tablesToInvalidate);

  try {
    const { getQueryClient, QUERY_KEYS } = await import("@/lib/query-client");
    const qc = getQueryClient();
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.directory });
    if (kind === "staff") void qc.invalidateQueries({ queryKey: QUERY_KEYS.staff });
    if (kind === "vehicle") void qc.invalidateQueries({ queryKey: QUERY_KEYS.vehicles });
    if (kind === "engineer") void qc.invalidateQueries({ queryKey: QUERY_KEYS.engineers });
    if (kind === "seller") {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.sellers });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.salesContacts });
    }
    if (kind === "customer" || kind === "cust_id") void qc.invalidateQueries({ queryKey: QUERY_KEYS.customers });
    if (kind === "serial") void qc.invalidateQueries({ queryKey: QUERY_KEYS.machines });
  } catch {
    /* ignore */
  }

  // ซิงก์ข้อมูลจริงจากฐานข้อมูลอีกครั้งเบื้องหลัง (กันกรณีมีการลบซ้ำ/ข้อมูลเปลี่ยนจากที่อื่น)
  await refreshDirectory().catch(() => {});
  return true;
}

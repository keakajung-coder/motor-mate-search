import { supabase } from "@/lib/data-client";
import { parseAttachments, type JobAttachment } from "@/components/JobAttachments";
import { listContracts } from "@/lib/contracts.functions";

export type MachineHistoryUnit = {
  id: string;
  serial_number: string;
  customer_sn?: string | null;
  install_date?: string | null;
  daily_hours?: number | null;
  note?: string | null;
  site_name?: string | null;
  address_line?: string | null;
  district?: string | null;
  province?: string | null;
  seller?: string | null;
  status?: string | null;
  data_complete?: boolean;
  warranty_end?: string | null;
  contract_service?: boolean;
  customers?: {
    id: string;
    cust_id?: string | null;
    name: string;
    phone?: string | null;
    address?: string | null;
  } | null;
  compressor_models?: {
    id: string;
    name: string;
    pump_type?: string | null;
    brands?: {
      id: string;
      name: string;
    } | null;
  } | null;
  machine_parts?: Array<{
    id: string;
    quantity?: number | null;
    note?: string | null;
    hours_used?: number | null;
    last_changed_at?: string | null;
    service_interval_hours?: number | null;
    products?: {
      id: string;
      name: string;
      part_number: string;
      price?: number | null;
      image_url?: string | null;
      storage_location?: string | null;
      service_interval_hours?: number | null;
      stock_quantity?: number | null;
      categories?: {
        id: string;
        name: string;
        sort_order?: number | null;
      } | null;
    } | null;
  }> | null;
};

export type TimelineEvent = {
  id: string;
  source: "appointment" | "maintenance_log" | "contract_visit";
  date: string; // ISO yyyy-mm-dd
  time?: string | null;
  service_type: string;
  staff_name: string;
  vehicle_plate?: string | null;
  status: string;
  result?: "ok" | "not_ok" | null;
  job_detail: string;
  close_note?: string | null;
  parts_replaced?: string | null;
  parts_note?: string | null;
  attachments: JobAttachment[];
  job_no?: string | null;
  checklistSummary?: {
    totalItems: number;
    passedItems: number;
    failedItems: number;
  } | null;
  rawAppointment?: any | null;
};

export type WarrantyStatus = {
  hasWarranty: boolean;
  warrantyEnd: string | null;
  isExpired: boolean;
  daysRemaining: number;
  label: string;
};

export type ServiceContractSummary = {
  hasContract: boolean;
  activeContract: any | null;
  totalVisits: number;
  doneVisits: number;
  nextVisitDate: string | null;
  allContracts: any[];
};

export type MachineHistoryData = {
  unit: MachineHistoryUnit;
  warranty: WarrantyStatus;
  contract: ServiceContractSummary;
  timeline: TimelineEvent[];
};

function calculateWarranty(warrantyEnd?: string | null): WarrantyStatus {
  if (!warrantyEnd) {
    return {
      hasWarranty: false,
      warrantyEnd: null,
      isExpired: false,
      daysRemaining: 0,
      label: "ไม่มีข้อมูลรับประกัน",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(warrantyEnd);
  end.setHours(0, 0, 0, 0);

  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays >= 0) {
    return {
      hasWarranty: true,
      warrantyEnd,
      isExpired: false,
      daysRemaining: diffDays,
      label: diffDays === 0 ? "หมดประกันวันนี้" : `อยู่ในประกัน (เหลืออีก ${diffDays} วัน)`,
    };
  } else {
    return {
      hasWarranty: true,
      warrantyEnd,
      isExpired: true,
      daysRemaining: diffDays,
      label: `หมดประกันแล้ว (${Math.abs(diffDays)} วันที่แล้ว)`,
    };
  }
}

/**
 * โหลดข้อมูลแฟ้มประวัติเครื่องจักรครบวงจร (Digital Passport & Maintenance Timeline)
 */
export async function fetchMachineHistory({
  machineUnitId,
  serialNumber,
}: {
  machineUnitId?: string | null;
  serialNumber?: string | null;
}): Promise<MachineHistoryData | null> {
  const cleanSn = (serialNumber ?? "").trim();
  const cleanId = (machineUnitId ?? "").trim();

  if (!cleanSn && !cleanId) return null;

  // 1. ดึงข้อมูลเครื่องจักรหลัก
  let unitQuery = supabase
    .from("machine_units")
    .select(
      `id, serial_number, customer_sn, install_date, daily_hours, note,
       site_name, address_line, district, province, seller, status, data_complete,
       warranty_end, contract_service,
       customers ( id, cust_id, name, phone, address ),
       compressor_models ( id, name, pump_type, brands ( id, name ) ),
       machine_parts (
         id, quantity, note, hours_used, last_changed_at, service_interval_hours,
         products (
           id, name, part_number, price, image_url, storage_location,
           service_interval_hours, stock_quantity,
           categories ( id, name, sort_order )
         )
       )`,
    );

  if (cleanId) {
    unitQuery = unitQuery.eq("id", cleanId);
  } else {
    unitQuery = unitQuery.eq("serial_number", cleanSn);
  }

  const { data: unitData, error: unitError } = await unitQuery.maybeSingle();
  if (unitError || !unitData) {
    return null;
  }

  const unit = unitData as unknown as MachineHistoryUnit;
  const targetId = unit.id;
  const targetSn = unit.serial_number;

  // 2. ดึงข้อมูลนัดหมายและประวัติงานบริการ (appointments)
  const [apptsRes, logsRes, contractsRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("*")
      .or(`machine_unit_id.eq.${targetId},serial_number.eq.${targetSn}`)
      .order("visit_date", { ascending: false }),
    supabase
      .from("maintenance_logs")
      .select("*")
      .or(`machine_unit_id.eq.${targetId},serial_number.eq.${targetSn}`)
      .order("done_date", { ascending: false }),
    listContracts({ data: { machineUnitId: targetId } }).catch(() => ({ contracts: [] })),
  ]);

  const apptRows = (apptsRes.data ?? []) as any[];
  const logRows = (logsRes.data ?? []) as any[];
  const contractsList = (contractsRes?.contracts ?? []) as any[];

  // 3. รวมเหตุการณ์ Timeline
  const timeline: TimelineEvent[] = [];
  const processedApptIds = new Set<string>();

  // เพิ่มข้อมูลจาก Appointments (ระบบหลัก)
  for (const a of apptRows) {
    processedApptIds.add(a.id);
    const atts = parseAttachments(a.attachments);

    let checklistSummary: TimelineEvent["checklistSummary"] = null;
    if (a.checklist && typeof a.checklist === "object") {
      const items = (a.checklist as any).items;
      if (Array.isArray(items)) {
        let passed = 0;
        let failed = 0;
        for (const it of items) {
          if (it.status === "pass" || it.status === "ok") passed++;
          else if (it.status === "fail" || it.status === "bad") failed++;
        }
        checklistSummary = {
          totalItems: items.length,
          passedItems: passed,
          failedItems: failed,
        };
      }
    }

    timeline.push({
      id: `appt-${a.id}`,
      source: "appointment",
      date: a.visit_date || a.closed_at?.slice(0, 10) || a.created_at?.slice(0, 10) || "",
      time: a.visit_time || null,
      service_type: a.service_type || "บริการทั่วไป",
      staff_name: a.staff_name || "ไม่ระบุช่าง",
      vehicle_plate: a.vehicle_plate || null,
      status: a.status || "closed",
      result: (a.result as "ok" | "not_ok" | null) ?? null,
      job_detail: a.job_detail || "",
      close_note: a.close_note || null,
      parts_replaced: a.parts_replaced || null,
      parts_note: a.parts_note || null,
      attachments: atts,
      job_no: a.job_no || null,
      checklistSummary,
      rawAppointment: a,
    });
  }

  // เพิ่มข้อมูลจาก Maintenance Logs (บันทึกประวัติซ่อมแบบแยกส่วน/ดั้งเดิม)
  for (const l of logRows) {
    // ถ้า log นี้ผูกกับ appointment ที่โหลดมาแล้ว ให้ข้ามเพื่อไม่ให้ซ้ำซ้อน
    if (l.appointment_id && processedApptIds.has(l.appointment_id)) {
      continue;
    }

    timeline.push({
      id: `log-${l.id}`,
      source: "maintenance_log",
      date: l.done_date || l.created_at?.slice(0, 10) || "",
      time: null,
      service_type: l.service_type || "ประวัติซ่อมบำรุง",
      staff_name: "บันทึกประวัติเครื่อง",
      status: "closed",
      result: (l.result as "ok" | "not_ok" | null) ?? "ok",
      job_detail: l.job_detail || "",
      close_note: l.note || null,
      attachments: [],
      rawAppointment: {
        id: l.id,
        serial_number: targetSn,
        visit_date: l.done_date,
        service_type: l.service_type,
        job_detail: l.job_detail,
        result: l.result,
        close_note: l.note,
        customer_name: unit.customers?.name,
        cust_id: unit.customers?.cust_id,
        machine_label: unit.compressor_models?.name,
      },
    });
  }

  // เพิ่มข้อมูลงวดสัญญาบริการที่มีการวางแผนไว้แล้วในอนาคต (Scheduled Visits)
  for (const c of contractsList) {
    if (!c.active) continue;
    const visits = (c.service_contract_visits ?? []) as any[];
    for (const v of visits) {
      // ถ้างวดนี้ยังไม่เสร็จ (รอเข้าบริการ) และยังไม่มี appointment ตรงวัน ให้ขึ้นเป็น timeline นัดหมาย
      if (v.status !== "done" && v.visit_date) {
        const hasMatchingAppt = timeline.some((t) => t.date === v.visit_date);
        if (!hasMatchingAppt) {
          timeline.push({
            id: `contract-visit-${v.id}`,
            source: "contract_visit",
            date: v.visit_date,
            time: v.visit_time || null,
            service_type: `สัญญาบริการรายปี (งวดที่ ${v.visit_no})`,
            staff_name: "งวดตามสัญญา",
            status: "scheduled",
            job_detail: v.job_detail || `งวดเข้าบริการที่ ${v.visit_no} ตามสัญญาบริการ`,
            parts_note: v.parts_note || null,
            attachments: [],
          });
        }
      }
    }
  }

  // เรียงลำดับจากวันที่ล่าสุด -> อดีต
  timeline.sort((a, b) => {
    const da = a.date || "1970-01-01";
    const db = b.date || "1970-01-01";
    if (da !== db) return db.localeCompare(da);
    return (b.time || "").localeCompare(a.time || "");
  });

  // 4. สรุปข้อมูลสัญญาและประกัน
  const activeContract = contractsList.find((c) => c.active) ?? contractsList[0] ?? null;
  let totalVisits = 0;
  let doneVisits = 0;
  let nextVisitDate: string | null = null;

  if (activeContract) {
    const visits = (activeContract.service_contract_visits ?? []) as any[];
    totalVisits = visits.length || activeContract.visits_per_year || 0;
    doneVisits = visits.filter((v) => v.status === "done").length;
    const futureVisits = visits
      .filter((v) => v.status !== "done" && v.visit_date)
      .sort((a, b) => a.visit_date.localeCompare(b.visit_date));
    nextVisitDate = futureVisits[0]?.visit_date ?? null;
  }

  const warranty = calculateWarranty(unit.warranty_end);
  const contract: ServiceContractSummary = {
    hasContract: Boolean(activeContract || unit.contract_service),
    activeContract,
    totalVisits,
    doneVisits,
    nextVisitDate,
    allContracts: contractsList,
  };

  return {
    unit,
    warranty,
    contract,
    timeline,
  };
}

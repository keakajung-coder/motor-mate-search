import { createServerFn } from "@tanstack/react-start";
import { contractJobStatus } from "@/lib/contract-job-policy";

export type ContractVisitInput = {
  id?: string | null;
  appointment_id?: string | null;
  visit_no: number;
  visit_date: string;
  visit_time?: string | null;
  job_detail?: string | null;
  parts_note?: string | null;
  status?: string | null;
  vehicle_plate?: string | null;
  zone_signature?: string;
};

export type ContractInput = {
  id?: string | null;
  customer_id?: string | null;
  customer_name: string;
  machine_unit_id?: string | null;
  serial_number?: string | null;
  machine_label?: string | null;
  visits_per_year: number;
  start_date: string;
  note?: string | null;
  active?: boolean;
  visits: ContractVisitInput[];
};

async function adminCtx() {
  const { requireAccess } = await import("./access-session.server");
  await requireAccess("admin");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function viewerCtx() {
  const { requireAccess } = await import("./access-session.server");
  await requireAccess("viewer");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** อ่านรายการสัญญา (viewer อ่านได้) */
export const listContracts = createServerFn({ method: "POST" })
  .inputValidator((d: { machineUnitId?: string | null }) => d)
  .handler(async ({ data }) => {
    const supabaseAdmin = await viewerCtx();
    let q = supabaseAdmin
      .from("service_contracts")
      .select("*, service_contract_visits(*, appointments(vehicle_plate))")
      .order("created_at", { ascending: false });
    if (data.machineUnitId) q = q.eq("machine_unit_id", data.machineUnitId);
    const { data: rows, error } = await q;
    if (error) throw new Error("โหลดข้อมูลสัญญาไม่สำเร็จ");

    const normalized = (rows ?? []).map((c: any) => ({
      ...c,
      service_contract_visits: (c.service_contract_visits ?? []).map((v: any) => ({
        ...v,
        vehicle_plate: v.vehicle_plate || v.appointments?.vehicle_plate || null,
      })),
    }));

    return { contracts: normalized };
  });

/** บันทึกสัญญา + งวดบริการ แล้วซิงค์นัดหมายลงแพลนเนอร์ทันที (แอดมินเท่านั้น) */
export const saveContract = createServerFn({ method: "POST" })
  .inputValidator((d: ContractInput) => d)
  .handler(async ({ data }) => {
    const supabaseAdmin = await adminCtx();
    const customerName = (data.customer_name ?? "").trim();
    if (!customerName) throw new Error("กรุณาระบุชื่อลูกค้า");
    if (!DATE_RE.test(data.start_date ?? "")) throw new Error("วันเริ่มสัญญาไม่ถูกต้อง");
    const visits = (data.visits ?? [])
      .filter((v) => DATE_RE.test(v.visit_date ?? ""))
      .map((v, i) => ({ ...v, visit_no: i + 1 }));
    if (visits.length === 0) throw new Error("กรุณากำหนดงวดเข้าบริการอย่างน้อย 1 ครั้ง");
    const { reviewVehicleZone } = await import("./vehicle-zone.server");
    const approvals = new Map<number, { signature: string; conflicts: unknown; approved_at: string; approved_by: string } | null>();
    for (const v of visits) {
      const review = await reviewVehicleZone(supabaseAdmin, { id: v.appointment_id, customer_name: customerName, serial_number: data.serial_number, visit_date: v.visit_date, vehicle_plate: v.vehicle_plate });
      if (review.conflicts.length && v.zone_signature !== review.signature) throw new Error("รถมีงานข้ามโซน กรุณาอนุมัติหรือย้ายรถก่อนบันทึกสัญญา");
      approvals.set(v.visit_no, review.conflicts.length ? { signature: review.signature, conflicts: review.conflicts, approved_at: new Date().toISOString(), approved_by: "admin" } : null);
    }

    const payload = {
      customer_id: data.customer_id ?? null,
      customer_name: customerName,
      machine_unit_id: data.machine_unit_id ?? null,
      serial_number: data.serial_number ?? null,
      machine_label: data.machine_label ?? null,
      visits_per_year: Math.max(1, Math.min(52, Math.floor(data.visits_per_year) || visits.length)),
      start_date: data.start_date,
      note: data.note ?? null,
      active: data.active ?? true,
    };

    let contractId = data.id ?? null;
    if (contractId) {
      const { error } = await supabaseAdmin.from("service_contracts").update(payload).eq("id", contractId);
      if (error) throw new Error("บันทึกสัญญาไม่สำเร็จ");
    } else {
      const { data: inserted, error } = await supabaseAdmin.from("service_contracts").insert(payload).select("id").single();
      if (error || !inserted) throw new Error("สร้างสัญญาไม่สำเร็จ");
      contractId = inserted.id;
    }

    // งวดเดิมที่ถูกตัดออก (เกินจำนวนครั้งใหม่) และยังไม่ปิดงาน → ลบพร้อมนัดหมายที่ผูกไว้
    const { data: existing } = await supabaseAdmin
      .from("service_contract_visits")
      .select("id, visit_no, appointment_id, work_order_id, status")
      .eq("contract_id", contractId);
    const keepNos = new Set(visits.map((v) => v.visit_no));
    for (const old of existing ?? []) {
      if (keepNos.has(old.visit_no)) continue;
      if (old.status === "done" || old.work_order_id) continue; // เก็บประวัติงวดที่ทำไปแล้ว
      if (old.appointment_id) await supabaseAdmin.from("appointments").delete().eq("id", old.appointment_id);
      await supabaseAdmin.from("service_contract_visits").delete().eq("id", old.id);
    }

    // ซิงค์แต่ละงวด → นัดหมายในแพลนเนอร์
    for (const v of visits) {
      const { data: oldVisit } = await supabaseAdmin
        .from("service_contract_visits")
        .select("id, appointment_id, work_order_id, status")
        .eq("contract_id", contractId)
        .eq("visit_no", v.visit_no)
        .maybeSingle();

      if (oldVisit?.status === "done") continue; // งวดที่ปิดงานแล้วไม่แตะต้อง

      // สถานะเริ่มต้นของงวดที่สร้างอัตโนมัติเป็น "unscheduled" (ยังไม่ได้นัดหมาย)
      const targetStatus = v.status || oldVisit?.status || "unscheduled";

      const appointmentId = oldVisit?.appointment_id ?? null;

      const visitRow: any = {
        contract_id: contractId,
        visit_no: v.visit_no,
        visit_date: v.visit_date,
        visit_time: v.visit_time ?? null,
        job_detail: v.job_detail ?? null,
        parts_note: v.parts_note ?? null,
        appointment_id: appointmentId,
        status: targetStatus,
        vehicle_plate: v.vehicle_plate ?? null,
      };
      const result = oldVisit?.id
        ? await supabaseAdmin.from("service_contract_visits").update(visitRow).eq("id", oldVisit.id)
        : await supabaseAdmin.from("service_contract_visits").insert(visitRow);
      if (result.error) throw new Error("บันทึกงวดบริการไม่สำเร็จ");
    }

    const { error: syncError } = await supabaseAdmin.rpc("sync_contract_jobs", { p_contract_id: contractId, p_due_only: false });
    if (syncError) throw new Error("บันทึกสัญญาแล้ว แต่สร้างใบงานไม่สำเร็จ กรุณาลองบันทึกอีกครั้ง");
    const { data: linkedVisits, error: linkedError } = await supabaseAdmin.from("service_contract_visits").select("visit_no, appointment_id, work_order_id, status").eq("contract_id", contractId);
    if (linkedError) throw new Error("อ่านใบงานที่เชื่อมสัญญาไม่สำเร็จ");
    for (const linked of linkedVisits ?? []) {
      if (linked.status === "done" || linked.status === "closed") continue;
      const approval = approvals.get(linked.visit_no) ?? null;
      if (linked.appointment_id) {
        const { error } = await supabaseAdmin.from("appointments").update({ cross_zone_approval: approval as never }).eq("id", linked.appointment_id);
        if (error) throw new Error("บันทึกผลตรวจโซนรถไม่สำเร็จ");
      }
      if (linked.work_order_id) {
        const { error } = await supabaseAdmin.from("work_orders").update({ cross_zone_approval: approval as never }).eq("id", linked.work_order_id);
        if (error) throw new Error("บันทึกผลตรวจโซนรถในใบงานไม่สำเร็จ");
      }
    }

    return { ok: true as const, id: contractId };
  });

/** อัปเดต เปลี่ยนแปลง หรือสลับทะเบียนรถของงวดสัญญาได้ตลอดเวลา (Fully Editable) */
export const updateContractVisitVehicle = createServerFn({ method: "POST" })
  .inputValidator((d: { visitId?: string | null; appointmentId?: string | null; vehiclePlate: string | null; zoneSignature?: string }) => d)
  .handler(async ({ data }) => {
    const supabaseAdmin = await adminCtx();
    const plate = data.vehiclePlate?.trim() || null;

    if (data.appointmentId) {
      const { data: job, error: readError } = await supabaseAdmin.from("appointments").select("*").eq("id", data.appointmentId).single();
      if (readError || !job) throw new Error("ไม่พบงานที่ต้องการเปลี่ยนรถ");
      const { reviewVehicleZone } = await import("./vehicle-zone.server");
      const review = await reviewVehicleZone(supabaseAdmin, { ...job, vehicle_plate: plate });
      if (review.conflicts.length && data.zoneSignature !== review.signature) throw new Error("รถมีงานข้ามโซน กรุณาอนุมัติหรือย้ายรถก่อน");
      const { error } = await supabaseAdmin.from("appointments").update({ vehicle_plate: plate, cross_zone_approval: review.conflicts.length ? { ...review, approved_at: new Date().toISOString(), approved_by: "admin" } : null }).eq("id", data.appointmentId);
      if (error) throw new Error("เปลี่ยนรถไม่สำเร็จ");
    }

    if (data.visitId) {
      try {
        await supabaseAdmin.from("service_contract_visits").update({ vehicle_plate: plate }).eq("id", data.visitId);
      } catch {
        /* fallback if column is not yet present */
      }
    }

    return { ok: true as const, vehiclePlate: plate };
  });

/** สลับสถานะงวดระหว่าง unscheduled กับ scheduled (ยืนยันนัดหมาย) */
export const toggleContractVisitConfirm = createServerFn({ method: "POST" })
  .inputValidator((d: { appointmentId?: string | null; visitId?: string | null; confirmed: boolean }) => d)
  .handler(async ({ data }) => {
    const supabaseAdmin = await adminCtx();
    const nextStatus = data.confirmed ? "scheduled" : "unscheduled";
    const jobStatus = contractJobStatus(nextStatus);
    let query = supabaseAdmin.from("service_contract_visits").select("id, appointment_id, work_order_id, status");
    if (data.appointmentId) query = query.eq("appointment_id", data.appointmentId);
    else if (data.visitId) query = query.eq("id", data.visitId);
    else throw new Error("กรุณาระบุงวดบริการ");
    const { data: rows, error: readError } = await query;
    if (readError || !rows?.length) throw new Error("ไม่พบงวดบริการ");
    for (const row of rows) {
      if (row.status === "done" || row.status === "closed") throw new Error("งวดนี้ปิดงานแล้ว");
      const result = await supabaseAdmin.from("service_contract_visits").update({ status: nextStatus }).eq("id", row.id);
      if (result.error) throw new Error("ยืนยันนัดหมายไม่สำเร็จ");
      if (row.appointment_id) {
        const result = await supabaseAdmin.from("appointments").update({ status: jobStatus }).eq("id", row.appointment_id);
        if (result.error) throw new Error("อัปเดตนัดหมายไม่สำเร็จ");
      }
      if (row.work_order_id) {
        const result = await supabaseAdmin.from("work_orders").update({ status: jobStatus }).eq("id", row.work_order_id);
        if (result.error) throw new Error("อัปเดตใบงานไม่สำเร็จ");
      }
    }

    return { ok: true as const, status: nextStatus };
  });

/** ยกเลิกสัญญา (ปิดการใช้งาน ไม่ลบประวัติ) */
export const deactivateContract = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const supabaseAdmin = await adminCtx();
    const { error } = await supabaseAdmin.from("service_contracts").update({ active: false }).eq("id", data.id);
    if (error) throw new Error("ยกเลิกสัญญาไม่สำเร็จ");
    return { ok: true as const };
  });

/**
 * งวดที่ถึงกำหนด (วันที่ <= วันนี้) และยังไม่มีใบงาน → สร้างใบสั่งงานอัตโนมัติ
 * เรียกตอนโหลดหน้าแพลนเนอร์/หน้าเครื่องจักร (idempotent, ไม่รับข้อมูลจากผู้ใช้)
 */
export const generateDueWorkOrders = createServerFn({ method: "POST" }).handler(async () => {
  const supabaseAdmin = await viewerCtx();
  const { data, error } = await supabaseAdmin.rpc("sync_contract_jobs", { p_due_only: true });
  if (error) throw new Error("สร้างใบงานตามสัญญาไม่สำเร็จ กรุณาลองใหม่");
  const result = data as { created?: number; linked?: number } | null;
  return { created: result?.created ?? 0, linked: result?.linked ?? 0 };
});

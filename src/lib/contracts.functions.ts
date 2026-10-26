import { createServerFn } from "@tanstack/react-start";
import { autoContractJobNo } from "@/lib/contract-schedule";

export type ContractVisitInput = {
  visit_no: number;
  visit_date: string;
  visit_time?: string | null;
  job_detail?: string | null;
  parts_note?: string | null;
  status?: string | null;
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
      .select("*, service_contract_visits(*)")
      .order("created_at", { ascending: false });
    if (data.machineUnitId) q = q.eq("machine_unit_id", data.machineUnitId);
    const { data: rows, error } = await q;
    if (error) throw new Error("โหลดข้อมูลสัญญาไม่สำเร็จ");
    return { contracts: rows ?? [] };
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

      const apptPayload = {
        customer_name: customerName,
        machine_label: data.machine_label ?? null,
        serial_number: data.serial_number ?? null,
        machine_unit_id: data.machine_unit_id ?? null,
        job_detail: v.job_detail ?? null,
        parts_note: v.parts_note ?? null,
        service_type: "เช็กระยะตามสัญญา",
        billing_type: "ในสัญญาบริการ",
        visit_date: v.visit_date,
        visit_time: v.visit_time ?? null,
        status: targetStatus,
      };

      let appointmentId = oldVisit?.appointment_id ?? null;
      if (appointmentId) {
        await supabaseAdmin.from("appointments").update(apptPayload).eq("id", appointmentId);
      } else {
        const { data: appt } = await supabaseAdmin.from("appointments").insert(apptPayload).select("id").single();
        appointmentId = appt?.id ?? null;
      }

      const visitRow = {
        contract_id: contractId,
        visit_no: v.visit_no,
        visit_date: v.visit_date,
        visit_time: v.visit_time ?? null,
        job_detail: v.job_detail ?? null,
        parts_note: v.parts_note ?? null,
        appointment_id: appointmentId,
        status: targetStatus,
      };
      if (oldVisit?.id) {
        await supabaseAdmin.from("service_contract_visits").update(visitRow).eq("id", oldVisit.id);
      } else {
        await supabaseAdmin.from("service_contract_visits").insert(visitRow);
      }
    }

    return { ok: true as const, id: contractId };
  });

/** สลับสถานะงวดระหว่าง unscheduled กับ scheduled (ยืนยันนัดหมาย) */
export const toggleContractVisitConfirm = createServerFn({ method: "POST" })
  .inputValidator((d: { appointmentId?: string | null; visitId?: string | null; confirmed: boolean }) => d)
  .handler(async ({ data }) => {
    const supabaseAdmin = await adminCtx();
    const nextStatus = data.confirmed ? "scheduled" : "unscheduled";

    if (data.appointmentId) {
      await supabaseAdmin.from("appointments").update({ status: nextStatus }).eq("id", data.appointmentId);
      await supabaseAdmin.from("service_contract_visits").update({ status: nextStatus }).eq("appointment_id", data.appointmentId);
    } else if (data.visitId) {
      const { data: v } = await supabaseAdmin
        .from("service_contract_visits")
        .update({ status: nextStatus })
        .eq("id", data.visitId)
        .select("appointment_id")
        .single();
      if (v?.appointment_id) {
        await supabaseAdmin.from("appointments").update({ status: nextStatus }).eq("id", v.appointment_id);
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
  const today = new Date().toISOString().slice(0, 10);
  const { data: due, error } = await supabaseAdmin
    .from("service_contract_visits")
    .select("id, visit_no, visit_date, visit_time, job_detail, parts_note, status, service_contracts!inner(id, customer_id, customer_name, machine_unit_id, serial_number, machine_label, active)")
    .is("work_order_id", null)
    .in("status", ["scheduled", "unscheduled"])
    .eq("service_contracts.active", true)
    .lte("visit_date", today)
    .limit(50);
  if (error) return { created: 0 };

  let created = 0;
  for (const v of due ?? []) {
    const c = (v as unknown as { service_contracts: { customer_name: string; machine_label: string | null; serial_number: string | null } }).service_contracts;
    const { data: wo, error: insErr } = await supabaseAdmin
      .from("work_orders")
      .insert({
        job_no: autoContractJobNo(),
        customer_name: c.customer_name,
        machine_label: c.machine_label,
        serial_number: c.serial_number,
        job_detail: v.job_detail ?? `บริการตามสัญญารายปี ครั้งที่ ${v.visit_no}`,
        service_type: "เช็กระยะตามสัญญา",
        billing_type: "ในสัญญาบริการ",
        visit_date: v.visit_date,
        visit_time: v.visit_time,
        status: "pending",
      })
      .select("id")
      .single();
    if (insErr || !wo) continue;
    await supabaseAdmin.from("service_contract_visits").update({ work_order_id: wo.id }).eq("id", v.id);
    created++;
  }
  return { created };
});

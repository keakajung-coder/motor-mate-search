import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { MultiCombobox, splitNames, joinNames } from "@/components/ui/multi-combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ClipboardPlus, Loader2 } from "lucide-react";
import { ensureDirectoryEntries, refreshDirectory, useDirectory } from "@/lib/directory";
import { BILLING_TYPES, PRIORITIES, SAFETY_GEAR, WORK_TYPES } from "@/lib/job-fields";

export const SERVICE_TYPES = [
  "เช็กระยะ (PM)",
  "ซ่อมเครื่อง",
  "ติดตั้งเครื่องใหม่",
  "ตรวจเช็กหน้างาน",
  "เปลี่ยนอะไหล่",
  "เคลมประกัน",
  "อื่นๆ",
];

export type WorkOrderDraft = {
  customer_name: string;
  customer_address: string;
  contact_name: string;
  contact_phone: string;
  machine_label: string;
  serial_number: string;
  job_detail: string;
  service_type: string;
  visit_date: string;
  visit_time: string;
  staff_name: string;
  vehicle_plate: string;
  sales_rep: string;
  job_no: string;
  priority: string;
  billing_type: string;
  po_number: string;
  billing_note: string;
  work_types: string;
  depart_time: string;
  return_time: string;
  logistics_note: string;
  safety_gear: string;
};

export type WorkOrderPrintData = Partial<WorkOrderDraft> & {
  id?: string;
  status?: string | null;
};

const displayValue = (value?: string | null) => value?.trim() || "-";

/** รูปแบบเอกสารสำหรับส่งออก ซึ่งเรียงหัวข้อเหมือนฟอร์มสร้างใบสั่งงาน */
export function WorkOrderFormPrint({ order }: { order: WorkOrderPrintData }) {
  return (
    <article className="work-order-form-export" aria-label={`ใบสั่งงาน ${displayValue(order.job_no)}`}>
      <header className="work-order-form-export__header">
        <div>
          <p className="work-order-form-export__eyebrow">SERVICE WORK ORDER</p>
          <h2>ใบสั่งงานบริการ</h2>
        </div>
        <div className="work-order-form-export__status">
          <span>เลขที่ใบสั่งงาน</span>
          <strong>{displayValue(order.job_no)}</strong>
        </div>
      </header>

      <PrintSection title="พนักงานเซอร์วิส / รถที่ใช้เดินทาง">
        <PrintField label="พนักงานเซอร์วิส" value={order.staff_name} />
        <PrintField label="ทะเบียนรถ" value={order.vehicle_plate} />
      </PrintSection>

      <PrintSection title="ข้อมูลใบงาน">
        <PrintField label="เลขที่ใบสั่งงาน" value={order.job_no} />
        <PrintField label="พนักงานขาย (เซลล์) ที่ดูแล" value={order.sales_rep} />
        <PrintField label="ความเร่งด่วน" value={order.priority} />
        <PrintField label="วันที่เข้าบริการ" value={order.visit_date} />
        <PrintField label="เวลานัดหมาย" value={order.visit_time} />
      </PrintSection>

      <PrintSection title="ลูกค้า / เครื่องจักร">
        <PrintField label="ชื่อลูกค้า" value={order.customer_name} />
        <PrintField label="หมายเลขเครื่อง (S/N)" value={order.serial_number} />
        <PrintField label="ที่อยู่ลูกค้า" value={order.customer_address} wide />
        <PrintField label="ชื่อผู้ติดต่อ" value={order.contact_name} />
        <PrintField label="เบอร์โทรผู้ติดต่อ" value={order.contact_phone} />
        <PrintField label="เครื่องที่จะเข้าไปทำ (ยี่ห้อ/รุ่น)" value={order.machine_label} wide />
      </PrintSection>

      <PrintSection title="การเงิน / การเรียกเก็บ">
        <PrintField label="รูปแบบการเก็บเงิน" value={order.billing_type} />
        <PrintField label="เลขที่ PO / อ้างอิง" value={order.po_number} />
        <PrintField label="หมายเหตุการเงิน" value={order.billing_note} wide />
      </PrintSection>

      <PrintSection title="ลักษณะงาน / ประเภทบริการ">
        <PrintField label="ประเภทเซอร์วิส" value={order.service_type} />
        <PrintField label="ลักษณะงานที่ต้องทำ" value={order.work_types} />
        <PrintField label="งานที่ทำ / รายละเอียดปัญหา" value={order.job_detail} wide multiline />
      </PrintSection>

      <PrintSection title="การเดินทาง">
        <PrintField label="เวลาออกเดินทาง" value={order.depart_time} />
        <PrintField label="เวลากลับถึงบริษัท (โดยประมาณ)" value={order.return_time} />
        <PrintField label="หมายเหตุการเดินทาง / เส้นทาง" value={order.logistics_note} wide />
      </PrintSection>

      <PrintSection title="อุปกรณ์เซฟตี้ที่ต้องเตรียม">
        <PrintField label="อุปกรณ์เซฟตี้" value={order.safety_gear} wide />
      </PrintSection>

      <footer className="work-order-form-export__signatures">
        <span>ผู้จัดทำ ____________________</span>
        <span>ผู้อนุมัติ ____________________</span>
        <span>วันที่ ____________________</span>
      </footer>
    </article>
  );
}

function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="work-order-form-export__section">
      <h3>{title}</h3>
      <div className="work-order-form-export__grid">{children}</div>
    </section>
  );
}

function PrintField({
  label,
  value,
  wide = false,
  multiline = false,
}: {
  label: string;
  value?: string | null;
  wide?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className={`work-order-form-export__field${wide ? " work-order-form-export__field--wide" : ""}${multiline ? " work-order-form-export__field--multiline" : ""}`}>
      <span>{label}</span>
      <strong>{displayValue(value)}</strong>
    </div>
  );
}

/** เลขที่ใบสั่งงานอัตโนมัติ เช่น JO-260903-1408 */
function autoJobNo() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `JO-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export const emptyDraft = (): WorkOrderDraft => ({
  customer_name: "",
  customer_address: "",
  contact_name: "",
  contact_phone: "",
  machine_label: "",
  serial_number: "",
  job_detail: "",
  service_type: SERVICE_TYPES[0],
  visit_date: new Date().toISOString().slice(0, 10),
  visit_time: "09:00",
  staff_name: "",
  vehicle_plate: "",
  sales_rep: "",
  job_no: autoJobNo(),
  priority: PRIORITIES[0],
  billing_type: BILLING_TYPES[0],
  po_number: "",
  billing_note: "",
  work_types: "",
  depart_time: "",
  return_time: "",
  logistics_note: "",
  safety_gear: "",
});

/** ตัวเลือกบริการ (ช่าง / รถ / S/N) — ดึงจากข้อมูลกลางที่อัปเดตอัตโนมัติ */
export function useServiceOptions() {
  const { staff, vehicles, machines } = useDirectory();
  return {
    staff,
    vehicles,
    serials: machines.map((m) => ({ serial: m.serial, label: m.label, customer: m.customer })),
  };
}

/** ฟอร์มใบสั่งงาน (ใช้ได้ทุกคน) */
export function WorkOrderDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<WorkOrderDraft>(emptyDraft());
  const dir = useDirectory();

  const set = (k: keyof WorkOrderDraft, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const pickCustomer = (name: string) => {
    const c = dir.customers.find((x) => x.name === name);
    const m = dir.machines.find((x) => x.customer === name);
    setForm((f) => {
      // เก็บเฉพาะ S/N ที่เป็นของลูกค้ารายใหม่
      const kept = splitNames(f.serial_number).filter((s) => {
        const owner = dir.machines.find((x) => x.serial === s)?.customer;
        return !owner || owner === name;
      });
      return {
        ...f,
        customer_name: name,
        serial_number: joinNames(kept),
        // ดึงที่อยู่/เบอร์โทรที่ผูกกับลูกค้ารายนี้มาเติมอัตโนมัติ (แก้ไขต่อได้)
        customer_address: c?.address || m?.address || f.customer_address,
        contact_phone: c?.phone || m?.phone || f.contact_phone,
      };
    });
  };

  /** เลือก S/N ได้หลายเครื่อง */
  const pickSerials = (serials: string[]) => {
    const hits = serials
      .map((s) => dir.machines.find((m) => m.serial === s))
      .filter(Boolean) as typeof dir.machines;
    const first = hits[0];
    setForm((f) => ({
      ...f,
      serial_number: joinNames(serials),
      machine_label: joinNames(Array.from(new Set(hits.map((h) => h.label).filter(Boolean)))) || f.machine_label,
      customer_name: first?.customer || f.customer_name,
      customer_address: first?.address || f.customer_address,
      contact_phone: first?.phone || f.contact_phone,
    }));
  };

  const customerOptions = dir.customers.map((c) => ({
    value: c.name,
    hint: [c.phone, c.address].filter(Boolean).join(" · "),
  }));
  const serialOptions = dir.machines
    .filter((m) => !form.customer_name || m.customer === form.customer_name)
    .map((m) => m.serial)
    .filter(Boolean);
  const machineLabels = Array.from(new Set(dir.machines.map((m) => m.label).filter(Boolean))).map((l) => ({ value: l }));
  const addressOptions = Array.from(
    new Set([...dir.customers.map((c) => c.address), ...dir.machines.map((m) => m.address)].filter(Boolean)),
  ).map((a) => ({ value: a }));
  const phoneOptions = Array.from(
    new Set([...dir.customers.map((c) => c.phone), ...dir.machines.map((m) => m.phone)].filter(Boolean)),
  ).map((p) => ({ value: p }));

  const submit = async () => {
    if (!form.customer_name.trim()) return toast.error("กรุณาเลือกชื่อลูกค้า");
    if (!form.job_detail.trim()) return toast.error("กรุณากรอกรายละเอียดงาน");
    setSaving(true);
    const serials = splitNames(form.serial_number);
    const plates = splitNames(form.vehicle_plate);
    await ensureDirectoryEntries({
      customer_name: form.customer_name,
      customer_address: form.customer_address,
      contact_phone: form.contact_phone,
      serial_number: serials[0] ?? "",
      staff_name: form.staff_name,
      vehicle_plate: plates[0] ?? "",
    });
    for (const s of serials.slice(1)) await ensureDirectoryEntries({ customer_name: form.customer_name, serial_number: s });
    for (const p of plates.slice(1)) await ensureDirectoryEntries({ vehicle_plate: p });
    const { error } = await supabase.from("work_orders").insert({
      customer_name: form.customer_name.trim(),
      customer_address: form.customer_address.trim() || null,
      contact_name: form.contact_name.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      machine_label: form.machine_label.trim() || null,
      serial_number: form.serial_number.trim() || null,
      job_detail: form.job_detail.trim(),
      service_type: form.service_type || null,
      visit_date: form.visit_date || null,
      visit_time: form.visit_time || null,
      staff_name: form.staff_name.trim() || null,
      vehicle_plate: form.vehicle_plate.trim() || null,
      sales_rep: form.sales_rep.trim() || null,
      job_no: form.job_no.trim() || null,
      priority: form.priority || null,
      billing_type: form.billing_type || null,
      po_number: form.po_number.trim() || null,
      billing_note: form.billing_note.trim() || null,
      work_types: form.work_types || null,
      depart_time: form.depart_time || null,
      return_time: form.return_time || null,
      logistics_note: form.logistics_note.trim() || null,
      safety_gear: form.safety_gear || null,
      status: "pending",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("ส่งใบสั่งงานแล้ว รอแอดมินอนุมัติ");
    setForm(emptyDraft());
    setOpen(false);
    refreshDirectory();
    onCreated?.();
  };

  return (
    <>
      <Button className="h-11" onClick={() => setOpen(true)}>
        <ClipboardPlus className="mr-1 h-4 w-4" /> เขียนใบสั่งงานใหม่
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>ใบสั่งงานใหม่</DialogTitle>
            <DialogDescription>เลือกข้อมูลจากรายการที่มีในระบบ ระบบจะส่งให้แอดมินตรวจสอบก่อนขึ้นปฏิทิน</DialogDescription>
          </DialogHeader>

          {/* แถวบน: ช่าง / รถ (อัปเดตอัตโนมัติจากฐานข้อมูล) */}
          <div className="grid gap-3 rounded-xl border bg-muted/30 p-3 sm:grid-cols-2">
            <Field label="พนักงานเซอร์วิสที่ต้องการ (เลือกได้หลายคน)">
              <MultiCombobox
                values={splitNames(form.staff_name)}
                onChange={(list) => set("staff_name", joinNames(list))}
                options={dir.staff}
                placeholder="เลือกช่าง (ติ๊กได้หลายคน)"
                searchPlaceholder="ค้นหาช่าง..."
              />
            </Field>
            <Field label="ทะเบียนรถที่ใช้เดินทาง (เลือกได้หลายคัน)">
              <MultiCombobox
                values={splitNames(form.vehicle_plate)}
                onChange={(list) => set("vehicle_plate", joinNames(list))}
                options={dir.vehicles}
                placeholder="ติ๊กเลือกทะเบียนรถ"
                searchPlaceholder="ค้นหาทะเบียนรถ..."
              />
            </Field>
          </div>

          <Section title="ข้อมูลใบงาน">
            <Field label="เลขที่ใบสั่งงาน">
              <Input value={form.job_no} onChange={(e) => set("job_no", e.target.value)} />
            </Field>
            <Field label="พนักงานขาย (เซลล์) ที่ดูแล">
              <Input value={form.sales_rep} onChange={(e) => set("sales_rep", e.target.value)} placeholder="ชื่อเซลล์ผู้ดูแลลูกค้า" />
            </Field>
            <Field label="ความเร่งด่วน">
              <Combobox
                value={form.priority}
                onChange={(v) => set("priority", v)}
                options={PRIORITIES.map((p) => ({ value: p }))}
                allowCustom
                placeholder="เลือกความเร่งด่วน"
              />
            </Field>
            <Field label="วันที่เข้าบริการ">
              <Input type="date" value={form.visit_date} onChange={(e) => set("visit_date", e.target.value)} />
            </Field>
            <Field label="เวลานัดหมาย">
              <Input type="time" value={form.visit_time} onChange={(e) => set("visit_time", e.target.value)} />
            </Field>
          </Section>

          <Section title="ลูกค้า / เครื่องจักร">
            <Field label="ชื่อลูกค้า *">
              <Combobox
                value={form.customer_name}
                onChange={pickCustomer}
                options={customerOptions}
                placeholder="เลือกลูกค้า"
                searchPlaceholder="ค้นหาลูกค้า..."
              />
            </Field>
            <Field label={form.customer_name ? `หมายเลขเครื่อง (S/N) — ของ ${form.customer_name}` : "หมายเลขเครื่อง (S/N) (เลือกได้หลายเครื่อง)"}>
              <MultiCombobox
                values={splitNames(form.serial_number)}
                onChange={pickSerials}
                options={serialOptions}
                placeholder="ติ๊กเลือก S/N"
                searchPlaceholder="ค้นหา S/N..."
              />
            </Field>
            <Field label="ที่อยู่ลูกค้า">
              <Combobox
                value={form.customer_address}
                onChange={(v) => set("customer_address", v)}
                options={addressOptions}
                allowCustom
                placeholder="เลือก / พิมพ์ที่อยู่"
              />
            </Field>
            <Field label="ชื่อผู้ติดต่อ">
              <Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
            </Field>
            <Field label="เบอร์โทรผู้ติดต่อ">
              <Combobox
                value={form.contact_phone}
                onChange={(v) => set("contact_phone", v)}
                options={phoneOptions}
                allowCustom
                placeholder="เลือก / พิมพ์เบอร์โทร"
              />
            </Field>
            <Field label="เครื่องที่จะเข้าไปทำ (ยี่ห้อ/รุ่น)">
              <Combobox
                value={form.machine_label}
                onChange={(v) => set("machine_label", v)}
                options={machineLabels}
                allowCustom
                placeholder="เลือกยี่ห้อ/รุ่น"
              />
            </Field>
          </Section>

          <Section title="การเงิน / การเรียกเก็บ">
            <Field label="รูปแบบการเก็บเงิน">
              <Combobox
                value={form.billing_type}
                onChange={(v) => set("billing_type", v)}
                options={BILLING_TYPES.map((b) => ({ value: b }))}
                allowCustom
                placeholder="เลือกรูปแบบ"
              />
            </Field>
            <Field label="เลขที่ PO / อ้างอิง">
              <Input value={form.po_number} onChange={(e) => set("po_number", e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="หมายเหตุการเงิน">
                <Input value={form.billing_note} onChange={(e) => set("billing_note", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="ลักษณะงาน / ประเภทบริการ">
            <Field label="ประเภทเซอร์วิส (เลือกได้หลายงาน)">
              <MultiCombobox
                values={splitNames(form.service_type)}
                onChange={(list) => set("service_type", joinNames(list))}
                options={SERVICE_TYPES}
                placeholder="ติ๊กเลือกประเภทงาน"
                searchPlaceholder="ค้นหาประเภทงาน..."
              />
            </Field>
            <Field label="ลักษณะงานที่ต้องทำ (เลือกได้หลายอย่าง)">
              <MultiCombobox
                values={splitNames(form.work_types)}
                onChange={(list) => set("work_types", joinNames(list))}
                options={WORK_TYPES}
                placeholder="ติ๊กเลือกลักษณะงาน"
                searchPlaceholder="ค้นหาลักษณะงาน..."
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="งานที่ทำ / รายละเอียดปัญหา *">
                <Textarea rows={3} value={form.job_detail} onChange={(e) => set("job_detail", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="การเดินทาง">
            <Field label="เวลาออกเดินทาง">
              <Input type="time" value={form.depart_time} onChange={(e) => set("depart_time", e.target.value)} />
            </Field>
            <Field label="เวลากลับถึงบริษัท (โดยประมาณ)">
              <Input type="time" value={form.return_time} onChange={(e) => set("return_time", e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="หมายเหตุการเดินทาง / เส้นทาง">
                <Input value={form.logistics_note} onChange={(e) => set("logistics_note", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="อุปกรณ์เซฟตี้ที่ต้องเตรียม">
            <div className="sm:col-span-2">
              <Field label="อุปกรณ์เซฟตี้ (เลือกได้หลายอย่าง)">
                <MultiCombobox
                  values={splitNames(form.safety_gear)}
                  onChange={(list) => set("safety_gear", joinNames(list))}
                  options={SAFETY_GEAR}
                  placeholder="ติ๊กเลือกอุปกรณ์เซฟตี้"
                  searchPlaceholder="ค้นหาอุปกรณ์..."
                />
              </Field>
            </div>
          </Section>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} ส่งใบสั่งงาน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** กล่องหัวข้อย่อยแบบ 2 คอลัมน์ */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <p className="text-sm font-semibold">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
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
};

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
    setForm((f) => ({
      ...f,
      customer_name: name,
      customer_address: c?.address || m?.address || f.customer_address,
      contact_phone: c?.phone || m?.phone || f.contact_phone,
    }));
  };

  const pickSerial = (serial: string) => {
    const hit = dir.machines.find((m) => m.serial === serial);
    setForm((f) => ({
      ...f,
      serial_number: serial,
      machine_label: hit?.label || f.machine_label,
      customer_name: hit?.customer || f.customer_name,
      customer_address: hit?.address || f.customer_address,
      contact_phone: hit?.phone || f.contact_phone,
    }));
  };

  const customerOptions = dir.customers.map((c) => ({
    value: c.name,
    hint: [c.phone, c.address].filter(Boolean).join(" · "),
  }));
  const serialOptions = dir.machines.map((m) => ({
    value: m.serial,
    hint: [m.customer, m.label].filter(Boolean).join(" · "),
  }));
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
    await ensureDirectoryEntries({
      customer_name: form.customer_name,
      customer_address: form.customer_address,
      contact_phone: form.contact_phone,
      serial_number: form.serial_number,
      staff_name: form.staff_name,
      vehicle_plate: form.vehicle_plate,
    });
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>ใบสั่งงานใหม่</DialogTitle>
            <DialogDescription>เลือกข้อมูลจากรายการที่มีในระบบ ระบบจะส่งให้แอดมินตรวจสอบก่อนขึ้นปฏิทิน</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ชื่อลูกค้า *">
              <Combobox
                value={form.customer_name}
                onChange={pickCustomer}
                options={customerOptions}
                placeholder="เลือกลูกค้า"
                searchPlaceholder="ค้นหาลูกค้า..."
              />
            </Field>
            <Field label="หมายเลขเครื่อง (S/N)">
              <Combobox
                value={form.serial_number}
                onChange={pickSerial}
                options={serialOptions}
                placeholder="เลือก S/N"
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
            <Field label="ประเภทเซอร์วิส">
              <Combobox
                value={form.service_type}
                onChange={(v) => set("service_type", v)}
                options={SERVICE_TYPES.map((t) => ({ value: t }))}
                placeholder="เลือกประเภทงาน"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="วันที่เข้าบริการ">
                <Input type="date" value={form.visit_date} onChange={(e) => set("visit_date", e.target.value)} />
              </Field>
              <Field label="เวลานัดหมาย">
                <Input type="time" value={form.visit_time} onChange={(e) => set("visit_time", e.target.value)} />
              </Field>
            </div>
            <Field label="พนักงานเซอร์วิสที่ต้องการ (เลือกได้หลายคน)">
              <MultiCombobox
                values={splitNames(form.staff_name)}
                onChange={(list) => set("staff_name", joinNames(list))}
                options={dir.staff}
                placeholder="เลือกช่าง (ติ๊กได้หลายคน)"
                searchPlaceholder="ค้นหาช่าง..."
              />
            </Field>
            <Field label="ทะเบียนรถที่ใช้เดินทาง">
              <Combobox
                value={form.vehicle_plate}
                onChange={(v) => set("vehicle_plate", v)}
                options={dir.vehicles.map((v) => ({ value: v }))}
                placeholder="เลือกทะเบียนรถ"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="งานที่ทำ / รายละเอียดปัญหา *">
                <Textarea rows={3} value={form.job_detail} onChange={(e) => set("job_detail", e.target.value)} />
              </Field>
            </div>
          </div>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

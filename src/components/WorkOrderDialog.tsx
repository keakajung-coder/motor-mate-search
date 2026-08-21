import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export function useServiceOptions() {
  const [staff, setStaff] = useState<string[]>([]);
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [serials, setSerials] = useState<{ serial: string; label: string; customer: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [s, v, m] = await Promise.all([
        supabase.from("service_staff").select("name").order("name"),
        supabase.from("vehicles").select("plate").order("plate"),
        supabase
          .from("machine_units")
          .select("serial_number, customers ( name ), compressor_models ( name, brands ( name ) )")
          .order("serial_number"),
      ]);
      setStaff((s.data ?? []).map((r) => r.name));
      setVehicles((v.data ?? []).map((r) => r.plate));
      setSerials(
        (m.data ?? []).map((r: any) => ({
          serial: r.serial_number,
          label: [r.compressor_models?.brands?.name, r.compressor_models?.name].filter(Boolean).join(" "),
          customer: r.customers?.name ?? "",
        }))
      );
    })();
  }, []);

  return { staff, vehicles, serials };
}

/** ฟอร์มใบสั่งงาน (ใช้ได้ทุกคน) */
export function WorkOrderDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<WorkOrderDraft>(emptyDraft());
  const { staff, vehicles, serials } = useServiceOptions();

  const set = (k: keyof WorkOrderDraft, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSerialChange = (v: string) => {
    const hit = serials.find((s) => s.serial.toLowerCase() === v.trim().toLowerCase());
    setForm((f) => ({
      ...f,
      serial_number: v,
      machine_label: hit?.label || f.machine_label,
      customer_name: hit?.customer || f.customer_name,
    }));
  };

  const submit = async () => {
    if (!form.customer_name.trim()) return toast.error("กรุณากรอกชื่อลูกค้า");
    if (!form.job_detail.trim()) return toast.error("กรุณากรอกรายละเอียดงาน");
    setSaving(true);
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
            <DialogDescription>กรอกรายละเอียดงานบริการ ระบบจะส่งให้แอดมินตรวจสอบก่อนขึ้นปฏิทิน</DialogDescription>
          </DialogHeader>

          <datalist id="wo-serials">
            {serials.map((s) => (
              <option key={s.serial} value={s.serial}>
                {s.customer} {s.label}
              </option>
            ))}
          </datalist>
          <datalist id="wo-staff">
            {staff.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <datalist id="wo-vehicles">
            {vehicles.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ชื่อลูกค้า *">
              <Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} />
            </Field>
            <Field label="ที่อยู่ลูกค้า">
              <Input value={form.customer_address} onChange={(e) => set("customer_address", e.target.value)} />
            </Field>
            <Field label="ชื่อผู้ติดต่อ">
              <Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
            </Field>
            <Field label="เบอร์โทรผู้ติดต่อ">
              <Input inputMode="tel" value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
            </Field>
            <Field label="หมายเลขเครื่อง (S/N)">
              <Input list="wo-serials" value={form.serial_number} onChange={(e) => onSerialChange(e.target.value)} />
            </Field>
            <Field label="เครื่องที่จะเข้าไปทำ (ยี่ห้อ/รุ่น)">
              <Input value={form.machine_label} onChange={(e) => set("machine_label", e.target.value)} />
            </Field>
            <Field label="ประเภทเซอร์วิส">
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.service_type}
                onChange={(e) => set("service_type", e.target.value)}
              >
                {SERVICE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="วันที่เข้าบริการ">
                <Input type="date" value={form.visit_date} onChange={(e) => set("visit_date", e.target.value)} />
              </Field>
              <Field label="เวลานัดหมาย">
                <Input type="time" value={form.visit_time} onChange={(e) => set("visit_time", e.target.value)} />
              </Field>
            </div>
            <Field label="พนักงานเซอร์วิสที่ต้องการ">
              <Input list="wo-staff" value={form.staff_name} onChange={(e) => set("staff_name", e.target.value)} />
            </Field>
            <Field label="ทะเบียนรถที่ใช้เดินทาง">
              <Input list="wo-vehicles" value={form.vehicle_plate} onChange={(e) => set("vehicle_plate", e.target.value)} />
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

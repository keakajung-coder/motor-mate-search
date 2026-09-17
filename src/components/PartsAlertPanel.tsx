import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarDays, Loader2, Pencil, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { computeUsage, formatDate } from "@/lib/report";
import { DateInput } from "@/components/ui/date-input";
import { notifyAdmins, notifyUsers } from "@/lib/notify";

export type AlertRow = {
  id: string;
  serial: string;
  customer: string;
  phone: string;
  part: string;
  nextDate: string;
  days: number;
  lastChanged: string | null;
  intervalHours: number | null;
  hoursUsed: number | null;
};

/** แผงแจ้งเตือนอะไหล่ครบกำหนดเปลี่ยนใน 30 วัน พร้อมปุ่มลัดแก้ไข/ดึงเข้าปฏิทิน */
export function PartsAlertPanel({ withActions = false }: { withActions?: boolean }) {
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AlertRow | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("machine_parts")
      .select(
        `id, hours_used, last_changed_at, service_interval_hours,
         products ( name, part_number, service_interval_hours ),
         machine_units ( serial_number, daily_hours, install_date, customers ( name, phone ) )`
      );
    const today = new Date();
    const out: AlertRow[] = [];
    for (const mp of (data ?? []) as any[]) {
      const unit = mp.machine_units;
      if (!unit) continue;
      const interval = mp.service_interval_hours ?? mp.products?.service_interval_hours ?? null;
      const usage = computeUsage({
        lastChanged: mp.last_changed_at,
        installDate: unit.install_date,
        intervalHours: interval,
        dailyHours: unit.daily_hours,
        manualHours: mp.hours_used,
      });
      if (!usage.nextDate) continue;
      const days = Math.round((new Date(usage.nextDate).getTime() - today.getTime()) / 86400000);
      if (days > 30) continue;
      out.push({
        id: mp.id,
        serial: unit.serial_number,
        customer: unit.customers?.name ?? "-",
        phone: unit.customers?.phone ?? "",
        part: `${mp.products?.name ?? "อะไหล่"} (${mp.products?.part_number ?? "-"})`,
        nextDate: usage.nextDate,
        days,
        lastChanged: mp.last_changed_at ?? null,
        intervalHours: interval,
        hoursUsed: mp.hours_used ?? null,
      });
    }
    out.sort((a, b) => a.days - b.days);
    setRows(out);
    setLoading(false);
    // แจ้งเตือนแอดมินสำหรับอะไหล่ที่ครบกำหนด/เลยกำหนด (กันซ้ำด้วย dedupe key)
    for (const r of out.filter((x) => x.days <= 7)) {
      void notifyAdmins({
        kind: "part_due",
        title: `อะไหล่ครบกำหนดเปลี่ยน: ${r.part}`,
        body: `S/N ${r.serial} · ${r.customer} · ${r.days <= 0 ? `เลยกำหนด ${Math.abs(r.days)} วัน` : `อีก ${r.days} วัน`} (${formatDate(r.nextDate)})`,
        link: "/planner",
        dedupeKey: `part:${r.id}:${r.nextDate}`,
      });
      void notifyUsers({
        customerName: r.customer,
        title: `แจ้งเตือนอะไหล่ครบกำหนดเปลี่ยน: ${r.part}`,
        body: `S/N ${r.serial} · ${r.days <= 0 ? `เลยกำหนด ${Math.abs(r.days)} วัน` : `อีก ${r.days} วัน`} (${formatDate(r.nextDate)})`,
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <Card className="border-orange-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-orange-700">
          <AlertTriangle className="h-4 w-4" /> อะไหล่ครบกำหนดเปลี่ยนใน 30 วัน ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีรายการที่ใกล้ครบกำหนด</p>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {rows.map((r) => (
              <div key={r.id} className="space-y-2 rounded-md border p-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {r.serial} · {r.customer}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.part}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.days <= 0 ? "destructive" : "secondary"}>
                      {r.days <= 0 ? `เลยกำหนด ${Math.abs(r.days)} วัน` : `อีก ${r.days} วัน`} ·{" "}
                      {formatDate(r.nextDate)}
                    </Badge>
                    {r.phone && (
                      <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-xs text-primary">
                        <Phone className="h-3 w-3" /> โทร
                      </a>
                    )}
                  </div>
                </div>
                {withActions && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                      <Pencil className="mr-1 h-4 w-4" /> ✏️ แก้ไขข้อมูลอะไหล่
                    </Button>
                    <Button size="sm" asChild>
                      <Link
                        to="/planner"
                        search={{
                          sn: r.serial,
                          customer: r.customer,
                          job: `เปลี่ยน${r.part} (ครบกำหนด ${formatDate(r.nextDate)})`,
                        }}
                      >
                        <CalendarDays className="mr-1 h-4 w-4" /> 📅 ดึงเข้าตารางแพลนเนอร์
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {editing && (
        <EditPartDialog
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </Card>
  );
}

function EditPartDialog({
  row,
  onClose,
  onSaved,
}: {
  row: AlertRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [lastChanged, setLastChanged] = useState(row.lastChanged ?? "");
  const [interval, setInterval] = useState(row.intervalHours != null ? String(row.intervalHours) : "");
  const [hoursUsed, setHoursUsed] = useState(row.hoursUsed != null ? String(row.hoursUsed) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("machine_parts")
      .update({
        last_changed_at: lastChanged || null,
        service_interval_hours: interval ? Number(interval) : null,
        hours_used: hoursUsed ? Number(hoursUsed) : null,
      })
      .eq("id", row.id);
    setSaving(false);
    if (error) return toast.error("บันทึกไม่สำเร็จ: " + error.message);
    toast.success("อัปเดตข้อมูลอะไหล่แล้ว");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>แก้ไขข้อมูลอะไหล่</DialogTitle>
          <DialogDescription>
            {row.serial} · {row.part}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>วันที่เปลี่ยนล่าสุด</Label>
            <DateInput value={lastChanged} onChange={setLastChanged} />
          </div>
          <div className="space-y-1">
            <Label>รอบการเปลี่ยน (ชั่วโมง)</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>ชั่วโมงใช้งานสะสม (กรอกเองถ้ามี)</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={hoursUsed}
              onChange={(e) => setHoursUsed(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

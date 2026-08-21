import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronDown,

  ChevronRight,
  ClipboardList,
  Loader2,
  Phone,
  Trash2,
  XCircle,
} from "lucide-react";
import { useAccess } from "@/lib/access";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SERVICE_TYPES, useServiceOptions, WorkOrderDialog } from "@/components/WorkOrderDialog";
import { Combobox } from "@/components/ui/combobox";
import { MultiCombobox, splitNames, joinNames } from "@/components/ui/multi-combobox";
import { ensureDirectoryEntries, useDirectory } from "@/lib/directory";
import { computeUsage, formatDate, isMachineComplete } from "@/lib/report";


export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "ปฏิทินนัดหมายบริการ - อะไหล่ปั๊มลม" },
      { name: "description", content: "ตารางแพลนเนอร์นัดหมายเข้าบริการ ใบสั่งงาน และแจ้งเตือนอายุอะไหล่ล่วงหน้า" },
      { property: "og:title", content: "ปฏิทินนัดหมายบริการปั๊มลม" },
      { property: "og:description", content: "วางแผนงานเซอร์วิส ติดตามสถานะงาน และแจ้งเตือนเปลี่ยนอะไหล่ล่วงหน้า 30 วัน" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlannerPage,
});

type Appointment = {
  id: string;
  customer_name: string | null;
  customer_address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  machine_label: string | null;
  serial_number: string | null;
  job_detail: string | null;
  service_type: string | null;
  visit_date: string;
  visit_time: string | null;
  staff_name: string | null;
  vehicle_plate: string | null;
  status: string;
  result: string | null;
  close_note: string | null;
};

type WorkOrder = Appointment & { admin_note: string | null };

const STATUS_LABEL: Record<string, string> = {
  scheduled: "รอนัดหมาย",
  in_progress: "กำลังดำเนินการ",
  closed: "ปิดงาน",
};

const iso = (d: Date) => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const TH_DOW = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

function FoldSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold hover:bg-accent/50"
      >
        {title}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t p-3">{children}</div>}
    </div>
  );
}

function PlannerPage() {

  const { isAdmin } = useAccess();
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [cursor, setCursor] = useState(new Date());
  const [staffFilter, setStaffFilter] = useState("");
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [closing, setClosing] = useState<Appointment | null>(null);

  const load = useCallback(async () => {
    const [a, w] = await Promise.all([
      supabase.from("appointments").select("*").order("visit_date"),
      supabase.from("work_orders").select("*").eq("status", "pending").order("created_at"),
    ]);
    setAppts((a.data ?? []) as Appointment[]);
    setOrders((w.data ?? []) as unknown as WorkOrder[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const staffNames = useMemo(
    () => Array.from(new Set(appts.map((a) => a.staff_name).filter(Boolean) as string[])).sort(),
    [appts]
  );

  const visible = useMemo(
    () => (staffFilter ? appts.filter((a) => a.staff_name === staffFilter) : appts),
    [appts, staffFilter]
  );

  const shift = (dir: number) => {
    if (view === "month") {
      const d = new Date(cursor);
      d.setMonth(d.getMonth() + dir);
      setCursor(d);
    } else setCursor(addDays(cursor, dir * (view === "week" ? 7 : 1)));
  };

  const title =
    view === "month"
      ? `${TH_MONTHS[cursor.getMonth()]} ${cursor.getFullYear() + 543}`
      : view === "week"
        ? `${formatDate(iso(startOfWeek(cursor)))} - ${formatDate(iso(addDays(startOfWeek(cursor), 6)))}`
        : formatDate(iso(cursor));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ปฏิทินนัดหมายบริการ</h1>
          <p className="text-sm text-muted-foreground">วางแผนงานเข้าบริการ ตรวจใบสั่งงาน และแจ้งเตือนอะไหล่ล่วงหน้า</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <WorkOrderDialog onCreated={load} />
          {isAdmin && (
            <Button variant="outline" className="h-11" onClick={() => setEditing(newAppointment(iso(cursor)))}>
              <CalendarPlus className="mr-1 h-4 w-4" /> เพิ่มนัดหมายลงปฏิทินโดยตรง
            </Button>
          )}
        </div>
      </header>

      <StatsPanel appts={appts} pending={orders.length} />

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" /> {title}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => shift(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
                วันนี้
              </Button>
              <Button variant="outline" size="icon" onClick={() => shift(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="grid flex-1 grid-cols-3 gap-1 sm:flex sm:flex-none">
              {(["month", "week", "day"] as const).map((v) => (
                <Button
                  key={v}
                  size="sm"
                  className="w-full sm:w-auto"
                  variant={view === v ? "default" : "outline"}
                  onClick={() => setView(v)}
                >
                  {v === "month" ? "รายเดือน" : v === "week" ? "รายสัปดาห์" : "รายวัน"}
                </Button>
              ))}
            </div>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
            >
              <option value="">ช่างทุกคน</option>
              {staffNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : view === "month" ? (
            <MonthGrid
              cursor={cursor}
              appts={visible}
              onPick={(a) => setEditing(a)}
              onPickDate={isAdmin ? (d) => setEditing(newAppointment(d)) : undefined}
            />
          ) : (

            <DayList
              days={
                view === "week"
                  ? Array.from({ length: 7 }, (_, i) => iso(addDays(startOfWeek(cursor), i)))
                  : [iso(cursor)]
              }
              appts={visible}
              isAdmin={isAdmin}
              onEdit={setEditing}
              onClose={setClosing}
              reload={load}
            />
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <FoldSection title={`ใบสั่งงานรออนุมัติ (${orders.length})`} defaultOpen={orders.length > 0}>
          <PendingOrders orders={orders} reload={load} />
        </FoldSection>
      )}

      <FoldSection title="แจ้งเตือนอะไหล่ล่วงหน้า 30 วัน">
        <PartsAlertPanel />
      </FoldSection>



      {editing && (
        <AppointmentDialog
          value={editing}
          canEdit={isAdmin}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {closing && (
        <CloseJobDialog
          appt={closing}
          onClose={() => setClosing(null)}
          onSaved={() => {
            setClosing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function newAppointment(date: string): Appointment {
  return {
    id: "",
    customer_name: "",
    customer_address: "",
    contact_name: "",
    contact_phone: "",
    machine_label: "",
    serial_number: "",
    job_detail: "",
    service_type: SERVICE_TYPES[0],
    visit_date: date,
    visit_time: "09:00",
    staff_name: "",
    vehicle_plate: "",
    status: "scheduled",
    result: null,
    close_note: null,
  };
}

// ---------- Stats ----------
function StatsPanel({ appts, pending }: { appts: Appointment[]; pending: number }) {
  const [counts, setCounts] = useState({ machines: 0, parts: 0, complete: 0, incomplete: 0 });

  useEffect(() => {
    (async () => {
      const [m, p] = await Promise.all([
        supabase.from("machine_units").select("id, serial_number, model_id, customer_id, install_date, daily_hours, seller, status"),
        supabase.from("products").select("id", { count: "exact", head: true }),
      ]);
      const rows = (m.data ?? []) as any[];
      setCounts({
        machines: rows.length,
        parts: p.count ?? 0,
        complete: rows.filter((r) => isMachineComplete(r)).length,
        incomplete: rows.filter((r) => !isMachineComplete(r)).length,
      });
    })();
  }, []);

  const open = appts.filter((a) => a.status !== "closed").length;
  const items = [
    { label: "เครื่องจักรทั้งหมด", value: counts.machines },
    { label: "อะไหล่ในคลัง", value: counts.parts },
    { label: "นัดหมายค้างอยู่", value: open },
    { label: "ใบสั่งงานรอตรวจ", value: pending },
    { label: "ลงข้อมูลครบ", value: counts.complete, tone: "ok" as const },
    { label: "ยังลงไม่ครบ", value: counts.incomplete, tone: "warn" as const },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((i) => (
        <div
          key={i.label}
          className={
            "rounded-2xl border p-4 text-center shadow-sm " +
            (i.tone === "ok"
              ? "border-emerald-200 bg-emerald-50"
              : i.tone === "warn"
                ? "border-orange-200 bg-orange-50"
                : "border-border bg-card")
          }
        >
          <p
            className={
              "text-3xl font-bold leading-tight " +
              (i.tone === "ok" ? "text-emerald-600" : i.tone === "warn" ? "text-orange-600" : "text-foreground")
            }
          >
            {i.value}
          </p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">{i.label}</p>
        </div>
      ))}
    </div>
  );
}

// ---------- Parts alerts (30 days) ----------
type AlertRow = {
  id: string;
  serial: string;
  customer: string;
  phone: string;
  part: string;
  nextDate: string;
  days: number;
};

export function PartsAlertPanel() {
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
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
        const usage = computeUsage({
          lastChanged: mp.last_changed_at,
          installDate: unit.install_date,
          intervalHours: mp.service_interval_hours ?? mp.products?.service_interval_hours,
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
        });
      }
      out.sort((a, b) => a.days - b.days);
      setRows(out);
      setLoading(false);
    })();
  }, []);

  if (loading) return null;

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
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <div>
                  <p className="font-medium">
                    {r.serial} · {r.customer}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.part}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.days <= 0 ? "destructive" : "secondary"}>
                    {r.days <= 0 ? `เลยกำหนด ${Math.abs(r.days)} วัน` : `อีก ${r.days} วัน`} · {formatDate(r.nextDate)}
                  </Badge>
                  {r.phone && (
                    <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-xs text-primary">
                      <Phone className="h-3 w-3" /> โทร
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Pending work orders ----------
function PendingOrders({ orders, reload }: { orders: WorkOrder[]; reload: () => void }) {
  const [edit, setEdit] = useState<Record<string, Partial<WorkOrder>>>({});
  const { staff, vehicles } = useServiceOptions();
  const [busy, setBusy] = useState<string | null>(null);

  const patch = (id: string, k: keyof WorkOrder, v: string) =>
    setEdit((e) => ({ ...e, [id]: { ...e[id], [k]: v } }));

  const approve = async (o: WorkOrder) => {
    const p = edit[o.id] ?? {};
    setBusy(o.id);
    const { data: unit } = await supabase
      .from("machine_units")
      .select("id")
      .eq("serial_number", (p.serial_number ?? o.serial_number) ?? "")
      .maybeSingle();
    const { error } = await supabase.from("appointments").insert({
      work_order_id: o.id,
      machine_unit_id: unit?.id ?? null,
      customer_name: o.customer_name,
      customer_address: o.customer_address,
      contact_name: o.contact_name,
      contact_phone: o.contact_phone,
      machine_label: o.machine_label,
      serial_number: p.serial_number ?? o.serial_number,
      job_detail: o.job_detail,
      service_type: o.service_type,
      visit_date: (p.visit_date ?? o.visit_date) as string,
      visit_time: p.visit_time ?? o.visit_time,
      staff_name: p.staff_name ?? o.staff_name,
      vehicle_plate: p.vehicle_plate ?? o.vehicle_plate,
      status: "scheduled",
    });
    if (!error) await supabase.from("work_orders").update({ status: "approved" }).eq("id", o.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("อนุมัติและเพิ่มลงปฏิทินแล้ว");
    reload();
  };

  const reject = async (o: WorkOrder) => {
    const { error } = await supabase.from("work_orders").update({ status: "rejected" }).eq("id", o.id);
    if (error) return toast.error(error.message);
    toast.message("ปฏิเสธใบสั่งงานแล้ว");
    reload();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4" /> ใบสั่งงานรออนุมัติ ({orders.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {orders.length === 0 && <p className="text-sm text-muted-foreground">ไม่มีใบสั่งงานรอตรวจ</p>}
        {orders.map((o) => (
          <div key={o.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-semibold">{o.customer_name}</p>
                <p className="text-xs text-muted-foreground">
                  {[o.machine_label, o.serial_number, o.service_type].filter(Boolean).join(" · ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[o.contact_name, o.contact_phone, o.customer_address].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Badge variant="secondary">รออนุมัติ</Badge>
            </div>
            <p className="text-sm">{o.job_detail}</p>
            <div className="grid gap-2 sm:grid-cols-4">
              <Input
                type="date"
                defaultValue={o.visit_date ?? ""}
                onChange={(e) => patch(o.id, "visit_date", e.target.value)}
              />
              <Input
                type="time"
                defaultValue={o.visit_time ?? ""}
                onChange={(e) => patch(o.id, "visit_time", e.target.value)}
              />
              <MultiCombobox
                values={splitNames(edit[o.id]?.staff_name ?? o.staff_name ?? "")}
                onChange={(list) => patch(o.id, "staff_name", joinNames(list))}
                options={staff}
                placeholder="เลือกช่าง (หลายคนได้)"
                searchPlaceholder="ค้นหาช่าง..."
              />
              <ComboCell
                value={edit[o.id]?.vehicle_plate ?? o.vehicle_plate ?? ""}
                onChange={(v) => patch(o.id, "vehicle_plate", v)}
                options={vehicles}
                placeholder="เลือกทะเบียนรถ"
              />

            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => approve(o)} disabled={busy === o.id}>
                {busy === o.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                อนุมัติ
              </Button>
              <ConfirmButton
                variant="outline"
                onConfirm={() => reject(o)}
                title="ปฏิเสธใบสั่งงาน?"
                description="รายการนี้จะไม่ถูกนำขึ้นปฏิทิน"
                confirmText="ปฏิเสธ"
              >
                <XCircle className="mr-1 h-4 w-4" /> ปฏิเสธ
              </ConfirmButton>
            </div>
          </div>
        ))}


      </CardContent>
    </Card>
  );
}

// ---------- Calendar views ----------
function MonthGrid({
  cursor,
  appts,
  onPick,
  onPickDate,
}: {
  cursor: Date;
  appts: Appointment[];
  onPick: (a: Appointment) => void;
  onPickDate?: (date: string) => void;
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const today = iso(new Date());

  return (
    <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-amber-300" /> รอนัดหมาย</span>
      <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-red-400" /> งานซ่อมด่วน</span>
      <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-emerald-400" /> ปิดงานแล้ว</span>
      {onPickDate && <span className="ml-auto">แตะช่องวันที่เพื่อเพิ่มงานด่วน</span>}
    </div>
    <div className="grid grid-cols-7 gap-1 text-xs">
      {TH_DOW.map((d) => (
        <div key={d} className="py-1 text-center font-medium text-muted-foreground">
          {d}
        </div>
      ))}
      {days.map((d) => {
        const key = iso(d);
        const list = appts.filter((a) => a.visit_date === key);
        const dim = d.getMonth() !== cursor.getMonth();
        return (
          <div
            key={key}
            onClick={() => onPickDate?.(key)}
            className={
              "min-h-24 rounded-xl border bg-card p-1.5 " +
              (onPickDate ? "cursor-pointer hover:border-primary/60 hover:bg-accent/40 " : "") +
              (dim ? "bg-muted/30 text-muted-foreground " : "") +
              (key === today ? "border-primary" : "")
            }
          >
            <div className="mb-1 text-right">{d.getDate()}</div>
            <div className="space-y-1">
              {list.slice(0, 4).map((a) => (
                <button
                  key={a.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPick(a);
                  }}
                  className={
                    "block w-full whitespace-normal break-words rounded px-1 py-0.5 text-left leading-tight " +
                    (a.status === "closed"
                      ? a.result === "not_ok"
                        ? "bg-red-100 text-red-700 border border-red-200"
                        : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      : a.status === "in_progress"
                        ? "bg-red-50 text-red-600 border border-red-200"
                        : "bg-amber-100 text-amber-800 border border-amber-200")
                  }
                  title={apptSummary(a)}
                >
                  {apptSummary(a)}
                </button>
              ))}
              {list.length > 4 && <p className="px-1 text-[10px] text-muted-foreground">+{list.length - 4} งาน</p>}
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}


function DayList({
  days,
  appts,
  isAdmin,
  onEdit,
  onClose,
  reload,
}: {
  days: string[];
  appts: Appointment[];
  isAdmin: boolean;
  onEdit: (a: Appointment) => void;
  onClose: (a: Appointment) => void;
  reload: () => void;
}) {
  const setStatus = async (a: Appointment, status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", a.id);
    if (error) return toast.error(error.message);
    reload();
  };
  const remove = async (a: Appointment) => {
    const { error } = await supabase.from("appointments").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("ลบนัดหมายแล้ว");
    reload();
  };

  return (
    <div className="space-y-4">
      {days.map((d) => {
        const list = appts
          .filter((a) => a.visit_date === d)
          .sort((a, b) => (a.visit_time ?? "").localeCompare(b.visit_time ?? ""));
        return (
          <div key={d} className="space-y-2">
            <p className="text-sm font-semibold">{formatDate(d)}</p>
            {list.length === 0 && <p className="text-sm text-muted-foreground">ไม่มีนัดหมาย</p>}
            {list.map((a) => (
              <div key={a.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {a.visit_time?.slice(0, 5)} · {a.customer_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[a.serial_number, a.machine_label, a.service_type].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ช่าง: {a.staff_name || "-"} · รถ: {a.vehicle_plate || "-"}
                    </p>
                    {a.job_detail && <p className="mt-1 text-sm">{a.job_detail}</p>}
                    {a.status === "closed" && a.close_note && (
                      <p className="mt-1 text-xs text-muted-foreground">สรุป: {a.close_note}</p>
                    )}
                  </div>
                  <Badge
                    className={
                      a.status === "closed"
                        ? a.result === "not_ok"
                          ? "bg-destructive text-destructive-foreground"
                          : "bg-emerald-600 text-white"
                        : ""
                    }
                    variant={a.status === "closed" ? "default" : "secondary"}
                  >
                    {STATUS_LABEL[a.status] ?? a.status}
                    {a.status === "closed" ? (a.result === "not_ok" ? " · ไม่เรียบร้อย" : " · เรียบร้อย") : ""}
                  </Badge>
                </div>
                {isAdmin && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => onEdit(a)}>
                      แก้ไข
                    </Button>
                    {a.status === "scheduled" && (
                      <Button size="sm" onClick={() => setStatus(a, "in_progress")}>
                        เริ่มดำเนินการ
                      </Button>
                    )}
                    {a.status !== "closed" && (
                      <Button size="sm" variant="secondary" onClick={() => onClose(a)}>
                        ปิดงาน
                      </Button>
                    )}
                    <ConfirmButton onConfirm={() => remove(a)} description="ลบนัดหมายนี้?">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </ConfirmButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Small combobox cell ----------
function ComboCell({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={options.map((o) => ({ value: o }))}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}

// ---------- Appointment editor / detail ----------
function AppointmentDialog({
  value,
  canEdit,
  onClose,
  onSaved,
}: {
  value: Appointment;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Appointment>(value);
  const [saving, setSaving] = useState(false);
  const dir = useDirectory();
  const set = (k: keyof Appointment, v: string) => setForm((f) => ({ ...f, [k]: v }));

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

  const save = async () => {
    if (!form.customer_name?.trim()) return toast.error("กรุณาเลือกชื่อลูกค้า");
    setSaving(true);
    await ensureDirectoryEntries({
      customer_name: form.customer_name,
      customer_address: form.customer_address,
      contact_phone: form.contact_phone,
      serial_number: form.serial_number,
      staff_name: form.staff_name,
      vehicle_plate: form.vehicle_plate,
    });
    const { data: unit } = await supabase
      .from("machine_units")
      .select("id")
      .eq("serial_number", form.serial_number ?? "")
      .maybeSingle();
    const payload = {
      customer_name: form.customer_name,
      customer_address: form.customer_address,
      contact_name: form.contact_name,
      contact_phone: form.contact_phone,
      machine_label: form.machine_label,
      serial_number: form.serial_number,
      machine_unit_id: unit?.id ?? null,
      job_detail: form.job_detail,
      service_type: form.service_type,
      visit_date: form.visit_date,
      visit_time: form.visit_time,
      staff_name: form.staff_name,
      vehicle_plate: form.vehicle_plate,
      status: form.status,
    };
    const { error } = form.id
      ? await supabase.from("appointments").update(payload).eq("id", form.id)
      : await supabase.from("appointments").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("บันทึกนัดหมายแล้ว");
    onSaved();
  };

  const addressOptions = Array.from(
    new Set([...dir.customers.map((c) => c.address), ...dir.machines.map((m) => m.address)].filter(Boolean)),
  );
  const phoneOptions = Array.from(
    new Set([...dir.customers.map((c) => c.phone), ...dir.machines.map((m) => m.phone)].filter(Boolean)),
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{form.id ? "รายละเอียดนัดหมาย" : "เพิ่มนัดหมายลงปฏิทิน"}</DialogTitle>
          <DialogDescription>
            {canEdit ? "เลือกลูกค้า/เครื่องจากฐานข้อมูล ระบบจะเติมที่อยู่และเบอร์โทรให้อัตโนมัติ" : "ดูรายละเอียดงานนัดหมาย"}
          </DialogDescription>
        </DialogHeader>

        {form.id && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 p-3 text-sm">
            <Badge variant="secondary">{STATUS_LABEL[form.status] ?? form.status}</Badge>
            <span>{formatDate(form.visit_date)} {form.visit_time?.slice(0, 5)}</span>
            {form.result && (
              <Badge className={form.result === "not_ok" ? "bg-destructive text-destructive-foreground" : "bg-emerald-600 text-white"}>
                {form.result === "not_ok" ? "ไม่เรียบร้อย" : "เรียบร้อย"}
              </Badge>
            )}
            {form.contact_phone && (
              <a href={`tel:${form.contact_phone}`} className="inline-flex items-center gap-1 text-primary">
                <Phone className="h-3.5 w-3.5" /> {form.contact_phone}
              </a>
            )}
            {form.close_note && <span className="w-full text-xs text-muted-foreground">สรุปงาน: {form.close_note}</span>}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <F label="ชื่อลูกค้า *">
            <Combobox
              disabled={!canEdit}
              value={form.customer_name ?? ""}
              onChange={pickCustomer}
              options={dir.customers.map((c) => ({
                value: c.name,
                hint: [c.phone, c.address].filter(Boolean).join(" · "),
              }))}
              placeholder="เลือกลูกค้า"
              searchPlaceholder="ค้นหาลูกค้า..."
            />
          </F>
          <F label="หมายเลขเครื่อง (S/N)">
            <Combobox
              disabled={!canEdit}
              value={form.serial_number ?? ""}
              onChange={pickSerial}
              options={dir.machines.map((m) => ({
                value: m.serial,
                hint: [m.customer, m.label].filter(Boolean).join(" · "),
              }))}
              placeholder="เลือก S/N"
              searchPlaceholder="ค้นหา S/N..."
            />
          </F>
          <F label="ที่อยู่">
            <ComboCell
              disabled={!canEdit}
              value={form.customer_address ?? ""}
              onChange={(v) => set("customer_address", v)}
              options={addressOptions}
              placeholder="เลือกที่อยู่"
            />
          </F>
          <F label="ผู้ติดต่อ">
            <Input disabled={!canEdit} value={form.contact_name ?? ""} onChange={(e) => set("contact_name", e.target.value)} />
          </F>
          <F label="เบอร์โทร">
            <ComboCell
              disabled={!canEdit}
              value={form.contact_phone ?? ""}
              onChange={(v) => set("contact_phone", v)}
              options={phoneOptions}
              placeholder="เลือกเบอร์โทร"
            />
          </F>
          <F label="เครื่อง (ยี่ห้อ/รุ่น)">
            <ComboCell
              disabled={!canEdit}
              value={form.machine_label ?? ""}
              onChange={(v) => set("machine_label", v)}
              options={Array.from(new Set(dir.machines.map((m) => m.label).filter(Boolean)))}
              placeholder="เลือกยี่ห้อ/รุ่น"
            />
          </F>
          <F label="ประเภทเซอร์วิส">
            <ComboCell
              disabled={!canEdit}
              value={form.service_type ?? ""}
              onChange={(v) => set("service_type", v)}
              options={SERVICE_TYPES}
              placeholder="เลือกประเภทงาน"
            />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="วันที่">
              <Input disabled={!canEdit} type="date" value={form.visit_date} onChange={(e) => set("visit_date", e.target.value)} />
            </F>
            <F label="เวลา">
              <Input disabled={!canEdit} type="time" value={form.visit_time ?? ""} onChange={(e) => set("visit_time", e.target.value)} />
            </F>
          </div>
          <F label="พนักงานเซอร์วิส (เลือกได้หลายคน)">
            <MultiCombobox
              disabled={!canEdit}
              values={splitNames(form.staff_name)}
              onChange={(list) => set("staff_name", joinNames(list))}
              options={dir.staff}
              placeholder="เลือกช่าง (ติ๊กได้หลายคน)"
              searchPlaceholder="ค้นหาช่าง..."
            />
          </F>
          <F label="ทะเบียนรถ">
            <ComboCell
              disabled={!canEdit}
              value={form.vehicle_plate ?? ""}
              onChange={(v) => set("vehicle_plate", v)}
              options={dir.vehicles}
              placeholder="เลือกทะเบียนรถ"
            />
          </F>
          <div className="sm:col-span-2">
            <F label="รายละเอียดงาน / บันทึกให้ช่าง">
              <Textarea disabled={!canEdit} rows={3} value={form.job_detail ?? ""} onChange={(e) => set("job_detail", e.target.value)} />
            </F>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            ปิด
          </Button>
          {canEdit && (
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} บันทึก
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ---------- Close job ----------
function CloseJobDialog({
  appt,
  onClose,
  onSaved,
}: {
  appt: Appointment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [result, setResult] = useState<"ok" | "not_ok" | null>(null);
  const [note, setNote] = useState("");
  const [resetParts, setResetParts] = useState(true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!result) return toast.error("กรุณาเลือกผลสรุปงาน");
    setSaving(true);
    const doneDate = new Date().toISOString().slice(0, 10);

    const { error } = await supabase
      .from("appointments")
      .update({ status: "closed", result, close_note: note.trim() || null, closed_at: new Date().toISOString() })
      .eq("id", appt.id);
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    let unitId: string | null = null;
    if (appt.serial_number) {
      const { data: unit } = await supabase
        .from("machine_units")
        .select("id")
        .eq("serial_number", appt.serial_number)
        .maybeSingle();
      unitId = unit?.id ?? null;
    }

    await supabase.from("maintenance_logs").insert({
      machine_unit_id: unitId,
      appointment_id: appt.id,
      serial_number: appt.serial_number,
      job_detail: appt.job_detail,
      service_type: appt.service_type,
      result,
      note: note.trim() || null,
      done_date: doneDate,
    });

    if (resetParts && unitId && result === "ok") {
      await supabase
        .from("machine_parts")
        .update({ last_changed_at: doneDate, hours_used: 0 })
        .eq("machine_unit_id", unitId);
    }

    setSaving(false);
    toast.success("ปิดงานและบันทึกประวัติซ่อมบำรุงแล้ว");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>สรุปผลปิดงาน</DialogTitle>
          <DialogDescription>เลือกผลสรุปและบันทึกรายละเอียดเข้าประวัติซ่อมบำรุงของเครื่อง</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={result === "ok" ? "default" : "outline"}
            className={result === "ok" ? "bg-emerald-600 hover:bg-emerald-600/90" : ""}
            onClick={() => setResult("ok")}
          >
            <CheckCircle2 className="mr-1 h-4 w-4" /> เรียบร้อย
          </Button>
          <Button
            variant={result === "not_ok" ? "destructive" : "outline"}
            onClick={() => setResult("not_ok")}
          >
            <XCircle className="mr-1 h-4 w-4" /> ไม่เรียบร้อย
          </Button>
        </div>
        <Textarea rows={3} placeholder="บันทึกสรุปงานสั้นๆ" value={note} onChange={(e) => setNote(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={resetParts} onChange={(e) => setResetParts(e.target.checked)} />
          รีเซ็ตอายุอะไหล่ของเครื่อง {appt.serial_number || "-"} เริ่มนับใหม่
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} ปิดงาน
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

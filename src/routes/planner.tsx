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
  Pencil,
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
import { formatDate, isMachineComplete } from "@/lib/report";
import { PartsAlertPanel } from "@/components/PartsAlertPanel";


export const Route = createFileRoute("/planner")({
  validateSearch: (search: Record<string, unknown>): { sn?: string; customer?: string; job?: string } => {
    const out: { sn?: string; customer?: string; job?: string } = {};
    if (typeof search.sn === "string") out.sn = search.sn;
    if (typeof search.customer === "string") out.customer = search.customer;
    if (typeof search.job === "string") out.job = search.job;
    return out;
  },

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
const TH_DOW_FULL = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

/** เรียงลำดับรายการนัดหมายตามตัวเลือกของผู้ใช้ */
function sortApptList(list: Appointment[], sortBy: string): Appointment[] {
  const arr = [...list];
  const th = (a?: string | null, b?: string | null) => (a ?? "").localeCompare(b ?? "", "th");
  const time = (a: Appointment, b: Appointment) => (a.visit_time ?? "").localeCompare(b.visit_time ?? "");
  switch (sortBy) {
    case "date-desc":
      return arr.sort((a, b) =>
        (b.visit_date + (b.visit_time ?? "")).localeCompare(a.visit_date + (a.visit_time ?? "")));
    case "customer":
      return arr.sort((a, b) => th(a.customer_name, b.customer_name) || time(a, b));
    case "staff":
      return arr.sort((a, b) => th(a.staff_name, b.staff_name) || time(a, b));
    default:
      return arr.sort(time);
  }
}

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
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [sortBy, setSortBy] = useState("date-asc");
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [closing, setClosing] = useState<Appointment | null>(null);
  const [dayDetail, setDayDetail] = useState<string | null>(null);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  // เปิดฟอร์มนัดหมายอัตโนมัติเมื่อถูกส่งมาจากแผงแจ้งเตือนอะไหล่ (?sn=&customer=&job=)
  useEffect(() => {
    if (!search.sn && !search.customer) return;
    setEditing({
      ...newAppointment(iso(new Date())),
      serial_number: search.sn ?? "",
      machine_label: search.sn ?? "",
      customer_name: search.customer ?? "",
      job_detail: search.job ?? "",
    });
    navigate({ search: {}, replace: true });
  }, [search.sn, search.customer, search.job, navigate]);




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
    () => Array.from(new Set(appts.flatMap((a) => splitNames(a.staff_name)))).sort(),
    [appts]
  );

  const vehiclePlates = useMemo(
    () => Array.from(new Set(appts.flatMap((a) => splitNames(a.vehicle_plate)))).sort(),
    [appts]
  );

  const visible = useMemo(
    () =>
      appts.filter(
        (a) =>
          (!staffFilter || splitNames(a.staff_name).includes(staffFilter)) &&
          (!vehicleFilter || splitNames(a.vehicle_plate).includes(vehicleFilter))
      ),
    [appts, staffFilter, vehicleFilter]
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

      <FoldSection title="แผงสถิติภาพรวม">
        <StatsPanel appts={appts} pending={orders.length} />
      </FoldSection>

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
            <div className="flex items-center gap-1 rounded-md border border-input bg-background px-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                aria-label="ค้นหาวันที่"
                className="h-9 bg-transparent text-sm outline-none"
                value={iso(cursor)}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [y, m, d] = e.target.value.split("-").map(Number);
                  setCursor(new Date(y, m - 1, d));
                  setView("day");
                  setDayDetail(e.target.value);
                }}
              />
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
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
            >
              <option value="">รถทุกคัน</option>
              {vehiclePlates.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="เรียงลำดับข้อมูล"
            >
              <option value="date-asc">เรียง: วันที่ เก่า → ใหม่</option>
              <option value="date-desc">เรียง: วันที่ ใหม่ → เก่า</option>
              <option value="customer">เรียง: ชื่อลูกค้า ก-ฮ</option>
              <option value="staff">เรียง: ชื่อช่าง ก-ฮ</option>
            </select>
            {(staffFilter || vehicleFilter) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setStaffFilter("");
                  setVehicleFilter("");
                }}
              >
                ล้างตัวกรอง
              </Button>
            )}
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
              onPickDay={(d) => setDayDetail(d)}
            />
          ) : (
            <div className="space-y-5">
              <TimeGrid
                days={
                  view === "week"
                    ? Array.from({ length: 7 }, (_, i) => iso(addDays(startOfWeek(cursor), i)))
                    : [iso(cursor)]
                }
                appts={visible}
                onPick={(a) => setEditing(a)}
                onPickSlot={
                  isAdmin
                    ? (d, t) => setEditing({ ...newAppointment(d), visit_time: t })
                    : undefined
                }
              />
              {view === "day" && (
                <DayList
                  days={[iso(cursor)]}
                  appts={visible}
                  isAdmin={isAdmin}
                  sortBy={sortBy}
                  onEdit={setEditing}
                  onClose={setClosing}
                  reload={load}
                />
              )}
            </div>
          )}
        </CardContent>

      </Card>

      {isAdmin && (
        <FoldSection title={`ใบสั่งงานรออนุมัติ (${orders.length})`} >
          <PendingOrders orders={orders} reload={load} />
        </FoldSection>
      )}

      <FoldSection title="แจ้งเตือนอะไหล่ล่วงหน้า 30 วัน">
        <PartsAlertPanel withActions={isAdmin} />
      </FoldSection>

      {dayDetail && (
        <DayDetailDialog
          date={dayDetail}
          appts={visible}
          sortBy={sortBy}
          onClose={() => setDayDetail(null)}
          onPick={(a) => {
            setDayDetail(null);
            setEditing(a);
          }}
        />
      )}

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
/** ข้อความสรุปบนบล็อกปฏิทิน: [ลูกค้า] - [งานที่ไปทำ] - [ทะเบียนรถ] */
function apptSummary(a: Appointment) {
  return [
    a.customer_name || "ไม่ระบุลูกค้า",
    a.service_type || a.job_detail || "-",
    a.vehicle_plate || "ยังไม่ระบุรถ",
    splitNames(a.staff_name).join(", "),
  ]
    .filter(Boolean)
    .join(" - ");
}

/** สรุปแบบสั้น เมื่อช่องวันที่มีงานเยอะ: [ลูกค้า] - [ทะเบียนรถ] */
function apptShort(a: Appointment) {
  return [a.customer_name || "ไม่ระบุลูกค้า", a.vehicle_plate || "ไม่ระบุรถ"].join(" - ");
}

/** สีบล็อกแยกตามทะเบียนรถ (พาสเทล) */
const VEHICLE_COLORS = [
  "bg-emerald-100 text-emerald-900 border-emerald-300",
  "bg-sky-100 text-sky-900 border-sky-300",
  "bg-amber-100 text-amber-900 border-amber-300",
  "bg-violet-100 text-violet-900 border-violet-300",
  "bg-rose-100 text-rose-900 border-rose-300",
  "bg-teal-100 text-teal-900 border-teal-300",
  "bg-orange-100 text-orange-900 border-orange-300",
  "bg-indigo-100 text-indigo-900 border-indigo-300",
  "bg-lime-100 text-lime-900 border-lime-300",
  "bg-cyan-100 text-cyan-900 border-cyan-300",
];
function vehicleColor(plate?: string | null) {
  const p = (plate ?? "").split(",")[0]?.trim() ?? "";
  if (!p) return "bg-slate-100 text-slate-700 border-slate-300";
  let h = 0;
  for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) >>> 0;
  return VEHICLE_COLORS[h % VEHICLE_COLORS.length];
}
/** เส้นขอบซ้ายบอกสถานะงาน (ยังคงรหัสสีสถานะไว้) */
function statusEdge(a: Appointment) {
  if (a.status === "closed") return a.result === "not_ok" ? "border-l-4 border-l-red-500" : "border-l-4 border-l-emerald-600";
  if (a.status === "in_progress") return "border-l-4 border-l-red-400";
  return "border-l-4 border-l-amber-400";
}

function VehicleLegend({ appts }: { appts: Appointment[] }) {
  const plates = Array.from(new Set(appts.map((a) => (a.vehicle_plate ?? "").trim()).filter(Boolean))).sort();
  if (plates.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
      <span>รถ:</span>
      {plates.map((p) => (
        <span key={p} className={"rounded-full border px-2 py-0.5 " + vehicleColor(p)}>
          {p}
        </span>
      ))}
    </div>
  );
}

function MonthGrid({
  cursor,
  appts,
  onPick,
  onPickDate,
  onPickDay,
}: {
  cursor: Date;
  appts: Appointment[];
  onPick: (a: Appointment) => void;
  onPickDate?: (date: string) => void;
  onPickDay: (date: string) => void;
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const today = iso(new Date());

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border-l-4 border-l-amber-400 bg-muted" /> รอนัดหมาย</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border-l-4 border-l-red-400 bg-muted" /> งานซ่อมด่วน</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border-l-4 border-l-emerald-600 bg-muted" /> ปิดงานแล้ว</span>
        <span className="ml-auto">แตะวันที่เพื่อดูคิวทั้งวัน{onPickDate ? " · แตะช่องว่างเพื่อเพิ่มงานด่วน" : ""}</span>
      </div>
      <VehicleLegend appts={appts} />
      <div className="grid grid-cols-7 gap-1 text-xs">
        {TH_DOW.map((d) => (
          <div key={d} className="py-1 text-center font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const key = iso(d);
          const list = appts
            .filter((a) => a.visit_date === key)
            .sort((a, b) => (a.visit_time ?? "").localeCompare(b.visit_time ?? ""));
          const dim = d.getMonth() !== cursor.getMonth();
          const max = 6;
          return (
            <div
              key={key}
              onClick={() => onPickDate?.(key)}
              className={
                "flex min-h-32 flex-col rounded-xl border bg-card p-1.5 sm:min-h-40 md:min-h-48 " +
                (onPickDate ? "cursor-pointer hover:border-primary/60 hover:bg-accent/40 " : "") +
                (dim ? "bg-muted/30 text-muted-foreground " : "") +
                (key === today ? "border-primary" : "")
              }
            >
              <div className="mb-1 flex items-center justify-between">
                {list.length > 0 && <span className="text-[10px] text-muted-foreground">{list.length} งาน</span>}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPickDay(key);
                  }}
                  className="ml-auto rounded px-1 font-medium hover:bg-accent"
                >
                  {d.getDate()}
                </button>
              </div>
              <div className="space-y-0.5">
                {list.slice(0, max).map((a) => (
                  <button
                    key={a.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPick(a);
                    }}
                    className={
                      "block w-full whitespace-normal break-words rounded border px-1 py-0.5 text-left text-[10px] leading-snug " +
                      vehicleColor(a.vehicle_plate) +
                      " " +
                      statusEdge(a)
                    }
                    title={apptSummary(a)}
                  >
                    {apptShort(a)}
                  </button>
                ))}
                {list.length > max && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPickDay(key);
                    }}
                    className="w-full rounded px-1 text-left text-[10px] text-primary underline"
                  >
                    +{list.length - max} งาน · ดูทั้งหมด
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** ตารางเวลาแบบ Grid สำหรับมุมมองรายสัปดาห์ / รายวัน */
function TimeGrid({
  days,
  appts,
  onPick,
  onPickSlot,
}: {
  days: string[];
  appts: Appointment[];
  onPick: (a: Appointment) => void;
  onPickSlot?: (date: string, time: string) => void;
}) {
  const hours = Array.from({ length: 13 }, (_, i) => i + 7); // 07:00 - 19:00
  const today = iso(new Date());
  const hourOf = (a: Appointment) => {
    const h = Number((a.visit_time ?? "").slice(0, 2));
    if (Number.isNaN(h)) return hours[0];
    return Math.min(Math.max(h, hours[0]), hours[hours.length - 1]);
  };

  return (
    <div className="space-y-2">
      <VehicleLegend appts={appts} />
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div
            className="grid gap-px rounded-t-xl bg-border text-xs"
            style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}
          >
            <div className="bg-card p-2" />
            {days.map((d) => (
              <div
                key={d}
                className={"bg-card p-2 text-center " + (d === today ? "text-primary" : "")}
              >
                <p className="text-sm font-bold">วัน{TH_DOW_FULL[new Date(d + "T00:00:00").getDay()]}</p>
                <p className="text-xs text-muted-foreground">{formatDate(d)}</p>
              </div>
            ))}
          </div>
          <div
            className="grid gap-px rounded-b-xl bg-border text-xs"
            style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}
          >
            {hours.map((h) => (
              <div key={h} className="contents">
                <div className="bg-muted/40 p-2 text-right text-[11px] text-muted-foreground">
                  {String(h).padStart(2, "0")}:00
                </div>
                {days.map((d) => {
                  const list = appts
                    .filter((a) => a.visit_date === d && hourOf(a) === h)
                    .sort((a, b) => (a.visit_time ?? "").localeCompare(b.visit_time ?? ""));
                  return (
                    <div
                      key={d + h}
                      onClick={() => onPickSlot?.(d, `${String(h).padStart(2, "0")}:00`)}
                      className={
                        "min-h-12 space-y-1 bg-card p-1 " +
                        (onPickSlot ? "cursor-pointer hover:bg-accent/40" : "")
                      }
                    >
                      {list.map((a) => (
                        <button
                          key={a.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onPick(a);
                          }}
                          className={
                            "block w-full whitespace-normal break-words rounded border px-1.5 py-1 text-left leading-tight " +
                            vehicleColor(a.vehicle_plate) +
                            " " +
                            statusEdge(a)
                          }
                          title={apptSummary(a)}
                        >
                          <span className="font-medium">{a.visit_time?.slice(0, 5)}</span> {apptSummary(a)}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Modal รายการนัดหมายทั้งหมดของวันนั้น */
function DayDetailDialog({
  date,
  appts,
  sortBy = "date-asc",
  onClose,
  onPick,
}: {
  date: string;
  appts: Appointment[];
  sortBy?: string;
  onClose: () => void;
  onPick: (a: Appointment) => void;
}) {
  const list = sortApptList(appts.filter((a) => a.visit_date === date), sortBy);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>คิวงานวันที่ {formatDate(date)}</DialogTitle>
          <DialogDescription>ทั้งหมด {list.length} งาน · แตะรายการเพื่อดูรายละเอียดเชิงลึก</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {list.length === 0 && <p className="text-sm text-muted-foreground">ไม่มีนัดหมายในวันนี้</p>}
          {list.map((a) => (
            <button
              key={a.id}
              onClick={() => onPick(a)}
              className={
                "block w-full rounded-xl border p-3 text-left " + vehicleColor(a.vehicle_plate) + " " + statusEdge(a)
              }
            >
              <p className="font-medium">
                {a.visit_time?.slice(0, 5) || "-"} · {a.customer_name || "ไม่ระบุลูกค้า"}
              </p>
              <p className="text-xs opacity-80">
                {[a.service_type, a.serial_number, a.machine_label].filter(Boolean).join(" · ") || "-"}
              </p>
              <p className="text-xs opacity-80">
                ช่าง: {splitNames(a.staff_name).join(", ") || "-"} · รถ: {a.vehicle_plate || "-"} ·{" "}
                {STATUS_LABEL[a.status] ?? a.status}
              </p>
              {a.customer_address && <p className="text-xs opacity-80">{a.customer_address}</p>}
              {a.job_detail && <p className="mt-1 text-sm">{a.job_detail}</p>}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            ปิด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



function DayList({
  days,
  appts,
  isAdmin,
  sortBy = "date-asc",
  onEdit,
  onClose,
  reload,
}: {
  days: string[];
  appts: Appointment[];
  isAdmin: boolean;
  sortBy?: string;
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
        const list = sortApptList(appts.filter((a) => a.visit_date === d), sortBy);
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
                      ช่าง: {splitNames(a.staff_name).join(", ") || "-"} · รถ: {a.vehicle_plate || "-"}
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
  onDeleted,
}: {
  value: Appointment;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const [form, setForm] = useState<Appointment>(value);
  const [editMode, setEditMode] = useState(!value.id);
  const [saving, setSaving] = useState(false);
  const locked = !canEdit || !editMode;
  const dir = useDirectory();
  const set = (k: keyof Appointment, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const pickCustomer = (name: string) => {
    const c = dir.customers.find((x) => x.name === name);
    const m = dir.machines.find((x) => x.customer === name);
    setForm((f) => {
      // เก็บเฉพาะ S/N ที่เป็นของลูกค้ารายใหม่ (ลิงก์ข้อมูลต้องตรงกัน)
      const kept = splitNames(f.serial_number).filter((s) => {
        const owner = dir.machines.find((x) => x.serial === s)?.customer;
        return !owner || owner === name;
      });
      return {
        ...f,
        customer_name: name,
        serial_number: joinNames(kept),
        customer_address: c?.address || m?.address || f.customer_address,
        contact_phone: c?.phone || m?.phone || f.contact_phone,
      };
    });
  };
  /** เลือก S/N ได้หลายเครื่อง — เติมรุ่น/ลูกค้า/ที่อยู่/เบอร์โทรอัตโนมัติ */
  const pickSerials = (serials: string[]) => {
    const hits = serials.map((s) => dir.machines.find((m) => m.serial === s)).filter(Boolean) as typeof dir.machines;
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

  const save = async () => {
    if (!form.customer_name?.trim()) return toast.error("กรุณาเลือกชื่อลูกค้า");
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
    const { data: unit } = await supabase
      .from("machine_units")
      .select("id")
      .eq("serial_number", serials[0] ?? "")
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

  const remove = async () => {
    if (!form.id) return;
    const { error } = await supabase.from("appointments").delete().eq("id", form.id);
    if (error) return toast.error(error.message);
    toast.success("ลบนัดหมายแล้ว");
    (onDeleted ?? onSaved)();
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
              disabled={locked}
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
          <F label={form.customer_name ? `หมายเลขเครื่อง (S/N) — เฉพาะของ ${form.customer_name} (เลือกได้หลายเครื่อง)` : "หมายเลขเครื่อง (S/N) (เลือกได้หลายเครื่อง)"}>
            <MultiCombobox
              disabled={locked}
              values={splitNames(form.serial_number)}
              onChange={pickSerials}
              options={dir.machines
                .filter((m) => !form.customer_name || m.customer === form.customer_name)
                .map((m) => m.serial)
                .filter(Boolean)}
              placeholder={form.customer_name ? "ติ๊กเลือก S/N ของลูกค้ารายนี้" : "ติ๊กเลือก S/N"}
              searchPlaceholder="ค้นหา S/N..."
            />
          </F>
          <F label="ที่อยู่">
            <ComboCell
              disabled={locked}
              value={form.customer_address ?? ""}
              onChange={(v) => set("customer_address", v)}
              options={addressOptions}
              placeholder="เลือกที่อยู่"
            />
          </F>
          <F label="ผู้ติดต่อ">
            <Input disabled={locked} value={form.contact_name ?? ""} onChange={(e) => set("contact_name", e.target.value)} />
          </F>
          <F label="เบอร์โทร">
            <ComboCell
              disabled={locked}
              value={form.contact_phone ?? ""}
              onChange={(v) => set("contact_phone", v)}
              options={phoneOptions}
              placeholder="เลือกเบอร์โทร"
            />
          </F>
          <F label="เครื่อง (ยี่ห้อ/รุ่น)">
            <ComboCell
              disabled={locked}
              value={form.machine_label ?? ""}
              onChange={(v) => set("machine_label", v)}
              options={Array.from(new Set(dir.machines.map((m) => m.label).filter(Boolean)))}
              placeholder="เลือกยี่ห้อ/รุ่น"
            />
          </F>
          <F label="ประเภทเซอร์วิส (เลือกได้หลายงาน)">
            <MultiCombobox
              disabled={locked}
              values={splitNames(form.service_type)}
              onChange={(list) => set("service_type", joinNames(list))}
              options={SERVICE_TYPES}
              placeholder="ติ๊กเลือกประเภทงาน"
              searchPlaceholder="ค้นหาประเภทงาน..."
            />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="วันที่">
              <Input disabled={locked} type="date" value={form.visit_date} onChange={(e) => set("visit_date", e.target.value)} />
            </F>
            <F label="เวลา">
              <Input disabled={locked} type="time" value={form.visit_time ?? ""} onChange={(e) => set("visit_time", e.target.value)} />
            </F>
          </div>
          <F label="พนักงานเซอร์วิส (เลือกได้หลายคน)">
            <MultiCombobox
              disabled={locked}
              values={splitNames(form.staff_name)}
              onChange={(list) => set("staff_name", joinNames(list))}
              options={dir.staff}
              placeholder="เลือกช่าง (ติ๊กได้หลายคน)"
              searchPlaceholder="ค้นหาช่าง..."
            />
          </F>
          <F label="ทะเบียนรถ (เลือกได้หลายคัน)">
            <MultiCombobox
              disabled={locked}
              values={splitNames(form.vehicle_plate)}
              onChange={(list) => set("vehicle_plate", joinNames(list))}
              options={dir.vehicles}
              placeholder="ติ๊กเลือกทะเบียนรถ"
              searchPlaceholder="ค้นหาทะเบียนรถ..."
            />
          </F>
          <div className="sm:col-span-2">
            <F label="รายละเอียดงาน / บันทึกให้ช่าง">
              <Textarea disabled={locked} rows={3} value={form.job_detail ?? ""} onChange={(e) => set("job_detail", e.target.value)} />
            </F>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {canEdit && form.id && (
            <ConfirmButton
              variant="destructive"
              size="default"
              className="sm:mr-auto"
              title="ลบรายการนัดหมายนี้?"
              description="ระบบจะลบนัดหมายนี้ออกจากปฏิทินและฐานข้อมูลทันที และไม่สามารถย้อนกลับได้"
              onConfirm={remove}
            >
              <Trash2 className="mr-1 h-4 w-4" /> ลบนัดหมายนี้
            </ConfirmButton>
          )}
          <Button variant="outline" onClick={onClose}>
            ปิด
          </Button>
          {canEdit && !editMode && (
            <Button onClick={() => setEditMode(true)}>
              <Pencil className="mr-1 h-4 w-4" /> แก้ไขข้อมูลนัดหมาย
            </Button>
          )}
          {canEdit && editMode && (
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

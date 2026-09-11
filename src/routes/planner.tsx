import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Camera,
  FileDown,
  Pencil,
  Phone,
  Trash2,
  XCircle,
} from "lucide-react";
import { deleteAsAdmin, useAccess } from "@/lib/access";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SERVICE_TYPES, useServiceOptions, WorkOrderDialog } from "@/components/WorkOrderDialog";
import { Combobox } from "@/components/ui/combobox";
import { MultiCombobox, splitNames, joinNames } from "@/components/ui/multi-combobox";
import { ensureDirectoryEntries, useDirectory } from "@/lib/directory";
import { elementToPdfBlobPaged, formatDate, isMachineComplete, saveFile } from "@/lib/report";
import { PartsAlertPanel } from "@/components/PartsAlertPanel";
import { JobReportsPanel } from "@/components/JobReportsPanel";
import { PART_CATEGORIES } from "@/lib/job-fields";


export const Route = createFileRoute("/planner")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { sn?: string; customer?: string; job?: string; date?: string } => {
    const out: { sn?: string; customer?: string; job?: string; date?: string } = {};
    if (typeof search.sn === "string") out.sn = search.sn;
    if (typeof search.customer === "string") out.customer = search.customer;
    if (typeof search.job === "string") out.job = search.job;
    if (typeof search.date === "string") out.date = search.date;
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
  sales_rep?: string | null;
  status: string;
  result: string | null;
  close_note: string | null;
  closed_at?: string | null;
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
const TH_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
/** หัวข้อวันที่แบบไทยเต็ม เช่น 25 ส.ค. 2569 */
const thaiCellDate = (d: Date) =>
  `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;

/** จัดกลุ่มบล็อกงานตามเลขทะเบียนรถ แล้วเรียงตามเวลาในกลุ่ม */
function byVehicleThenTime(a: Appointment, b: Appointment) {
  const plate = (x: Appointment) => (splitNames(x.vehicle_plate)[0] ?? "zzzz").toLowerCase();
  return (
    plate(a).localeCompare(plate(b), "th") ||
    (a.visit_time ?? "").localeCompare(b.visit_time ?? "")
  );
}



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
  className,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={"rounded-lg border bg-card " + (className ?? "")}>
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
  const monthRef = useRef<HTMLDivElement>(null);
  const weekRef = useRef<HTMLDivElement>(null);
  const dayRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<"" | "image" | "pdf">("");

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

  // กระโดดไปยังวันนัดหมายที่ค้นเจอ (?date=YYYY-MM-DD) แล้วเปิดรายละเอียดงานวันนั้นทันที
  useEffect(() => {
    if (!search.date) return;
    const d = new Date(search.date + "T00:00:00");
    if (Number.isNaN(d.getTime())) return;
    setCursor(d);
    setView("day");
    setDayDetail(search.date);
    navigate({ search: {}, replace: true });
  }, [search.date, navigate]);




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

  const monthName = `${TH_MONTHS[cursor.getMonth()]}-${cursor.getFullYear() + 543}`;
  const viewLabel = view === "month" ? "รายเดือน" : view === "week" ? "รายสัปดาห์" : "รายวัน";
  const fileLabel = view === "month" ? monthName : view === "week" ? `สัปดาห์-${iso(startOfWeek(cursor))}` : iso(cursor);
  const activeRef = view === "month" ? monthRef : view === "week" ? weekRef : dayRef;

  /** บันทึกตารางปฏิทินเป็นไฟล์ภาพ หรือ PDF เต็มใบ */
  const exportView = async (
    kind: "image" | "pdf",
    ref: React.RefObject<HTMLDivElement | null>,
    label: string,
    fileLabel: string
  ) => {
    const el = ref.current;
    if (!el) return;
    setExporting(kind);
    // คลายการตัดขอบ (scroll) ชั่วคราว เพื่อให้จับภาพได้เต็มตารางทุกมุมมอง
    el.classList.add("export-full");
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const full = { width: el.scrollWidth, height: el.scrollHeight };
    try {
      if (kind === "pdf") {
        const blob = await elementToPdfBlobPaged(el, 1, { orientation: "landscape", size: full });
        await saveFile(blob, `ตารางงาน-${fileLabel}.pdf`);
      } else {
        const { toJpeg } = await import("html-to-image");
        const dataUrl = await toJpeg(el, {
          backgroundColor: "#ffffff",
          cacheBust: true,
          pixelRatio: 2,
          quality: 0.9,
          width: full.width,
          height: full.height,
          style: { width: `${full.width}px`, height: `${full.height}px` },
        });
        const blob = await (await fetch(dataUrl)).blob();
        await saveFile(blob, `ตารางงาน-${fileLabel}.jpg`);
      }
      toast.success(`บันทึกตาราง${label}เรียบร้อย`);
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ: " + (e as Error).message);
    } finally {
      el.classList.remove("export-full");
      setExporting("");
    }
  };



  const title =
    view === "month"
      ? `${TH_MONTHS[cursor.getMonth()]} ${cursor.getFullYear() + 543}`
      : view === "week"
        ? `${formatDate(iso(startOfWeek(cursor)))} - ${formatDate(iso(addDays(startOfWeek(cursor), 6)))}`
        : formatDate(iso(cursor));

  return (
    <div className="space-y-5 p-2 sm:p-4 pb-6">
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

      {/* แผงด้านข้างย้ายมาอยู่ด้านบน เพื่อให้ปฏิทินขยายเต็มความกว้าง */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="hidden md:block">
          <FoldSection title="แผงสถิติภาพรวม">
            <StatsPanel appts={appts} pending={orders.length} />
          </FoldSection>
        </div>

        {isAdmin && (
          <FoldSection title={`ใบสั่งงานรออนุมัติ (${orders.length})`} defaultOpen className="md:col-span-2 xl:col-span-1">
            <PendingOrders orders={orders} reload={load} />
          </FoldSection>
        )}

        <FoldSection title="ใบสั่งงานที่อนุมัติแล้ว (ส่งออกรูป/PDF)">
          <ApprovedOrders />
        </FoldSection>

        <FoldSection title="แจ้งเตือนอะไหล่ล่วงหน้า 30 วัน">
          <PartsAlertPanel withActions={isAdmin} />
        </FoldSection>

        <FoldSection title="รายงานสรุปงาน (รายวัน/รายเดือน)" className="md:col-span-2 xl:col-span-1">
          <JobReportsPanel
            onPickDate={(d) => {
              const [y, m, dd] = d.split("-").map(Number);
              setCursor(new Date(y, m - 1, dd));
              setView("day");
              setDayDetail(d);
            }}
          />
        </FoldSection>
      </div>

      <Card className="h-fit">
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
            <div className="flex overflow-x-auto whitespace-nowrap scrollbar-none mb-4">
              {(["month", "week", "day"] as const).map((v) => (
                <Button
                  key={v}
                  size="sm"
                  className="shrink-0"
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
            {(view === "month" || view === "week" || view === "day") && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={exporting !== ""}
                  onClick={() => exportView("image", activeRef, viewLabel, fileLabel)}
                >
                  {exporting === "image" ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="mr-1 h-4 w-4" />
                  )}
                  📷 📸 บันทึกตาราง{viewLabel}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exporting !== ""}
                  onClick={() => exportView("pdf", activeRef, viewLabel, fileLabel)}
                >
                  {exporting === "pdf" ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="mr-1 h-4 w-4" />
                  )}
                  PDF เต็มใบ
                </Button>
              </>
            )}
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
            <div ref={monthRef} className="rounded-xl bg-card p-2">
              <p className="mb-2 text-center text-sm font-bold">ตารางนัดหมายบริการ · {title}</p>
              <MonthGrid
                cursor={cursor}
                appts={visible}
                onPick={(a) => setEditing(a)}
                onPickDate={isAdmin ? (d) => setEditing(newAppointment(d)) : undefined}
                onPickDay={(d) => setDayDetail(d)}
              />
            </div>
          ) : (
            <div className="space-y-5">
              <div ref={view === "week" ? weekRef : dayRef} className="rounded-xl bg-card p-2">
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
              </div>
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
    sales_rep: "",
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
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
  const [openEdit, setOpenEdit] = useState<Record<string, boolean>>({});

  const patch = (id: string, k: keyof WorkOrder, v: string) =>
    setEdit((e) => ({ ...e, [id]: { ...e[id], [k]: v } }));

  /** ค่าปัจจุบันของช่อง (ค่าที่แอดมินแก้ไว้ ถ้ายังไม่แก้ใช้ค่าเดิม) */
  const val = (o: WorkOrder, k: keyof WorkOrder) =>
    ((edit[o.id]?.[k] as string | null | undefined) ?? (o[k] as string | null | undefined) ?? "") as string;

  /** บันทึกการแก้ไขลงใบสั่งงานเดิม (ยังไม่อนุมัติ) */
  const saveEdits = async (o: WorkOrder) => {
    const p = edit[o.id];
    if (!p || Object.keys(p).length === 0) return toast.message("ยังไม่มีการแก้ไข");
    setBusy(o.id);
    const { error } = await supabase.from("work_orders").update(p as never).eq("id", o.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("บันทึกการแก้ไขใบสั่งงานแล้ว");
    setEdit((e) => ({ ...e, [o.id]: {} }));
    reload();
  };


  const approve = async (o: WorkOrder) => {
    const p = edit[o.id] ?? {};
    const m = { ...o, ...p } as WorkOrder & Record<string, any>;
    setBusy(o.id);
    const { data: unit } = await supabase
      .from("machine_units")
      .select("id")
      .eq("serial_number", m.serial_number ?? "")
      .maybeSingle();
    const { error } = await supabase.from("appointments").insert({
      work_order_id: o.id,
      machine_unit_id: unit?.id ?? null,
      customer_name: m.customer_name,
      customer_address: m.customer_address,
      contact_name: m.contact_name,
      contact_phone: m.contact_phone,
      machine_label: m.machine_label,
      serial_number: m.serial_number,
      job_detail: m.job_detail,
      service_type: m.service_type,
      visit_date: m.visit_date as string,
      visit_time: m.visit_time,
      staff_name: m.staff_name,
      vehicle_plate: m.vehicle_plate,
      sales_rep: m.sales_rep ?? null,
      job_no: m.job_no ?? null,
      priority: m.priority ?? null,
      billing_type: m.billing_type ?? null,
      po_number: m.po_number ?? null,
      billing_note: m.billing_note ?? null,
      work_types: m.work_types ?? null,
      depart_time: m.depart_time ?? null,
      return_time: m.return_time ?? null,
      logistics_note: m.logistics_note ?? null,
      safety_gear: m.safety_gear ?? null,
      status: "scheduled",
    });
    // เก็บค่าที่แอดมินแก้ไว้ลงใบสั่งงานเดิมด้วย เพื่อให้เอกสารตรงกับงานจริง
    if (!error) await supabase.from("work_orders").update({ ...(p as never), status: "approved" }).eq("id", o.id);

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
          <div key={o.id} className="space-y-3 overflow-hidden rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="break-words font-semibold leading-snug">{val(o, "customer_name")}</p>
                <p className="break-words text-xs leading-snug text-muted-foreground">
                  {[val(o, "machine_label"), val(o, "serial_number"), val(o, "service_type")].filter(Boolean).join(" · ")}
                </p>
                <p className="break-words text-xs leading-snug text-muted-foreground">
                  {[val(o, "contact_name"), val(o, "contact_phone"), val(o, "customer_address")].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0 whitespace-nowrap">
                รออนุมัติ
              </Badge>
            </div>

            <p className="whitespace-pre-wrap break-words text-sm">{val(o, "job_detail")}</p>

            <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="min-w-0 space-y-1">
                <Label className="text-xs">วันที่เข้าบริการ</Label>
                <Input
                  className="w-full"
                  type="date"
                  value={val(o, "visit_date")}
                  onChange={(e) => patch(o.id, "visit_date", e.target.value)}
                />
              </div>
              <div className="min-w-0 space-y-1">
                <Label className="text-xs">เวลานัดหมาย</Label>
                <Input
                  className="w-full"
                  type="time"
                  value={val(o, "visit_time")}
                  onChange={(e) => patch(o.id, "visit_time", e.target.value)}
                />
              </div>
              <div className="min-w-0 space-y-1">
                <Label className="text-xs">ช่างที่รับงาน</Label>
                <MultiCombobox
                  values={splitNames(val(o, "staff_name"))}
                  onChange={(list) => patch(o.id, "staff_name", joinNames(list))}
                  options={staff}
                  placeholder="เลือกช่าง (หลายคนได้)"
                  searchPlaceholder="ค้นหาช่าง..."
                />
              </div>
              <div className="min-w-0 space-y-1">
                <Label className="text-xs">ทะเบียนรถ</Label>
                <ComboCell
                  value={val(o, "vehicle_plate")}
                  onChange={(v) => patch(o.id, "vehicle_plate", v)}
                  options={vehicles}
                  placeholder="เลือกทะเบียนรถ"
                />
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => setOpenEdit((s) => ({ ...s, [o.id]: !s[o.id] }))}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              {openEdit[o.id] ? "ซ่อนการแก้ไขรายละเอียด" : "แก้ไขรายละเอียดใบสั่งงาน"}
            </Button>

            {openEdit[o.id] && (
              <div className="grid min-w-0 gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
                <EditField label="ชื่อลูกค้า">
                  <Input value={val(o, "customer_name")} onChange={(e) => patch(o.id, "customer_name", e.target.value)} />
                </EditField>
                <EditField label="ที่อยู่ลูกค้า">
                  <Input value={val(o, "customer_address")} onChange={(e) => patch(o.id, "customer_address", e.target.value)} />
                </EditField>
                <EditField label="ชื่อผู้ติดต่อ">
                  <Input value={val(o, "contact_name")} onChange={(e) => patch(o.id, "contact_name", e.target.value)} />
                </EditField>
                <EditField label="เบอร์โทรผู้ติดต่อ">
                  <Input value={val(o, "contact_phone")} onChange={(e) => patch(o.id, "contact_phone", e.target.value)} />
                </EditField>
                <EditField label="เครื่อง (ยี่ห้อ/รุ่น)">
                  <Input value={val(o, "machine_label")} onChange={(e) => patch(o.id, "machine_label", e.target.value)} />
                </EditField>
                <EditField label="หมายเลขเครื่อง (S/N)">
                  <Input value={val(o, "serial_number")} onChange={(e) => patch(o.id, "serial_number", e.target.value)} />
                </EditField>
                <EditField label="ประเภทเซอร์วิส">
                  <MultiCombobox
                    values={splitNames(val(o, "service_type"))}
                    onChange={(list) => patch(o.id, "service_type", joinNames(list))}
                    options={SERVICE_TYPES}
                    placeholder="ติ๊กเลือกประเภทงาน"
                    searchPlaceholder="ค้นหาประเภทงาน..."
                  />
                </EditField>
                <EditField label="พนักงานขาย (เซลล์)">
                  <Input
                    value={val(o, "sales_rep" as keyof WorkOrder)}
                    onChange={(e) => patch(o.id, "sales_rep" as keyof WorkOrder, e.target.value)}
                  />
                </EditField>
                <div className="sm:col-span-2">
                  <EditField label="รายละเอียดงาน">
                    <Textarea rows={3} value={val(o, "job_detail")} onChange={(e) => patch(o.id, "job_detail", e.target.value)} />
                  </EditField>
                </div>
                <div className="sm:col-span-2">
                  <Button size="sm" variant="secondary" onClick={() => saveEdits(o)} disabled={busy === o.id}>
                    {busy === o.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} บันทึกการแก้ไข
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
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

// ---------- Approved work orders (export) ----------
/** ใบสั่งงานที่อนุมัติแล้ว: ส่งออกเป็นรูปภาพ หรือ PDF ได้ทันที */
function ApprovedOrders() {
  const [rows, setRows] = useState<WorkOrder[]>([]);
  const [busy, setBusy] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    supabase
      .from("work_orders")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setRows((data ?? []) as unknown as WorkOrder[]));
  }, []);

  const selected = rows.filter((o) => picked[o.id]);

  const withExportMode = async <T,>(els: HTMLElement[], fn: () => Promise<T>): Promise<T> => {
    els.forEach((e) => e.classList.add("export-full"));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      return await fn();
    } finally {
      els.forEach((e) => e.classList.remove("export-full"));
    }
  };

  /** ส่งออกใบเดียว — จัดให้พอดีกระดาษ A4 หน้าเดียว */
  const exportOne = async (o: WorkOrder, kind: "image" | "pdf") => {
    const el = refs.current[o.id];
    if (!el) return;
    const name = `ใบสั่งงาน-${o.customer_name || o.id.slice(0, 6)}`;
    setBusy(o.id + kind);
    try {
      const { elementToA4ImageBlob, elementsToA4PdfBlob } = await import("@/lib/report");
      const blob = await withExportMode([el], () =>
        kind === "pdf" ? elementsToA4PdfBlob([el]) : elementToA4ImageBlob(el),
      );
      await saveFile(blob, `${name}.${kind === "pdf" ? "pdf" : "jpg"}`);
      toast.success("บันทึกใบสั่งงานเรียบร้อย (A4 หน้าเดียว)");
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ: " + (e as Error).message);
    } finally {
      setBusy("");
    }
  };

  /** ส่งออกใบที่ติ๊กเลือกไว้ — PDF รวมเล่ม (1 ใบ = 1 หน้า A4) หรือรูปภาพทีละใบ */
  const exportSelected = async (kind: "image" | "pdf") => {
    if (selected.length === 0) return;
    setBusy("bulk" + kind);
    try {
      const { elementToA4ImageBlob, elementsToA4PdfBlob } = await import("@/lib/report");
      const els = selected.map((o) => refs.current[o.id]).filter(Boolean) as HTMLDivElement[];
      if (kind === "pdf") {
        const blob = await withExportMode(els, () => elementsToA4PdfBlob(els));
        await saveFile(blob, `ใบสั่งงาน-${selected.length}ใบ.pdf`);
      } else {
        for (const o of selected) {
          const el = refs.current[o.id];
          if (!el) continue;
          const blob = await withExportMode([el], () => elementToA4ImageBlob(el));
          await saveFile(blob, `ใบสั่งงาน-${o.customer_name || o.id.slice(0, 6)}.jpg`);
        }
      }
      toast.success(`บันทึก ${selected.length} ใบเรียบร้อย (A4 หน้าเดียวต่อใบ)`);
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ: " + (e as Error).message);
    } finally {
      setBusy("");
    }
  };

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">ยังไม่มีใบสั่งงานที่อนุมัติ</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={selected.length === rows.length}
            onChange={(e) =>
              setPicked(e.target.checked ? Object.fromEntries(rows.map((r) => [r.id, true])) : {})
            }
          />
          เลือกทั้งหมด ({selected.length}/{rows.length})
        </label>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" disabled={!!busy || selected.length === 0} onClick={() => exportSelected("image")}>
            {busy === "bulkimage" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Camera className="mr-1 h-4 w-4" />}
            รูปภาพ A4 ที่เลือก
          </Button>
          <Button size="sm" disabled={!!busy || selected.length === 0} onClick={() => exportSelected("pdf")}>
            {busy === "bulkpdf" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />}
            PDF A4 ที่เลือก
          </Button>
        </div>
      </div>

      {rows.map((o) => (
        <div key={o.id} className="space-y-2 rounded-lg border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={!!picked[o.id]}
              onChange={(e) => setPicked((p) => ({ ...p, [o.id]: e.target.checked }))}
            />
            เลือกใบนี้เพื่อส่งออก
          </label>
          <div
            ref={(n) => {
              refs.current[o.id] = n;
            }}
            className="space-y-1 rounded-md bg-white p-3 text-slate-800"
          >
            <p className="text-base font-bold">ใบสั่งงานบริการ</p>
            <p className="font-semibold">{o.customer_name}</p>
            <p className="text-xs">{[o.contact_name, o.contact_phone, o.customer_address].filter(Boolean).join(" · ")}</p>
            <p className="text-xs">{[o.machine_label, o.serial_number, o.service_type].filter(Boolean).join(" · ")}</p>
            <p className="text-xs">
              วันที่ {formatDate(o.visit_date ?? "")} {o.visit_time ?? ""} · ช่าง {o.staff_name || "-"} · รถ {o.vehicle_plate || "-"}
              {o.sales_rep ? ` · เซลล์ ${o.sales_rep}` : ""}
            </p>
            <p className="text-sm">{o.job_detail}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => exportOne(o, "image")}>
              {busy === o.id + "image" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Camera className="mr-1 h-4 w-4" />}
              บันทึกรูปภาพ
            </Button>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => exportOne(o, "pdf")}>
              {busy === o.id + "pdf" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />}
              บันทึก PDF
            </Button>
          </div>
        </div>
      ))}
    </div>
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

/** สีขอบการ์ด (3px) แยกตามทะเบียนรถ */
const VEHICLE_BORDERS = [
  "border-emerald-500",
  "border-sky-500",
  "border-amber-500",
  "border-violet-500",
  "border-rose-500",
  "border-teal-500",
  "border-orange-500",
  "border-indigo-500",
  "border-lime-500",
  "border-cyan-500",
];
function vehicleBorder(plate?: string | null) {
  const p = (plate ?? "").split(",")[0]?.trim() ?? "";
  if (!p) return "border-slate-300";
  let h = 0;
  for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) >>> 0;
  return VEHICLE_BORDERS[h % VEHICLE_BORDERS.length];
}
/** พื้นหลังพาสเทลของการ์ด แยกตามช่างเทคนิค */
const STAFF_BGS = [
  "bg-rose-50",
  "bg-sky-50",
  "bg-amber-50",
  "bg-violet-50",
  "bg-emerald-50",
  "bg-teal-50",
  "bg-orange-50",
  "bg-indigo-50",
  "bg-lime-50",
  "bg-cyan-50",
];
function staffBg(name?: string | null) {
  const n = splitNames(name)[0] ?? "";
  if (!n) return "bg-white";
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  return STAFF_BGS[h % STAFF_BGS.length];
}
/** คลาสการ์ดนัดหมายมาตรฐาน: ขอบ 3px ตามรถ + พื้นพาสเทลตามช่าง + ตัวหนังสือ slate-800 */
function apptCardClass(a: Appointment) {
  return "border-[3px] text-slate-800 " + vehicleBorder(a.vehicle_plate) + " " + staffBg(a.staff_name);
}
/** ความกว้างคอลัมน์: จันทร์–ศุกร์ เท่ากัน (~17.4%), เสาร์ ~10%, อาทิตย์ ~3% (แถบแดง) */
const WEEK_COLS = "repeat(5, minmax(0, 17.4fr)) minmax(0, 10fr) minmax(40px, 3fr)";
/** เส้นขอบซ้ายบอกสถานะงาน (ยังคงรหัสสีสถานะไว้) */
function statusEdge(a: Appointment) {
  if (a.status === "closed") return a.result === "not_ok" ? "border-l-4 border-l-red-500" : "border-l-4 border-l-emerald-600";
  if (a.status === "in_progress") return "border-l-4 border-l-red-400";
  return "border-l-4 border-l-amber-400";
}

function VehicleLegend({ appts }: { appts: Appointment[] }) {
  const plates = Array.from(new Set(appts.flatMap((a) => splitNames(a.vehicle_plate)))).sort();
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
      <div className="scrollbar-none flex overflow-x-auto whitespace-nowrap pb-1">
      <div className="grid min-w-[900px] flex-1 gap-1 text-xs" style={{ gridTemplateColumns: WEEK_COLS }}>
        {TH_DOW.map((d, i) => (
          <div
            key={d}
            className={
              "py-1 text-center font-medium " +
              (i === 6 ? "text-[10px] text-red-500" : i === 5 ? "text-muted-foreground/80" : "text-muted-foreground")
            }
          >
            {d}
          </div>
        ))}
        {days.map((d) => {
          const key = iso(d);
          const list = appts.filter((a) => a.visit_date === key).sort(byVehicleThenTime);

          const dim = d.getMonth() !== cursor.getMonth();

          // วันอาทิตย์: แถบแดงวันหยุดแคบพิเศษ พร้อมจุด mini แทนงาน
          if (d.getDay() === 0) {
            return (
              <div
                key={key}
                onClick={() => onPickDay(key)}
                title={`วันอาทิตย์ที่ ${formatDate(key)} · ${list.length} งาน`}
                className={
                  "flex min-h-32 cursor-pointer flex-col items-center rounded-full border sm:min-h-40 md:min-h-48 " +
                  (key === today ? "border-red-500 bg-red-100 " : "border-red-200 bg-red-50 ") +
                  (dim ? "opacity-40" : "")
                }
              >
                <span className="mt-1 text-[9px] font-bold leading-none text-red-500">{d.getDate()}</span>
                <div className="mt-1 flex w-1.5 flex-1 flex-col items-center gap-1 rounded-full bg-red-400/70 py-1">
                  {list.map((a) => (
                    <button
                      key={a.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPick(a);
                      }}
                      title={apptSummary(a)}
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-white shadow ring-1 ring-red-600"
                    />
                  ))}
                </div>
              </div>
            );
          }

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
              <div className="mb-1 flex items-center justify-between gap-1">
                {list.length > 0 && <span className="text-[10px] text-muted-foreground">{list.length} งาน</span>}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPickDay(key);
                  }}
                  className="ml-auto rounded px-1 text-[10px] font-semibold leading-tight hover:bg-accent sm:text-[11px]"
                >
                  {thaiCellDate(d)}
                </button>
              </div>

              <div className="scrollbar-none max-h-24 space-y-0.5 overflow-y-auto">
                {list.map((a) => (
                  <button
                    key={a.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPick(a);
                    }}
                    className={
                      "block w-full rounded px-1 py-0.5 text-left text-[10px] font-medium leading-snug " +
                      apptCardClass(a)
                    }
                    title={apptSummary(a)}
                  >
                    <span className="block truncate">{a.customer_name || "ไม่ระบุลูกค้า"}</span>
                    <span className="block truncate text-xs opacity-80">
                      👤 {splitNames(a.staff_name).join(", ") || "-"}
                    </span>
                    <span className="block truncate text-xs opacity-80">
                      🚚 {splitNames(a.vehicle_plate).join(" / ") || "ยังไม่ระบุรถ"}
                    </span>
                    {a.sales_rep && (
                      <span className="block truncate text-xs opacity-80">💼 {a.sales_rep}</span>
                    )}
                  </button>
                ))}

              </div>
            </div>
          );
        })}
      </div>
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
  const morning = [7, 8, 9, 10, 11]; // เช้า 07:00 - 12:00
  const afternoon = [13, 14, 15, 16, 17, 18, 19]; // บ่าย 13:00 - 19:00
  const today = iso(new Date());
  const isWeek = days.length > 1;
  const cols = isWeek ? `56px ${WEEK_COLS}` : "56px minmax(0,1fr)";
  const hourOf = (a: Appointment) => {
    let h = Number((a.visit_time ?? "").slice(0, 2));
    if (Number.isNaN(h)) h = morning[0];
    if (h === 12) h = 13; // เลี่ยงช่วงพักเที่ยง
    return Math.min(Math.max(h, morning[0]), afternoon[afternoon.length - 1]);
  };
  const dowOf = (d: string) => new Date(d + "T00:00:00").getDay();

  const renderHourRow = (h: number) => (
    <div key={h} className="contents">
      <div className="bg-muted/40 p-2 text-right text-[11px] text-muted-foreground">
        {String(h).padStart(2, "0")}:00
      </div>
      {days.map((d) => {
        const list = appts
          .filter((a) => a.visit_date === d && hourOf(a) === h)
          .sort(byVehicleThenTime);

        // วันอาทิตย์: แถบแดงแคบพร้อมจุด mini
        if (isWeek && dowOf(d) === 0) {
          return (
            <div key={d + h} className="flex min-h-12 justify-center bg-red-50/70 p-1">
              <div className="flex w-1.5 flex-col items-center gap-1 rounded-full bg-red-400/60 py-0.5">
                {list.map((a) => (
                  <button
                    key={a.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPick(a);
                    }}
                    title={apptSummary(a)}
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-white shadow ring-1 ring-red-600"
                  />
                ))}
              </div>
            </div>
          );
        }

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
                  "block w-full whitespace-normal break-words rounded px-1.5 py-1 text-left leading-tight " +
                  apptCardClass(a)
                }
                title={apptSummary(a)}
              >
                <span className="flex items-baseline gap-1 text-[10px]">
                  <span className="font-semibold">{a.visit_time?.slice(0, 5) || "--:--"}</span>
                  <span className="truncate text-xs opacity-70">{splitNames(a.staff_name).join(", ") || "-"}</span>
                </span>
                <span className="block truncate text-xs font-bold">{a.customer_name || "ไม่ระบุลูกค้า"}</span>
                <span className="block truncate text-[10px] opacity-80">
                  {splitNames(a.service_type).join(" / ") || a.job_detail || "-"}
                </span>
                <span className="block truncate text-xs opacity-80">
                  🚚 {splitNames(a.vehicle_plate).join(" / ") || "ยังไม่ระบุรถ"}
                </span>
                {a.sales_rep && <span className="block truncate text-xs opacity-80">💼 {a.sales_rep}</span>}

              </button>
            ))}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-2">
      <VehicleLegend appts={appts} />
      <div className="scrollbar-none flex overflow-x-auto whitespace-nowrap">
        <div className={isWeek ? "min-w-[900px] flex-1" : "min-w-[560px] flex-1"}>
          <div
            className="grid gap-px rounded-t-xl bg-border text-xs"
            style={{ gridTemplateColumns: cols }}
          >
            <div className="bg-card p-2" />
            {days.map((d) => {
              if (isWeek && dowOf(d) === 0) {
                return (
                  <div key={d} className="bg-red-50 p-1 text-center text-red-500">
                    <p className="text-[10px] font-bold leading-tight">อา</p>
                    <p className="text-[9px] leading-tight">{new Date(d + "T00:00:00").getDate()}</p>
                  </div>
                );
              }
              return (
                <div
                  key={d}
                  className={"bg-card p-2 text-center " + (d === today ? "text-primary" : "")}
                >
                  <p className="text-sm font-bold">วัน{TH_DOW_FULL[dowOf(d)]}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(d)}</p>
                </div>
              );
            })}
          </div>
          <div
            className="grid gap-px rounded-b-xl bg-border text-xs"
            style={{ gridTemplateColumns: cols }}
          >
            {morning.map(renderHourRow)}
            <div style={{ gridColumn: "1 / -1" }} className="bg-amber-50 px-2 py-1 text-center text-[11px] font-medium text-amber-700">
              พักเที่ยง 12:00 – 13:00
            </div>
            {afternoon.map(renderHourRow)}
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
  const list = sortApptList(appts.filter((a) => a.visit_date === date), sortBy).sort(byVehicleThenTime);
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
              <p className="text-xs opacity-80">เครื่อง: {splitNames(a.serial_number).join(" / ") || "-"}{a.machine_label ? ` (${splitNames(a.machine_label).join(" / ")})` : ""}</p>
              <p className="text-xs opacity-80">ประเภทงาน: {splitNames(a.service_type).join(" / ") || "-"}</p>
              <p className="text-xs opacity-80">
                {a.sales_rep ? `เซลล์: ${a.sales_rep} · ` : ""}ช่าง: {splitNames(a.staff_name).join(", ") || "-"} · รถ: {splitNames(a.vehicle_plate).join(" / ") || "-"} ·{" "}
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
    const { error } = await deleteAsAdmin("appointments", { id: a.id });
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
                      {a.sales_rep ? ` · เซลล์: ${a.sales_rep}` : ""}
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
                    <Button size="sm" variant="secondary" onClick={() => onClose(a)}>
                      {a.status === "closed" ? "แก้ไขผลปิดงาน" : "ปิดงาน"}
                    </Button>
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
      sales_rep: form.sales_rep ?? null,
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
    const { error } = await deleteAsAdmin("appointments", { id: form.id });
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

        {form.id && (
          <div className="space-y-2 rounded-xl border p-3 text-sm">
            <BadgeRow label="เครื่อง (S/N)" items={splitNames(form.serial_number)} />
            <BadgeRow label="ประเภทงาน" items={splitNames(form.service_type)} />
            <BadgeRow label="ทะเบียนรถ" items={splitNames(form.vehicle_plate)} />
            <BadgeRow label="ช่างที่เข้างาน" items={splitNames(form.staff_name)} />
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
          <F label="พนักงานขาย (เซลล์) ที่ดูแล">
            <Input
              disabled={locked}
              value={form.sales_rep ?? ""}
              onChange={(e) => set("sales_rep", e.target.value)}
              placeholder="ชื่อเซลล์ผู้ดูแลลูกค้า"
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
  const isEdit = appt.status === "closed";
  const [result, setResult] = useState<"ok" | "not_ok" | null>(
    isEdit ? ((appt.result as "ok" | "not_ok" | null) ?? "ok") : null,
  );
  const [note, setNote] = useState(appt.close_note ?? "");
  const [resetParts, setResetParts] = useState(!isEdit);
  const [saving, setSaving] = useState(false);
  const [quotation, setQuotation] = useState(false);
  const [cats, setCats] = useState<string[]>([]);
  const [partsNote, setPartsNote] = useState("");

  // โหลดรายละเอียดปิดงานเดิมเมื่อเข้ามาแก้ไข
  useEffect(() => {
    if (!isEdit || !appt.id) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("appointments")
        .select("quotation_required, parts_categories, parts_note")
        .eq("id", appt.id)
        .maybeSingle();
      if (!alive || !data) return;
      setQuotation(!!data.quotation_required);
      setCats((data.parts_categories ?? "").split(",").map((x) => x.trim()).filter(Boolean));
      setPartsNote(data.parts_note ?? "");
    })();
    return () => {
      alive = false;
    };
  }, [isEdit, appt.id]);
  const toggleCat = (c: string) =>
    setCats((list) => (list.includes(c) ? list.filter((x) => x !== c) : [...list, c]));

  const submit = async () => {
    if (!result) return toast.error("กรุณาเลือกผลสรุปงาน");
    setSaving(true);
    const doneDate = new Date().toISOString().slice(0, 10);

    const { error } = await supabase
      .from("appointments")
      .update({
        status: "closed",
        result,
        close_note: note.trim() || null,
        closed_at: appt.closed_at ?? new Date().toISOString(),
        quotation_required: quotation,
        parts_categories: cats.join(", ") || null,
        parts_note: partsNote.trim() || null,
      })
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

    if (isEdit) {
      await supabase
        .from("maintenance_logs")
        .update({ result, note: note.trim() || null, job_detail: appt.job_detail })
        .eq("appointment_id", appt.id);
    } else
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
    toast.success(isEdit ? "แก้ไขรายละเอียดปิดงานแล้ว" : "ปิดงานและบันทึกประวัติซ่อมบำรุงแล้ว");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "แก้ไขรายละเอียดงานที่ปิดแล้ว" : "สรุปผลปิดงาน"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "แก้คำผิดหรืออัปเดตรายละเอียดของงานที่ปิดไปแล้ว แล้วกดบันทึก"
              : "เลือกผลสรุปและบันทึกรายละเอียดเข้าประวัติซ่อมบำรุงของเครื่อง"}
          </DialogDescription>
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
        <div className="space-y-2 rounded-xl border p-3">
          <p className="text-sm font-semibold">รายละเอียดการปิดงาน</p>
          <Textarea rows={3} placeholder="บันทึกสรุปงานสั้นๆ" value={note} onChange={(e) => setNote(e.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={quotation} onChange={(e) => setQuotation(e.target.checked)} />
            ต้องออกใบเสนอราคาให้ลูกค้า
          </label>
        </div>

        <div className="space-y-2 rounded-xl border p-3">
          <p className="text-sm font-semibold">หมวดอะไหล่ที่ใช้ในงานนี้</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PART_CATEGORIES.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={cats.includes(c)} onChange={() => toggleCat(c)} />
                {c}
              </label>
            ))}
          </div>
          <Input
            placeholder="ระบุอะไหล่เพิ่มเติม / รายละเอียดอื่นๆ"
            value={partsNote}
            onChange={(e) => setPartsNote(e.target.value)}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={resetParts} onChange={(e) => setResetParts(e.target.checked)} />
          รีเซ็ตอายุอะไหล่ของเครื่อง {appt.serial_number || "-"} เริ่มนับใหม่
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {isEdit ? "บันทึกการแก้ไข" : "ปิดงาน"}
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

/** แผงแสดงรายการหลายค่าในหน้าต่างรายละเอียด */
function BadgeRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}:</span>
      {items.length === 0 ? (
        <span className="text-xs text-muted-foreground">-</span>
      ) : (
        items.map((t) => (
          <Badge key={t} variant="secondary">
            {t}
          </Badge>
        ))
      )}
    </div>
  );
}

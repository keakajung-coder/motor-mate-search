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
import { notifyUsers } from "@/lib/notify";
import { Switch } from "@/components/ui/switch";
import { loadAutoJobAlert, saveAutoJobAlert, sendJobApprovalAlert } from "@/lib/job-alerts";
import { ensureSeller, useSellerNames } from "@/lib/sellers";
import { JobAttachments } from "@/components/JobAttachments";



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
  Eye,
  EyeOff,
  Pencil,
  Phone,
  RotateCcw,
  Share2,
  Trash2,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { deleteAsAdmin, useAccess } from "@/lib/access";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SERVICE_TYPES, useServiceOptions, WorkOrderDialog, WorkOrderFormPrint } from "@/components/WorkOrderDialog";
import { Combobox } from "@/components/ui/combobox";
import { MultiCombobox, splitNames, joinNames } from "@/components/ui/multi-combobox";
import { deleteDirectoryEntry, ensureDirectoryEntries, ensureParts, useDirectory, type DirectoryKind } from "@/lib/directory";
import { elementToPdfBlobPaged, formatDate, isMachineComplete, saveFile, shareOrDownload } from "@/lib/report";
import { PartsAlertPanel } from "@/components/PartsAlertPanel";
import { JobReportsPanel } from "@/components/JobReportsPanel";
import { PART_CATEGORIES } from "@/lib/job-fields";
import { DateInput } from "@/components/ui/date-input";
import { ChecklistForm } from "@/components/ChecklistForm";
import { loadTemplates, matchesType, newResult, type ChecklistResult, type ChecklistTemplate } from "@/lib/checklist";


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
  work_order_id?: string | null;
  cust_id?: string | null;
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
  attachments?: string | null;

  status: string;
  result: string | null;
  close_note: string | null;
  closed_at?: string | null;
};

type WorkOrder = Appointment & {
  admin_note: string | null;
  job_no?: string | null;
  priority?: string | null;
  billing_type?: string | null;
  po_number?: string | null;
  billing_note?: string | null;
  work_types?: string | null;
  depart_time?: string | null;
  return_time?: string | null;
  logistics_note?: string | null;
  safety_gear?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "รอดำเนินการ",
  approved: "รอดำเนินการ",
  scheduled: "นัดหมายแล้ว",
  in_progress: "กำลังดำเนินการ",
  closed: "เสร็จสิ้น",
};

type StatusStage = "pending" | "active" | "completed";
// เหลือง = กด "นัดหมายแล้ว" หรือ "เริ่มดำเนินการ" เท่านั้น, แดง = ยังไม่กด, เขียว = ปิดงาน
const statusStage = (status?: string | null): StatusStage =>
  status === "closed" ? "completed" : status === "scheduled" || status === "in_progress" ? "active" : "pending";
const STATUS_STAGE_STYLE: Record<StatusStage, { rail: string; badge: string; label: string }> = {
  pending: { rail: "bg-red-500", badge: "border-red-300 bg-red-50 text-red-700", label: "ยังไม่ไป" },
  active: { rail: "bg-amber-400", badge: "border-amber-300 bg-amber-50 text-amber-800", label: "รอ / นัดหมายแล้ว" },
  completed: { rail: "bg-emerald-500", badge: "border-emerald-300 bg-emerald-50 text-emerald-700", label: "ปิดงานแล้ว" },
};

const STAGE_BG: Record<StatusStage, string> = {
  pending: "border-red-200 bg-red-50/60",
  active: "border-amber-200 bg-amber-50/60",
  completed: "border-emerald-200 bg-emerald-50/60",
};

function StatusRail({ status }: { status?: string | null }) {
  const style = STATUS_STAGE_STYLE[statusStage(status)];
  return <span aria-hidden="true" className={`absolute inset-y-0 left-1 w-1.5 rounded-full ${style.rail}`} />;
}

function JobStatusBadge({ status, compact = false }: { status?: string | null; compact?: boolean }) {
  const style = STATUS_STAGE_STYLE[statusStage(status)];
  return (
    <Badge variant="outline" className={`${style.badge} ${compact ? "px-1 py-0 text-[9px]" : ""}`}>
      {status === "in_progress" ? "กำลังดำเนินการ" : status === "scheduled" ? "นัดหมายแล้ว" : style.label}
    </Badge>
  );
}

function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
      {(Object.keys(STATUS_STAGE_STYLE) as StatusStage[]).map((stage) => {
        const item = STATUS_STAGE_STYLE[stage];
        return <span key={stage} className="flex items-center gap-1.5"><span className={`h-3 w-1.5 rounded-full ${item.rail}`} />{item.label}</span>;
      })}
    </div>
  );
}

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
        <span className="min-w-0 break-words">{title}</span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-normal text-muted-foreground">
          {open ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {open ? "ซ่อนข้อมูล" : "ดูเพิ่มเติม"}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
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
    window.addEventListener("app:connection-restored", load);
    return () => window.removeEventListener("app:connection-restored", load);
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
        const blob = await elementToPdfBlobPaged(el, 1, {
          orientation: "landscape",
          size: full,
          pixelRatio: 3,
          maxBytes: 12 * 1024 * 1024,
        });
        await saveFile(blob, `ตารางงาน-${fileLabel}.pdf`);
      } else {
        const { toJpeg } = await import("html-to-image");
        const dataUrl = await toJpeg(el, {
          backgroundColor: "#ffffff",
          cacheBust: true,
          pixelRatio: 3,
          quality: 0.96,
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
    <div className="w-full min-w-0 space-y-5 p-1 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:p-4 sm:pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">ปฏิทินนัดหมายบริการ</h1>
          <p className="text-sm text-muted-foreground">วางแผนงานเข้าบริการ ตรวจใบสั่งงาน และแจ้งเตือนอะไหล่ล่วงหน้า</p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:flex-wrap lg:justify-end">
          <WorkOrderDialog onCreated={load} />
          <Button variant="outline" className="h-11" onClick={() => setEditing(newAppointment(iso(cursor)))}>
            <CalendarPlus className="mr-1 h-4 w-4" /> เพิ่มนัดหมายลงปฏิทินโดยตรง
          </Button>
        </div>
      </header>

      {/* แผงด้านข้างย้ายมาอยู่ด้านบน เพื่อให้ปฏิทินขยายเต็มความกว้าง */}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <div className="hidden min-w-0 lg:block">
          <FoldSection title="แผงสถิติภาพรวม">
            <StatsPanel appts={appts} pending={orders.length} />
          </FoldSection>
        </div>

        {isAdmin && (
          <FoldSection title={`ใบสั่งงานรออนุมัติ (${orders.length})`} className="lg:col-span-2 2xl:col-span-1">
            <PendingOrders orders={orders} reload={load} />
          </FoldSection>
        )}

        <FoldSection title="งานที่อนุมัติแล้ว / ฝ่ายขายยืนยันนัดหมาย">
          <ApprovedOrders reloadPlanner={load} onCloseJob={setClosing} />
        </FoldSection>

        <FoldSection title="แจ้งเตือนอะไหล่ล่วงหน้า 30 วัน">
          <PartsAlertPanel withActions={isAdmin} />
        </FoldSection>

        <FoldSection title="สรุปใบสั่งงาน (วัน/สัปดาห์/เดือน/ช่วงวันที่)" className="lg:col-span-2 2xl:col-span-1">
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
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <CardTitle className="flex min-w-0 items-center gap-2 break-words text-base">
              <CalendarDays className="h-4 w-4 shrink-0" /> {title}
            </CardTitle>
            <div className="flex shrink-0 items-center gap-1">
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
          <div className="grid min-w-0 grid-cols-1 items-center gap-2 lg:grid-cols-[repeat(4,minmax(0,1fr))] 2xl:flex 2xl:flex-wrap">
            <div className="flex min-w-0 overflow-x-auto whitespace-nowrap scrollbar-none lg:col-span-2 2xl:mb-0">
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
            <DateInput
              aria-label="ค้นหาวันที่"
              className="w-full 2xl:w-40"
              value={iso(cursor)}
              onChange={(v) => {
                if (!v) return;
                const [y, m, d] = v.split("-").map(Number);
                setCursor(new Date(y, m - 1, d));
                setView("day");
                setDayDetail(v);
              }}
            />
            <select
              className="h-9 min-w-0 w-full rounded-md border border-input bg-background px-2 text-sm 2xl:w-auto"
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
              className="h-9 min-w-0 w-full rounded-md border border-input bg-background px-2 text-sm 2xl:w-auto"
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
              className="h-9 min-w-0 w-full rounded-md border border-input bg-background px-2 text-sm 2xl:w-auto"
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
          <div className="mb-3"><StatusLegend /></div>
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
                onPickDate={(d) => setEditing(newAppointment(d))}
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
                  onPickSlot={(d, t) => setEditing({ ...newAppointment(d), visit_time: t })}
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
          onCloseJob={(a) => {
            setDayDetail(null);
            setClosing(a);
          }}
        />
      )}

      {editing && (
        <AppointmentDialog
          value={editing}
          canEdit
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          onCloseJob={(a) => {
            setEditing(null);
            setClosing(a);
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
    status: "approved",
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
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
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
  const [autoAlert, setAutoAlert] = useState(true);

  useEffect(() => {
    loadAutoJobAlert().then(setAutoAlert);
  }, []);


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
      cust_id: m.cust_id ?? null,
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
      attachments: m.attachments ?? null,

      // อนุมัติเฉยๆ ยังเป็นสีแดง จนกว่าจะกด "นัดหมายแล้ว" หรือ "เริ่มดำเนินการ"
      status: o.status === "scheduled" ? "scheduled" : "approved",
    });
    // เก็บค่าที่แอดมินแก้ไว้ลงใบสั่งงานเดิมด้วย เพื่อให้เอกสารตรงกับงานจริง
    if (!error)
      await supabase
        .from("work_orders")
        .update({ ...(p as Record<string, unknown>), status: o.status === "scheduled" ? "scheduled" : "approved" } as never)
        .eq("id", o.id);

    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("อนุมัติและเพิ่มลงปฏิทินแล้ว");
    if (autoAlert) {
      const sent = await sendJobApprovalAlert(m);
      if (sent > 0) toast.success(`ส่งแจ้งเตือน LINE ให้เซลล์/ช่างแล้ว (${sent} ราย)`);
    }
    reload();
  };

  /** ส่งรายละเอียดงานเข้า LINE ให้เซลล์และช่างด้วยตัวเอง */
  const shareNow = async (o: WorkOrder) => {
    const m = { ...o, ...(edit[o.id] ?? {}) } as WorkOrder & Record<string, any>;
    const sent = await sendJobApprovalAlert(m);
    toast[sent > 0 ? "success" : "error"](
      sent > 0 ? `ส่งเข้า LINE แล้ว (${sent} ราย)` : "ยังส่งไม่ได้ — เซลล์/ช่างยังไม่ได้ผูก LINE",
    );
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
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> ใบสั่งงานรออนุมัติ ({orders.length})
          </span>
          <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
            <Label htmlFor="auto-job-alert" className="text-xs">
              ส่ง LINE อัตโนมัติเมื่ออนุมัติ
            </Label>
            <Switch
              id="auto-job-alert"
              checked={autoAlert}
              onCheckedChange={(v) => {
                setAutoAlert(v);
                void saveAutoJobAlert(v);
              }}
            />
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {orders.length === 0 && <p className="text-sm text-muted-foreground">ไม่มีใบสั่งงานรอตรวจ</p>}
        {orders.map((o) => (
          <div key={o.id} className="relative space-y-3 overflow-hidden rounded-lg border py-3 pl-6 pr-3">
            <StatusRail status="pending" />
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
              <JobStatusBadge status="pending" />
            </div>

            <p className="whitespace-pre-wrap break-words text-sm">{val(o, "job_detail")}</p>

            <div className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-2 2xl:grid-cols-4">
              <div className="min-w-0 space-y-1">
                <Label className="text-xs">วันที่เข้าบริการ</Label>
                <DateInput
                  className="w-full"
                  value={val(o, "visit_date")}
                  onChange={(v) => patch(o.id, "visit_date", v)}
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
              <div className="grid min-w-0 grid-cols-1 gap-2 rounded-lg border bg-muted/30 p-3 lg:grid-cols-2">
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
              <Button size="sm" variant="secondary" onClick={() => shareNow(o)}>
                <Phone className="mr-1 h-4 w-4" /> ส่ง LINE ให้เซลล์/ช่าง
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

/** ช่องแก้ไขในการ์ดใบสั่งงานรออนุมัติ */
function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

// ---------- Approved work orders (export) ----------

/** ใบสั่งงานที่อนุมัติแล้ว: ส่งออกเป็นรูปภาพ หรือ PDF ได้ทันที */
function ApprovedOrders({
  reloadPlanner,
  onCloseJob,
}: {
  reloadPlanner: () => void;
  onCloseJob: (appt: Appointment) => void;
}) {
  const [rows, setRows] = useState<WorkOrder[]>([]);
  const [appointments, setAppointments] = useState<Record<string, Appointment>>({});
  const [busy, setBusy] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [schedule, setSchedule] = useState<Record<string, { date: string; time: string }>>({});
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const formRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const loadApproved = useCallback(async () => {
    const [{ data: workOrders }, { data: apptRows }] = await Promise.all([
      supabase.from("work_orders").select("*").in("status", ["approved", "scheduled", "in_progress", "closed"]).order("created_at", { ascending: false }).limit(50),
      supabase.from("appointments").select("*").not("work_order_id", "is", null),
    ]);
    const nextRows = (workOrders ?? []) as unknown as WorkOrder[];
    const nextAppointments = Object.fromEntries(
      ((apptRows ?? []) as Appointment[]).filter((a) => a.work_order_id).map((a) => [a.work_order_id as string, a]),
    );
    setRows(nextRows);
    setAppointments(nextAppointments);
    setSchedule(Object.fromEntries(nextRows.map((o) => {
      const a = nextAppointments[o.id];
      return [o.id, { date: a?.visit_date ?? o.visit_date ?? "", time: a?.visit_time ?? o.visit_time ?? "" }];
    })));
  }, []);

  useEffect(() => { void loadApproved(); }, [loadApproved]);

  const confirmAppointment = async (o: WorkOrder) => {
    const a = appointments[o.id];
    const chosen = schedule[o.id];
    if (!a) return toast.error("ไม่พบรายการงานที่เชื่อมกับปฏิทิน");
    if (!chosen?.date) return toast.error("กรุณาเลือกวันที่นัดหมาย");
    setBusy(o.id + "schedule");
    const [apptResult, orderResult] = await Promise.all([
      supabase.from("appointments").update({ visit_date: chosen.date, visit_time: chosen.time || null, status: "scheduled" }).eq("id", a.id),
      supabase.from("work_orders").update({ visit_date: chosen.date, visit_time: chosen.time || null, status: "scheduled" }).eq("id", o.id),
    ]);
    setBusy("");
    const error = apptResult.error ?? orderResult.error;
    if (error) return toast.error("ยืนยันนัดหมายไม่สำเร็จ: " + error.message);
    toast.success("ยืนยันนัดหมายและอัปเดตปฏิทินแล้ว");
    await loadApproved();
    reloadPlanner();
  };

  const { isAdmin } = useAccess();
  const [fDate, setFDate] = useState("");
  const [fSeller, setFSeller] = useState("");
  const [fStaff, setFStaff] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const sellerOpts = useMemo(() => Array.from(new Set(rows.map((o) => (o.sales_rep ?? "").trim()).filter(Boolean))).sort(), [rows]);
  const staffOpts = useMemo(() => Array.from(new Set(rows.flatMap((o) => splitNames(o.staff_name)))).sort(), [rows]);
  const visible = rows.filter((o) => {
    if (!showHidden && (o as WorkOrder & { approved_hidden?: boolean }).approved_hidden) return false;
    const date = appointments[o.id]?.visit_date ?? o.visit_date ?? "";
    if (fDate && date !== fDate) return false;
    if (fSeller && (o.sales_rep ?? "").trim() !== fSeller) return false;
    if (fStaff && !splitNames(o.staff_name).includes(fStaff)) return false;
    return true;
  });
  const selected = visible.filter((o) => picked[o.id]);

  const toggleHidden = async (o: WorkOrder) => {
    const next = !(o as WorkOrder & { approved_hidden?: boolean }).approved_hidden;
    const { error } = await supabase.from("work_orders").update({ approved_hidden: next } as never).eq("id", o.id);
    if (error) return toast.error("บันทึกไม่สำเร็จ: " + error.message);
    toast.success(next ? "ซ่อนใบงานแล้ว (งานในปฏิทินยังอยู่)" : "แสดงใบงานอีกครั้ง");
    await loadApproved();
  };

  const removeOrder = async (o: WorkOrder) => {
    const { error } = await deleteAsAdmin("work_orders", { id: o.id });
    if (error) return toast.error("ลบไม่สำเร็จ: " + error.message);
    toast.success("ลบใบงานแล้ว งานในปฏิทินยังเก็บไว้");
    await loadApproved();
  };

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

  /** ส่งออกแบบฟอร์มเต็มตามหน้าสร้างใบสั่งงาน — ย่ออัตโนมัติให้ครบหนึ่งหน้า A4 */
  const exportFormPdf = async (orders: WorkOrder[]) => {
    if (orders.length === 0) return;
    const key = orders.length === 1 ? orders[0].id + "formpdf" : "bulkformpdf";
    setBusy(key);
    try {
      const { elementsToA4PdfBlob } = await import("@/lib/report");
      const els = orders.map((o) => formRefs.current[o.id]).filter(Boolean) as HTMLDivElement[];
      if (els.length !== orders.length) throw new Error("ไม่พบแบบฟอร์มสำหรับส่งออก");
      const blob = await elementsToA4PdfBlob(els);
      const filename = orders.length === 1
        ? `ใบสั่งงาน-แบบฟอร์ม-${orders[0].customer_name || orders[0].id.slice(0, 6)}.pdf`
        : `ใบสั่งงาน-แบบฟอร์ม-${orders.length}ใบ.pdf`;
      await saveFile(blob, filename);
      toast.success(`บันทึก PDF แบบฟอร์ม ${orders.length} ใบเรียบร้อย (A4 หน้าเดียวต่อใบ)`);
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ: " + (e as Error).message);
    } finally {
      setBusy("");
    }
  };

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">ยังไม่มีใบสั่งงานที่อนุมัติ</p>;

  return (
    <div className="space-y-3">
      <div className="grid min-w-0 grid-cols-1 gap-2 rounded-lg border bg-card p-2 lg:grid-cols-4">
        <DateInput size="sm" aria-label="กรองวันที่นัดหมาย" value={fDate} onChange={setFDate} />
        <select className="h-8 rounded-md border bg-background px-2 text-xs" value={fSeller} onChange={(e) => setFSeller(e.target.value)} aria-label="กรองผู้ขาย">
          <option value="">ผู้ขายทั้งหมด</option>
          {sellerOpts.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="h-8 rounded-md border bg-background px-2 text-xs" value={fStaff} onChange={(e) => setFStaff(e.target.value)} aria-label="กรองช่าง">
          <option value="">ช่างทั้งหมด</option>
          {staffOpts.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" className="h-8" onClick={() => { setFDate(""); setFSeller(""); setFStaff(""); }}>ล้างตัวกรอง</Button>
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> แสดงที่ซ่อน
          </label>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] lg:col-span-4">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> ปิดงาน</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> รอ / นัดหมายแล้ว</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> ยังไม่ไป</span>
          <span className="ml-auto text-muted-foreground">แสดง {visible.length}/{rows.length} ใบ</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={visible.length > 0 && selected.length === visible.length}
            onChange={(e) =>
              setPicked(e.target.checked ? Object.fromEntries(visible.map((r) => [r.id, true])) : {})
            }
          />
          เลือกทั้งหมด ({selected.length}/{visible.length})
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!!busy || selected.length === 0} onClick={() => exportSelected("image")}>
            {busy === "bulkimage" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Camera className="mr-1 h-4 w-4" />}
            รูปภาพ A4 ที่เลือก
          </Button>
          <Button size="sm" disabled={!!busy || selected.length === 0} onClick={() => exportSelected("pdf")}>
            {busy === "bulkpdf" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />}
            PDF A4 ที่เลือก
          </Button>
          <Button size="sm" variant="outline" disabled={!!busy || selected.length === 0} onClick={() => exportFormPdf(selected)}>
            {busy === "bulkformpdf" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />}
            PDF แบบฟอร์มที่เลือก
          </Button>
        </div>
      </div>

      {visible.length === 0 && <p className="text-sm text-muted-foreground">ไม่พบใบงานตามตัวกรอง</p>}
      {visible.map((o) => (
        <div key={o.id} className={`relative space-y-2 overflow-hidden rounded-lg border py-3 pl-6 pr-3 ${STAGE_BG[statusStage(appointments[o.id]?.status ?? o.status)]} ${(o as WorkOrder & { approved_hidden?: boolean }).approved_hidden ? "opacity-60" : ""}`}>
          <StatusRail status={appointments[o.id]?.status ?? o.status} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <JobStatusBadge status={appointments[o.id]?.status ?? o.status} />
            <span className="text-xs text-muted-foreground">เซลล์: {o.sales_rep || "ยังไม่ระบุ"}</span>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2 rounded-md border bg-muted/30 p-2 lg:grid-cols-[minmax(0,1fr)_8rem_auto]">
            <DateInput
              aria-label={`วันที่นัดหมาย ${o.customer_name}`}
              value={schedule[o.id]?.date ?? ""}
              onChange={(date) => setSchedule((s) => ({ ...s, [o.id]: { date, time: s[o.id]?.time ?? "" } }))}
            />
            <Input
              aria-label={`เวลานัดหมาย ${o.customer_name}`}
              type="time"
              value={schedule[o.id]?.time ?? ""}
              onChange={(e) => setSchedule((s) => ({ ...s, [o.id]: { date: s[o.id]?.date ?? "", time: e.target.value } }))}
            />
            <Button size="sm" onClick={() => confirmAppointment(o)} disabled={busy === o.id + "schedule" || statusStage(appointments[o.id]?.status ?? o.status) === "completed"}>
              {busy === o.id + "schedule" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Phone className="mr-1 h-4 w-4" />}
              นัดหมายแล้ว
            </Button>
          </div>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base font-bold">ใบสั่งงานบริการ</p>
              <JobStatusBadge status={appointments[o.id]?.status ?? o.status} />
            </div>
            <p className="font-semibold">{o.customer_name}</p>
            <p className="text-xs">{[o.contact_name, o.contact_phone, o.customer_address].filter(Boolean).join(" · ")}</p>
            <p className="text-xs">{[o.machine_label, o.serial_number, o.service_type].filter(Boolean).join(" · ")}</p>
            <p className="text-xs">
              วันที่ {formatDate(o.visit_date ?? "")} {o.visit_time ?? ""} · ช่าง {o.staff_name || "-"} · รถ {o.vehicle_plate || "-"}
              {o.sales_rep ? ` · เซลล์ ${o.sales_rep}` : ""}
            </p>
            <p className="text-sm">{o.job_detail}</p>
          </div>
          <div className="work-order-form-export-stage" aria-hidden="true">
            <div
              ref={(n) => {
                formRefs.current[o.id] = n;
              }}
            >
              <WorkOrderFormPrint order={o} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {appointments[o.id] && appointments[o.id].status !== "closed" && (
              <Button size="sm" variant="secondary" onClick={() => onCloseJob(appointments[o.id])}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> ปิดใบงาน
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => exportOne(o, "image")}>
              {busy === o.id + "image" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Camera className="mr-1 h-4 w-4" />}
              บันทึกรูปภาพ
            </Button>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => exportOne(o, "pdf")}>
              {busy === o.id + "pdf" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />}
              บันทึก PDF
            </Button>
            <Button size="sm" disabled={!!busy} onClick={() => exportFormPdf([o])}>
              {busy === o.id + "formpdf" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />}
              PDF แบบฟอร์ม
            </Button>
            <Button size="sm" variant="ghost" onClick={() => toggleHidden(o)}>
              {(o as WorkOrder & { approved_hidden?: boolean }).approved_hidden ? <Eye className="mr-1 h-4 w-4" /> : <EyeOff className="mr-1 h-4 w-4" />}
              {(o as WorkOrder & { approved_hidden?: boolean }).approved_hidden ? "แสดง" : "ซ่อน"}
            </Button>
            {isAdmin && (
              <ConfirmButton
                title="ลบใบงานนี้?"
                description="ใบสั่งงานจะถูกลบ แต่งานในแพลนเนอร์/ปฏิทินยังคงเก็บไว้"
                className="text-destructive"
                onConfirm={() => removeOrder(o)}
              >
                <Trash2 className="mr-1 h-4 w-4" /> ลบใบงาน
              </ConfirmButton>
            )}
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
  return "relative overflow-hidden border-[3px] pl-3 text-slate-800 " + vehicleBorder(a.vehicle_plate) + " " + staffBg(a.staff_name);
}
/** ความกว้างคอลัมน์: จันทร์–ศุกร์ เท่ากัน (~17.4%), เสาร์ ~10%, อาทิตย์ ~3% (แถบแดง) */
const WEEK_COLS = "repeat(5, minmax(0, 17.4fr)) minmax(0, 10fr) minmax(40px, 3fr)";
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
        <StatusLegend />
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

              <div className="scrollbar-none min-h-0 flex-1 space-y-0.5 overflow-y-auto">
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
                    <StatusRail status={a.status} />
                    <span className="block truncate">{a.customer_name || "ไม่ระบุลูกค้า"}</span>
                    <span className="block truncate text-xs opacity-80">
                      👤 {splitNames(a.staff_name).join(", ") || "-"}
                    </span>
                    <span className="block truncate text-xs opacity-80">
                      🚚 {splitNames(a.vehicle_plate).join(" / ") || "ยังไม่ระบุรถ"}
                    </span>
                    {(a.serial_number || a.machine_label) && (
                      <span className="block truncate text-[10px] opacity-80">
                        ⚙️ {splitNames(a.serial_number).join(" / ") || splitNames(a.machine_label).join(" / ")}
                      </span>
                    )}
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
                <StatusRail status={a.status} />
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
                {(a.serial_number || a.machine_label) && (
                  <span className="block truncate text-[10px] opacity-80">
                    ⚙️ {splitNames(a.serial_number).join(" / ") || splitNames(a.machine_label).join(" / ")}
                  </span>
                )}
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
  onCloseJob,
}: {
  date: string;
  appts: Appointment[];
  sortBy?: string;
  onClose: () => void;
  onPick: (a: Appointment) => void;
  onCloseJob: (a: Appointment) => void;
}) {
  const list = sortApptList(appts.filter((a) => a.visit_date === date), sortBy).sort(byVehicleThenTime);
  const [preview, setPreview] = useState(false);
  const [zoom, setZoom] = useState(0.7);
  const [documentHeight, setDocumentHeight] = useState(1100);
  const [exporting, setExporting] = useState<"" | "image" | "pdf">("");
  const [outputAction, setOutputAction] = useState<"share" | "download">("share");
  const documentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!preview || !documentRef.current) return;
    const el = documentRef.current;
    const measure = () => setDocumentHeight(el.scrollHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [preview, list.length]);

  const exportDailyQueue = async (kind: "image" | "pdf") => {
    const el = documentRef.current;
    if (!el) return;
    setExporting(kind);
    const filename = `คิวงาน-${date}.${kind === "pdf" ? "pdf" : "png"}`;
    try {
      let blob: Blob;
      if (kind === "pdf") {
        const stage = document.createElement("div");
        stage.className = "daily-queue-pdf-stage";
        const header = el.querySelector(".daily-queue-document__header");
        const footer = el.querySelector("footer");
        const jobs = Array.from(el.querySelectorAll<HTMLElement>(".daily-queue-document__job"));
        const sourcePages = jobs.length ? jobs : [el.querySelector<HTMLElement>(".daily-queue-document__empty")].filter(Boolean) as HTMLElement[];
        const pages = sourcePages.map((source, index) => {
          const page = document.createElement("div");
          page.className = "daily-queue-document daily-queue-document--pdf-page";
          if (header) page.append(header.cloneNode(true));
          const body = document.createElement("main");
          body.className = "daily-queue-document__body";
          body.append(source.cloneNode(true));
          page.append(body);
          if (footer) {
            const pageFooter = footer.cloneNode(true) as HTMLElement;
            pageFooter.textContent = `เอกสารคิวงานรายวัน · หน้า ${index + 1}/${sourcePages.length}`;
            page.append(pageFooter);
          }
          stage.append(page);
          return page;
        });
        document.body.append(stage);
        try {
          const { elementsToA4PdfBlob } = await import("@/lib/report");
          blob = await elementsToA4PdfBlob(pages, { maxBytes: 12 * 1024 * 1024, pixelRatio: 3 });
        } finally {
          stage.remove();
        }
      } else {
        const { toPng } = await import("html-to-image");
        const dataUrl = await toPng(el, {
          backgroundColor: "#ffffff",
          cacheBust: true,
          pixelRatio: 3,
          width: el.scrollWidth,
          height: el.scrollHeight,
          style: { width: `${el.scrollWidth}px`, height: `${el.scrollHeight}px` },
        });
        blob = await (await fetch(dataUrl)).blob();
      }
      const action = outputAction === "share"
        ? await shareOrDownload(blob, filename, `คิวงานวันที่ ${formatDate(date)}`)
        : await saveFile(blob, filename);
      toast.success(action === "shared" ? "เปิดเมนูแชร์แล้ว" : "ดาวน์โหลดไฟล์เรียบร้อย");
    } catch (error) {
      toast.error("สร้างไฟล์ไม่สำเร็จ: " + (error as Error).message);
    } finally {
      setExporting("");
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className={preview ? "w-[calc(100vw-1rem)] max-w-none overflow-hidden p-3 sm:w-[calc(100vw-2rem)] sm:p-5" : "w-[calc(100vw-1rem)] max-w-none overflow-y-auto sm:w-[calc(100vw-2rem)]"}>
        {!preview ? (
          <>
            <DialogHeader className="pr-8">
               <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div>
                  <DialogTitle>คิวงานวันที่ {formatDate(date)}</DialogTitle>
                  <DialogDescription className="mt-1">ทั้งหมด {list.length} งาน · แตะรายการเพื่อดูรายละเอียดเชิงลึก</DialogDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => setPreview(true)}>
                  <Share2 className="mr-1 h-4 w-4" /> แชร์
                </Button>
              </div>
            </DialogHeader>
            <div className="space-y-2">
              {list.length === 0 && <p className="text-sm text-muted-foreground">ไม่มีนัดหมายในวันนี้</p>}
              {list.map((a) => (
                <div
                  key={a.id}
                  className={
                    "relative grid min-w-0 grid-cols-1 gap-2 overflow-hidden rounded-xl border py-3 pl-6 pr-3 sm:grid-cols-[minmax(0,1fr)_auto] " + vehicleColor(a.vehicle_plate)
                  }
                >
                  <StatusRail status={a.status} />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onPick(a)}
                    className="h-auto min-w-0 justify-start whitespace-normal p-0 text-left hover:bg-transparent"
                  >
                    <span className="min-w-0 space-y-0.5">
                      <span className="block break-words font-medium">
                        {a.visit_time?.slice(0, 5) || "-"} · {a.customer_name || "ไม่ระบุลูกค้า"}
                      </span>
                      <span className="block break-words text-xs opacity-80">เครื่อง: {splitNames(a.serial_number).join(" / ") || "-"}{a.machine_label ? ` (${splitNames(a.machine_label).join(" / ")})` : ""}</span>
                      <span className="block break-words text-xs opacity-80">ประเภทงาน: {splitNames(a.service_type).join(" / ") || "-"}</span>
                      <span className="block break-words text-xs opacity-80">
                        {a.sales_rep ? `เซลล์: ${a.sales_rep} · ` : ""}ช่าง: {splitNames(a.staff_name).join(", ") || "-"} · รถ: {splitNames(a.vehicle_plate).join(" / ") || "-"} · {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                      {a.customer_address && <span className="block break-words text-xs opacity-80">{a.customer_address}</span>}
                      {a.job_detail && <span className="mt-1 block break-words text-sm">{a.job_detail}</span>}
                    </span>
                  </Button>
                  {a.status !== "closed" && (
                    <Button type="button" size="sm" variant="secondary" className="self-start" onClick={() => onCloseJob(a)}>
                      <CheckCircle2 className="mr-1 h-4 w-4" /> ปิดใบงาน
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>ปิด</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="pr-8">
              <DialogTitle>ตัวอย่างคิวงานวันที่ {formatDate(date)}</DialogTitle>
              <DialogDescription>ตรวจรายละเอียดและขยายเอกสารก่อนแชร์หรือดาวน์โหลด</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 p-2">
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" aria-label="ซูมออก" title="ซูมออก" onClick={() => setZoom((v) => Math.max(0.4, v - 0.1))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="w-14 text-center text-sm font-medium">{Math.round(zoom * 100)}%</span>
                <Button size="icon" variant="outline" aria-label="ซูมเข้า" title="ซูมเข้า" onClick={() => setZoom((v) => Math.min(1.5, v + 0.1))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="คืนขนาด" title="คืนขนาด" onClick={() => setZoom(0.7)}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex rounded-md border bg-background p-0.5" aria-label="วิธีส่งออก">
                  <Button size="sm" variant={outputAction === "share" ? "secondary" : "ghost"} onClick={() => setOutputAction("share")}>
                    <Share2 className="mr-1 h-4 w-4" /> แชร์
                  </Button>
                  <Button size="sm" variant={outputAction === "download" ? "secondary" : "ghost"} onClick={() => setOutputAction("download")}>
                    <FileDown className="mr-1 h-4 w-4" /> ดาวน์โหลด
                  </Button>
                </div>
                <Button size="sm" variant="outline" disabled={!!exporting} onClick={() => exportDailyQueue("image")}>
                  {exporting === "image" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Camera className="mr-1 h-4 w-4" />} {outputAction === "share" ? "แชร์" : "ดาวน์โหลด"}รูปภาพ
                </Button>
                <Button size="sm" disabled={!!exporting} onClick={() => exportDailyQueue("pdf")}>
                  {exporting === "pdf" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />} {outputAction === "share" ? "แชร์" : "ดาวน์โหลด"} PDF
                </Button>
              </div>
            </div>
            <div className="h-[62vh] overflow-auto rounded-md border bg-muted p-3">
              <div className="relative mx-auto" style={{ width: 794 * zoom, height: documentHeight * zoom }}>
                <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${zoom})` }}>
                  <DailyQueueDocument ref={documentRef} date={date} list={list} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreview(false)}>กลับไปรายการงาน</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const DailyQueueDocument = ({ ref, date, list }: { ref: React.Ref<HTMLDivElement>; date: string; list: Appointment[] }) => (
  <div ref={ref} className="daily-queue-document">
    <header className="daily-queue-document__header">
      <div>
        <p className="daily-queue-document__eyebrow">ตารางปฏิบัติงานบริการ</p>
        <h2>คิวงานรายวัน</h2>
      </div>
      <div className="daily-queue-document__date">
        <span>วันที่</span>
        <strong>{formatDate(date)}</strong>
        <small>ทั้งหมด {list.length} งาน</small>
      </div>
    </header>
    <main className="daily-queue-document__body">
      {list.length === 0 ? (
        <p className="daily-queue-document__empty">ไม่มีนัดหมายในวันนี้</p>
      ) : list.map((a, index) => (
        <section key={a.id} className={`daily-queue-document__job daily-queue-document__job--${statusStage(a.status)}`}>
          <div className="daily-queue-document__job-head">
            <div className="daily-queue-document__sequence">{index + 1}</div>
            <div>
              <p className="daily-queue-document__time">{a.visit_time?.slice(0, 5) || "ไม่ระบุเวลา"}</p>
              <h3>{a.customer_name || "ไม่ระบุลูกค้า"}</h3>
            </div>
            <span className="daily-queue-document__status">{STATUS_LABEL[a.status] ?? a.status}</span>
          </div>
          <dl className="daily-queue-document__grid">
            <div><dt>เครื่อง / รุ่น</dt><dd>{splitNames(a.machine_label).join(" / ") || "-"}</dd></div>
            <div><dt>Serial Number</dt><dd>{splitNames(a.serial_number).join(" / ") || "-"}</dd></div>
            <div><dt>ประเภทงาน</dt><dd>{splitNames(a.service_type).join(" / ") || "-"}</dd></div>
            <div><dt>ผู้ขาย / เซลล์</dt><dd>{a.sales_rep || "-"}</dd></div>
            <div><dt>ช่างผู้รับผิดชอบ</dt><dd>{splitNames(a.staff_name).join(", ") || "-"}</dd></div>
            <div><dt>รถบริการ</dt><dd>{splitNames(a.vehicle_plate).join(" / ") || "-"}</dd></div>
            <div><dt>ผู้ติดต่อ</dt><dd>{[a.contact_name, a.contact_phone].filter(Boolean).join(" · ") || "-"}</dd></div>
            <div className="daily-queue-document__wide"><dt>ที่อยู่หน้างาน</dt><dd>{a.customer_address || "-"}</dd></div>
            <div className="daily-queue-document__wide"><dt>รายละเอียดงาน / อาการ</dt><dd>{a.job_detail || "-"}</dd></div>
            {(a.result || a.close_note) && <div className="daily-queue-document__wide"><dt>ผลการดำเนินงาน</dt><dd>{[a.result, a.close_note].filter(Boolean).join(" · ")}</dd></div>}
          </dl>
        </section>
      ))}
    </main>
    <footer>เอกสารคิวงานรายวัน · สร้างจากระบบจัดการงานบริการ</footer>
  </div>
);



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
    if (a.work_order_id) {
      const { error: orderError } = await supabase.from("work_orders").update({ status }).eq("id", a.work_order_id);
      if (orderError) return toast.error("อัปเดตใบสั่งงานไม่สำเร็จ: " + orderError.message);
    }
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
              <div key={a.id} className="relative space-y-2 overflow-hidden rounded-lg border py-3 pl-6 pr-3">
                <StatusRail status={a.status} />
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
                  <JobStatusBadge status={a.status} />
                </div>
                {a.status !== "closed" && (
                  <label
                    className={
                      "flex w-fit cursor-pointer items-center gap-2 rounded-lg border px-2 py-1 text-xs font-medium " +
                      (a.status === "scheduled" ? "border-amber-400 bg-amber-50 text-amber-700" : "text-muted-foreground")
                    }
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-amber-500"
                      checked={a.status === "scheduled"}
                      onChange={(e) => setStatus(a, e.target.checked ? "scheduled" : "approved")}
                    />
                    นัดหมายแล้ว
                  </label>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => onEdit(a)}>
                    แก้ไข
                  </Button>
                  {a.status !== "in_progress" && a.status !== "closed" && (
                    <Button size="sm" onClick={() => setStatus(a, "in_progress")}>
                      เริ่มดำเนินการ
                    </Button>
                  )}

                  <Button size="sm" variant="secondary" onClick={() => onClose(a)}>
                    {a.status === "closed" ? "แก้ไขผลปิดงาน" : "ปิดใบงาน"}
                  </Button>
                  {isAdmin && (
                    <ConfirmButton onConfirm={() => remove(a)} description="ลบนัดหมายนี้?">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </ConfirmButton>
                  )}
                </div>

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
  onCloseJob,
}: {
  value: Appointment;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
  onCloseJob: (a: Appointment) => void;
}) {
  const [form, setForm] = useState<Appointment>(value);
  const [editMode, setEditMode] = useState(!value.id);
  const [saving, setSaving] = useState(false);
  const { isAdmin: canDelete } = useAccess();
  const locked = !canEdit || !editMode;
  const dir = useDirectory();
  const delDir = (k: DirectoryKind) => (canDelete ? (v: string) => void deleteDirectoryEntry(k, v) : undefined);
  const sellerNames = useSellerNames();

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
        cust_id: c?.cust_id || m?.cust_id || (c ? null : f.cust_id),
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
      cust_id: first?.cust_id || f.cust_id,
      customer_address: first?.address || f.customer_address,
      contact_phone: first?.phone || f.contact_phone,
    }));
  };
  /** เลือก/พิมพ์รหัสลูกค้า → เติมข้อมูลลูกค้าอัตโนมัติ */
  const pickCustId = (id: string) => {
    const c = dir.customers.find((x) => x.cust_id.toLowerCase() === id.trim().toLowerCase());
    if (c) {
      pickCustomer(c.name);
      setForm((f) => ({ ...f, cust_id: c.cust_id }));
    } else setForm((f) => ({ ...f, cust_id: id }));
  };

  const save = async () => {
    if (!form.customer_name?.trim()) return toast.error("กรุณาเลือกชื่อลูกค้า");
    setSaving(true);
    const serials = splitNames(form.serial_number);
    const plates = splitNames(form.vehicle_plate);
    await ensureDirectoryEntries({
      customer_name: form.customer_name,
      cust_id: form.cust_id,
      machine_label: form.machine_label,
      customer_address: form.customer_address,
      contact_phone: form.contact_phone,
      serial_number: serials[0] ?? "",
      staff_name: form.staff_name,
      vehicle_plate: plates[0] ?? "",
    });
    for (const s of serials.slice(1)) await ensureDirectoryEntries({ customer_name: form.customer_name, serial_number: s, machine_label: form.machine_label });
    for (const p of plates.slice(1)) await ensureDirectoryEntries({ vehicle_plate: p });
    await ensureSeller(form.sales_rep);

    const { data: unit } = await supabase
      .from("machine_units")
      .select("id")
      .eq("serial_number", serials[0] ?? "")
      .maybeSingle();
    const payload = {
      cust_id: form.cust_id?.trim() || null,
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
      attachments: form.attachments ?? null,

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
      <DialogContent className="w-[calc(100vw-1rem)] max-w-none sm:w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>{form.id ? "รายละเอียดนัดหมาย" : "เพิ่มนัดหมายลงปฏิทิน"}</DialogTitle>
          <DialogDescription>
            {canEdit ? "เลือกลูกค้า/เครื่องจากฐานข้อมูล ระบบจะเติมที่อยู่และเบอร์โทรให้อัตโนมัติ" : "ดูรายละเอียดงานนัดหมาย"}
          </DialogDescription>
        </DialogHeader>

        {form.id && (
          <div className="relative flex flex-wrap items-center gap-2 overflow-hidden rounded-xl border bg-muted/40 py-3 pl-6 pr-3 text-sm">
            <StatusRail status={form.status} />
            <JobStatusBadge status={form.status} />
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



        <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
          <F label="รหัสลูกค้า (cust_id)">
            <Combobox
              disabled={locked}
              value={form.cust_id ?? ""}
              onChange={pickCustId} onDelete={delDir("cust_id")}
              options={dir.customers.filter((c) => c.cust_id).map((c) => ({ value: c.cust_id, hint: c.name }))}
              allowCustom
              placeholder="เลือก / พิมพ์รหัสลูกค้า"
              searchPlaceholder="ค้นหารหัสลูกค้า..."
            />
          </F>
          <F label="ชื่อลูกค้า *">
            <Combobox
              disabled={locked}
              value={form.customer_name ?? ""}
              onChange={pickCustomer} onDelete={delDir("customer")}
              allowCustom
              options={dir.customers.map((c) => ({
                value: c.name,
                hint: [c.cust_id && `รหัส ${c.cust_id}`, c.phone, c.address].filter(Boolean).join(" · "),
              }))}
              placeholder="เลือกลูกค้า"
              searchPlaceholder="ค้นหาลูกค้า..."
            />
          </F>
          <F label={form.customer_name ? `หมายเลขเครื่อง (S/N) — เฉพาะของ ${form.customer_name} (เลือกได้หลายเครื่อง)` : "หมายเลขเครื่อง (S/N) (เลือกได้หลายเครื่อง)"}>
            <MultiCombobox
              disabled={locked}
              values={splitNames(form.serial_number)}
              onChange={pickSerials} onDelete={delDir("serial")}
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
          <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
            <F label="วันที่">
              <DateInput disabled={locked} value={form.visit_date} onChange={(v) => set("visit_date", v)} />
            </F>
            <F label="เวลา">
              <Input disabled={locked} type="time" value={form.visit_time ?? ""} onChange={(e) => set("visit_time", e.target.value)} />
            </F>
          </div>
          <F label="พนักงานเซอร์วิส (เลือกได้หลายคน)">
            <MultiCombobox
              disabled={locked}
              values={splitNames(form.staff_name)}
              onChange={(list) => set("staff_name", joinNames(list))} onDelete={delDir("staff")}
              options={dir.staff}
              placeholder="เลือกช่าง (ติ๊กได้หลายคน)"
              searchPlaceholder="ค้นหาช่าง..."
            />
          </F>
          <F label="ทะเบียนรถ (เลือกได้หลายคัน)">
            <MultiCombobox
              disabled={locked}
              values={splitNames(form.vehicle_plate)}
              onChange={(list) => set("vehicle_plate", joinNames(list))} onDelete={delDir("vehicle")}
              options={dir.vehicles}
              placeholder="ติ๊กเลือกทะเบียนรถ"
              searchPlaceholder="ค้นหาทะเบียนรถ..."
            />
          </F>
          <F label="พนักงานขาย (เซลล์) ที่ดูแล">
            <Combobox
              disabled={locked}
              value={form.sales_rep ?? ""}
              onChange={(v) => set("sales_rep", v)} onDelete={delDir("seller")}
              options={Array.from(new Set([...sellerNames, ...dir.machines.map((m) => m.seller)].filter(Boolean))).map((s) => ({ value: s }))}
              allowCustom
              placeholder="เลือกเซลล์ หรือพิมพ์ชื่อใหม่"
            />
          </F>

          <div className="md:col-span-2">
            <F label="รายละเอียดงาน / บันทึกให้ช่าง">
              <Textarea disabled={locked} rows={3} value={form.job_detail ?? ""} onChange={(e) => set("job_detail", e.target.value)} />
            </F>
          </div>
          <div className="md:col-span-2">
            <F label="รูปภาพ / คลิปหน้างาน">
              <JobAttachments
                value={form.attachments}
                onChange={locked ? undefined : (v) => set("attachments", v ?? "")}
                readOnly={locked}
              />
            </F>
          </div>

        </div>

        <DialogFooter className="gap-2 [&>button]:w-full sm:[&>button]:w-auto">
          {canDelete && form.id && (
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
          {form.id && form.status !== "closed" && !editMode && (
            <Button variant="secondary" onClick={() => onCloseJob(form)}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> ปิดใบงาน
            </Button>
          )}
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
  const [quoteItems, setQuoteItems] = useState<string[]>([]);
  const [quotePart, setQuotePart] = useState("");
  const [quoteCat, setQuoteCat] = useState("");
  const [showAllQuote, setShowAllQuote] = useState(false);
  const [useChecklist, setUseChecklist] = useState(false);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [checklist, setChecklist] = useState<ChecklistResult | null>(null);
  const [pumpType, setPumpType] = useState<string | null>(null);

  // โหลดเทมเพลต + ผลเช็คลิสต์เดิม แล้วเลือกชุดตามประเภทเครื่องอัตโนมัติ
  useEffect(() => {
    let alive = true;
    (async () => {
      const [tpls, prevRes, unitRes] = await Promise.all([
        loadTemplates(),
        appt.id
          ? supabase.from("appointments").select("checklist").eq("id", appt.id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        appt.serial_number
          ? supabase
              .from("machine_units")
              .select("compressor_models(pump_type)")
              .eq("serial_number", appt.serial_number)
              .maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      if (!alive) return;
      setTemplates(tpls);
      const pt = (unitRes.data as any)?.compressor_models?.pump_type ?? null;
      setPumpType(pt);
      const prev = ((prevRes.data as any)?.checklist ?? null) as ChecklistResult | null;
      if (prev) {
        const t = tpls.find((x) => x.id === prev.template_id);
        setChecklist(t ? newResult(t, prev) : prev);
        setUseChecklist(true);
      } else {
        const t = tpls.find((x) => matchesType(x, pt)) ?? tpls[0];
        if (t) setChecklist(newResult(t));
      }
    })();
    return () => {
      alive = false;
    };
  }, [appt.id, appt.serial_number]);

  // โหลดรายละเอียดปิดงานเดิมเมื่อเข้ามาแก้ไข
  useEffect(() => {
    if (!isEdit || !appt.id) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("appointments")
        .select("quotation_required, parts_categories, parts_note, parts_replaced, quotation_items")
        .eq("id", appt.id)
        .maybeSingle();
      if (!alive || !data) return;
      setQuotation(!!data.quotation_required);
      setCats(
        splitNames(data.parts_replaced ?? "").length
          ? splitNames(data.parts_replaced)
          : splitNames(data.parts_categories ?? ""),
      );
      setPartsNote(data.parts_note ?? "");
      setQuoteItems(splitNames(data.quotation_items ?? ""));
    })();
    return () => {
      alive = false;
    };
  }, [isEdit, appt.id]);

  // คลังอะไหล่ทั้งหมด + อะไหล่ที่ผูกกับ S/N นี้ (แสดงเป็น Checkbox แยกตามหมวด)
  type CatalogPart = { id: string; label: string; category: string; model_id: string | null };
  const [products, setProducts] = useState<CatalogPart[]>([]);
  const [unitInfo, setUnitInfo] = useState<{ id: string; model_id: string | null } | null>(null);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [newPart, setNewPart] = useState("");
  const [newCat, setNewCat] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [prodRes, catRes] = await Promise.all([
        supabase.from("products").select("id, name, part_number, model_id, categories(name)").order("name").limit(1000),
        supabase.from("categories").select("id, name").order("sort_order").order("name"),
      ]);
      if (!alive) return;
      const list: CatalogPart[] = (prodRes.data ?? []).map((p: any) => ({
        id: p.id,
        label: [p.part_number, p.name].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · "),
        category: p.categories?.name ?? "อื่นๆ",
        model_id: p.model_id,
      }));
      setProducts(list);
      setCategories(catRes.data ?? []);

      if (!appt.serial_number) return;
      const { data: unit } = await supabase
        .from("machine_units")
        .select("id, model_id")
        .eq("serial_number", appt.serial_number)
        .maybeSingle();
      if (!alive || !unit?.id) return;
      setUnitInfo(unit);
      const { data: mp } = await supabase.from("machine_parts").select("product_id").eq("machine_unit_id", unit.id);
      if (!alive) return;
      const ids = (mp ?? []).map((r) => r.product_id).filter(Boolean) as string[];
      setLinkedIds(ids);
    })();
    return () => {
      alive = false;
    };
  }, [appt.serial_number]);

  // อะไหล่ที่แสดงเป็น Checkbox: ผูกกับ S/N + ตรงรุ่นเครื่อง (หรือทั้งคลังเมื่อกด "แสดงทั้งหมด")
  const visibleParts = products.filter(
    (p) => showAll || !unitInfo || linkedIds.includes(p.id) || (unitInfo.model_id && p.model_id === unitInfo.model_id) || cats.includes(p.label),
  );
  const grouped = visibleParts.reduce<Record<string, CatalogPart[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});
  const quoteParts = products.filter(
    (p) => showAllQuote || !unitInfo || linkedIds.includes(p.id) || (unitInfo.model_id && p.model_id === unitInfo.model_id) || quoteItems.includes(p.label),
  );
  const quoteGrouped = quoteParts.reduce<Record<string, CatalogPart[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});
  const quoteCategoryNames = Array.from(new Set([...categories.map((c) => c.name), ...PART_CATEGORIES]));
  const emptyQuoteCategories = quoteCategoryNames.filter((c) => !quoteGrouped[c]);
  const toggleCat = (c: string) =>
    setCats((list) => (list.includes(c) ? list.filter((x) => x !== c) : [...list, c]));
  const toggleQuote = (value: string) =>
    setQuoteItems((list) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]));

  /** ผูกอะไหล่เข้ากับ S/N ของเครื่อง (ถ้ายังไม่ผูก) */
  const linkToUnit = async (productIds: string[]) => {
    if (!unitInfo) return;
    const fresh = Array.from(new Set(productIds)).filter((id) => !linkedIds.includes(id));
    if (!fresh.length) return;
    const { error } = await supabase
      .from("machine_parts")
      .insert(fresh.map((product_id) => ({ machine_unit_id: unitInfo.id, product_id, quantity: 1 })));
    if (!error) setLinkedIds((l) => [...l, ...fresh]);
  };

  const addNewPart = async (target: "replaced" | "quote") => {
    const name = (target === "quote" ? quotePart : newPart).trim();
    const categoryId = target === "quote" ? quoteCat : newCat;
    if (!name) return;
    const exist = products.find((p) => p.label.toLowerCase().split(" · ").includes(name.toLowerCase()));
    if (exist) {
      const select = target === "quote" ? setQuoteItems : setCats;
      select((list) => (list.includes(exist.label) ? list : [...list, exist.label]));
      await linkToUnit([exist.id]);
      if (target === "quote") setQuotePart("");
      else setNewPart("");
      return toast.success(`เลือก "${exist.label}" แล้ว`);
    }
    setAdding(true);
    const { data, error } = await supabase
      .from("products")
      .insert({ name, part_number: name, category_id: categoryId || null, model_id: unitInfo?.model_id ?? null })
      .select("id")
      .single();
    if (error || !data) {
      setAdding(false);
      return toast.error(error?.message ?? "เพิ่มอะไหล่ไม่สำเร็จ");
    }
    const catName = categories.find((c) => c.id === categoryId)?.name ?? "อื่นๆ";
    setProducts((l) => [...l, { id: data.id, label: name, category: catName, model_id: unitInfo?.model_id ?? null }]);
    if (target === "quote") setQuoteItems((l) => [...l, name]);
    else setCats((l) => [...l, name]);
    await linkToUnit([data.id]);
    setAdding(false);
    if (target === "quote") setQuotePart("");
    else setNewPart("");
    toast.success(unitInfo ? `เพิ่ม "${name}" และผูกกับ S/N ${appt.serial_number} แล้ว` : `เพิ่ม "${name}" เข้าคลังแล้ว`);
  };

  const submit = async () => {
    if (!result) return toast.error("กรุณาเลือกผลสรุปงาน");
    setSaving(true);
    const doneDate = new Date().toISOString().slice(0, 10);
    const chosenParts = [...cats, ...quoteItems].filter((c) => !quoteCategoryNames.includes(c));
    await ensureParts(chosenParts.filter((c) => !products.some((p) => p.label === c)));
    // ผูกอะไหล่ที่เลือกทั้งหมดเข้ากับ S/N อัตโนมัติ
    if (unitInfo) {
      const known = products.filter((p) => chosenParts.includes(p.label)).map((p) => p.id);
      const unknown = chosenParts.filter((c) => !products.some((p) => p.label === c));
      let extra: string[] = [];
      if (unknown.length) {
        const { data } = await supabase.from("products").select("id").in("part_number", unknown);
        extra = (data ?? []).map((r) => r.id);
      }
      await linkToUnit([...known, ...extra]);
    }

    const { error } = await supabase
      .from("appointments")
      .update({
        status: "closed",
        result,
        close_note: note.trim() || null,
        closed_at: appt.closed_at ?? new Date().toISOString(),
        quotation_required: quotation,
        parts_categories: cats.filter((c) => PART_CATEGORIES.includes(c)).join(", ") || null,
        parts_note: partsNote.trim() || null,
        parts_replaced: [cats.join(", "), partsNote.trim()].filter(Boolean).join(" · ") || null,
        quotation_items: quoteItems.join(", ") || null,
        checklist: (useChecklist && checklist ? checklist : null) as never,
      })
      .eq("id", appt.id);
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    if (appt.work_order_id) {
      const { error: orderError } = await supabase
        .from("work_orders")
        .update({ status: "closed", visit_date: appt.visit_date, visit_time: appt.visit_time })
        .eq("id", appt.work_order_id);
      if (orderError) {
        setSaving(false);
        return toast.error("ปิดใบสั่งงานไม่สำเร็จ: " + orderError.message);
      }
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
    void notifyUsers({
      customerName: appt.customer_name,
      staffName: appt.staff_name,
      title: `${isEdit ? "อัปเดตผลการซ่อม" : "ปิดงานเรียบร้อย"}: ${appt.customer_name ?? ""}`,
      body: [
        appt.serial_number && `S/N ${appt.serial_number}`,
        appt.job_detail,
        `ผลงาน: ${result === "ok" ? "เรียบร้อย" : "ยังไม่เรียบร้อย"}`,
        note.trim(),
      ]
        .filter(Boolean)
        .join(" · "),
    });
    toast.success(isEdit ? "แก้ไขรายละเอียดปิดงานแล้ว" : "ปิดงานและบันทึกประวัติซ่อมบำรุงแล้ว");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-none sm:w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "แก้ไขรายละเอียดงานที่ปิดแล้ว" : "สรุปผลปิดงาน"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "แก้คำผิดหรืออัปเดตรายละเอียดของงานที่ปิดไปแล้ว แล้วกดบันทึก"
              : "เลือกผลสรุปและบันทึกรายละเอียดเข้าประวัติซ่อมบำรุงของเครื่อง"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-2">
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
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-2 rounded-lg border p-3">
          <p className="text-sm font-semibold">รายละเอียดการปิดงาน</p>
          <Textarea rows={3} placeholder="บันทึกสรุปงานสั้นๆ" value={note} onChange={(e) => setNote(e.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={quotation} onChange={(e) => setQuotation(e.target.checked)} />
            ต้องออกใบเสนอราคาให้ลูกค้า
          </label>
        </div>

        <div className="min-w-0 space-y-2 rounded-lg border p-3">
          <label className="flex items-center justify-between gap-2 text-sm font-semibold">
            ต้องการมี Checklist การตรวจสอบหรือไม่
            <Switch checked={useChecklist} onCheckedChange={setUseChecklist} />
          </label>
          {useChecklist && (
            <>
              <select
                className="h-9 w-full rounded border bg-background px-2 text-sm"
                value={checklist?.template_id ?? ""}
                onChange={(e) => {
                  const t = templates.find((x) => x.id === e.target.value);
                  if (t) setChecklist(newResult(t, checklist));
                }}
              >
                <option value="" disabled>เลือกชุดเช็คลิสต์</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.machine_types ? ` (${t.machine_types})` : ""}
                  </option>
                ))}
              </select>
              {pumpType && <p className="text-xs text-muted-foreground">ประเภทเครื่องนี้: {pumpType}</p>}
              {checklist && <ChecklistForm value={checklist} onChange={setChecklist} />}
            </>
          )}
        </div>

        <div className="min-w-0 space-y-2 rounded-lg border p-3">
          <p className="text-sm font-semibold">อะไหล่ที่เปลี่ยนในงานนี้</p>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {appt.serial_number
                ? `อะไหล่ของเครื่อง S/N ${appt.serial_number} (เลือกได้หลายรายการ)`
                : "ไม่มี S/N — เลือกจากคลังอะไหล่"}
            </p>
            <label className="flex shrink-0 items-center gap-1 text-xs">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
              แสดงทั้งคลัง
            </label>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {Object.entries(grouped)
              .sort(([a], [b]) => a.localeCompare(b, "th"))
              .map(([cat, items]) => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-muted-foreground">{cat}</p>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {items.map((p) => (
                      <label key={p.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={cats.includes(p.label)}
                          onChange={() => toggleCat(p.label)}
                        />
                        <span className="break-words">
                          {p.label}
                          {linkedIds.includes(p.id) && <span className="ml-1 text-[10px] text-primary">(ผูกแล้ว)</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            {/* หมวดที่ยังไม่มีอะไหล่ในคลัง — แสดงชื่อหมวดให้ติ๊กไว้ก่อน จนกว่าจะเพิ่มอะไหล่จริงเข้าไป */}
            {PART_CATEGORIES.filter((c) => !grouped[c]).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">หมวดที่ยังไม่มีอะไหล่ในระบบ (ติ๊กตามหมวดไว้ก่อน)</p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {PART_CATEGORIES.filter((c) => !grouped[c]).map((c) => (
                    <label key={c} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={cats.includes(c)} onChange={() => toggleCat(c)} />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-1.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Input
              className="min-w-0"
              placeholder="พิมพ์ชื่อ/รหัสอะไหล่ใหม่"
              value={newPart}
              onChange={(e) => setNewPart(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addNewPart("replaced");
                }
              }}
            />
            <select
              className="h-9 min-w-0 w-full rounded-md border bg-background px-2 text-sm"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
            >
              <option value="">หมวด: อื่นๆ</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button type="button" size="sm" className="w-full lg:w-auto" onClick={() => void addNewPart("replaced")} disabled={adding || !newPart.trim()}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "เพิ่ม+ผูก S/N"}
            </Button>
          </div>
          <Input
            placeholder="ระบุอะไหล่เพิ่มเติม / รายละเอียดอื่นๆ"
            value={partsNote}
            onChange={(e) => setPartsNote(e.target.value)}
          />
        </div>

        <div className="min-w-0 space-y-2 rounded-lg border p-3">
          <p className="text-sm font-semibold">รายการที่ต้องเสนอราคาเพิ่มเติม</p>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {appt.serial_number ? `อะไหล่ของเครื่อง S/N ${appt.serial_number}` : "อะไหล่จากคลัง"} (เลือกได้หลายรายการ)
            </p>
            <label className="flex shrink-0 items-center gap-1 text-xs">
              <input type="checkbox" checked={showAllQuote} onChange={(e) => setShowAllQuote(e.target.checked)} />
              แสดงทั้งคลัง
            </label>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {Object.entries(quoteGrouped).sort(([a], [b]) => a.localeCompare(b, "th")).map(([cat, items]) => (
              <div key={cat}>
                <p className="text-xs font-semibold text-muted-foreground">{cat}</p>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {items.map((p) => (
                    <label key={p.id} className="flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-1" checked={quoteItems.includes(p.label)} onChange={() => toggleQuote(p.label)} />
                      <span className="break-words">{p.label}{linkedIds.includes(p.id) && <span className="ml-1 text-[10px] text-primary">(ผูกแล้ว)</span>}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {emptyQuoteCategories.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">หมวดที่ยังไม่มีอะไหล่ในระบบ (ติ๊กตามหมวดไว้ก่อน)</p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {emptyQuoteCategories.map((c) => (
                    <label key={c} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={quoteItems.includes(c)} onChange={() => toggleQuote(c)} />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {quoteItems.filter((item) => !quoteCategoryNames.includes(item) && !products.some((p) => p.label === item)).map((item) => (
              <label key={item} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked onChange={() => toggleQuote(item)} />{item}
              </label>
            ))}
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-1.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Input
              className="min-w-0"
              placeholder="พิมพ์ชื่อ/รหัสอะไหล่ที่ต้องเสนอราคา"
              value={quotePart}
              onChange={(e) => setQuotePart(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addNewPart("quote"); } }}
            />
            <select className="h-9 min-w-0 w-full rounded-md border bg-background px-2 text-sm sm:w-auto" value={quoteCat} onChange={(e) => setQuoteCat(e.target.value)} aria-label="หมวดอะไหล่เสนอราคา">
              <option value="">หมวด: อื่นๆ</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button type="button" size="sm" className="w-full sm:w-auto" onClick={() => void addNewPart("quote")} disabled={adding || !quotePart.trim()}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "เพิ่ม+ผูก S/N"}
            </Button>
          </div>
        </div>

        <label className="flex min-w-0 items-start gap-2 text-sm md:col-span-2">
          <input type="checkbox" checked={resetParts} onChange={(e) => setResetParts(e.target.checked)} />
          รีเซ็ตอายุอะไหล่ของเครื่อง {appt.serial_number || "-"} เริ่มนับใหม่
        </label>
        </div>
        <DialogFooter className="[&>button]:w-full sm:[&>button]:w-auto">
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
    <div className="min-w-0 space-y-1">
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

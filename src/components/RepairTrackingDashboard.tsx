import { useEffect, useMemo, useState } from "react";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ClipboardList, FileSpreadsheet, Loader2, PackageCheck, Pencil, Plus, RefreshCw, Search, Wrench } from "lucide-react";
import { supabase } from "@/lib/data-client";
import { buildRepairReport, isInShop, repairSearch, repairStatus, REPAIR_STATUSES, STATUS_LABELS, type RepairOrder, type RepairStatus } from "@/lib/repair-orders";
import { repairReportSheets } from "@/lib/repair-orders-excel";
import type { SummaryPalette } from "@/lib/weekly-summary-excel";
import { weekRange } from "@/lib/weekly-summary";
import { exportFilename } from "@/lib/export-filename";
import { saveFile } from "@/lib/report";
import { describeSubmitError } from "@/lib/submit-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DateInput } from "@/components/ui/date-input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const repairOrdersQuery = queryOptions({
  queryKey: ["repair-orders"], staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true,
  queryFn: async () => {
    const rows: RepairOrder[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("repair_orders").select("*").order("check_in_date", { ascending: false }).range(offset, offset + 499);
      if (error) throw new Error(`โหลดข้อมูลเครื่องซ่อมไม่สำเร็จ: ${error.message}`);
      rows.push(...(data ?? []));
      if (!data || data.length < 500) return rows;
    }
  },
});

const statusStyle: Record<RepairStatus, string> = {
  Pending: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/40",
  "In Progress": "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/40",
  "Waiting Parts": "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/40",
  Ready: "bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/40",
  Completed: "bg-muted text-muted-foreground border-border",
};

type FormState = {
  company_name: string; contact_person: string; contact_phone: string; sales_person: string;
  equipment_model: string; serial_number: string; issue_description: string; check_in_date: string;
  status: RepairStatus; next_action: string; assigned_tech: string; target_delivery_date: string; actual_delivery_date: string;
};
const emptyForm = (): FormState => ({
  company_name: "", contact_person: "", contact_phone: "", sales_person: "", equipment_model: "", serial_number: "",
  issue_description: "", check_in_date: new Date().toISOString().slice(0, 10), status: "Pending", next_action: "",
  assigned_tech: "", target_delivery_date: "", actual_delivery_date: "",
});
const fromOrder = (o: RepairOrder): FormState => ({
  company_name: o.company_name, contact_person: o.contact_person ?? "", contact_phone: o.contact_phone ?? "",
  sales_person: o.sales_person ?? "", equipment_model: o.equipment_model ?? "", serial_number: o.serial_number ?? "",
  issue_description: o.issue_description ?? "", check_in_date: o.check_in_date, status: repairStatus(o.status),
  next_action: o.next_action ?? "", assigned_tech: o.assigned_tech ?? "",
  target_delivery_date: o.target_delivery_date ?? "", actual_delivery_date: o.actual_delivery_date ?? "",
});

function palette(): SummaryPalette {
  const color = (token: string) => {
    const canvas = document.createElement("canvas"); canvas.width = 1; canvas.height = 1;
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("เตรียมสี Excel ไม่สำเร็จ");
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(token).trim(); ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  };
  return { paper: color("--card"), text: color("--foreground"), border: color("--border"), header: color("--muted"), success: color("--summary-success") };
}

export default function RepairTrackingDashboard() {
  const { data: orders, isFetching } = useSuspenseQuery(repairOrdersQuery);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"in-shop" | RepairStatus | "all">("in-shop");
  const [editing, setEditing] = useState<RepairOrder | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    const refresh = () => { void qc.invalidateQueries({ queryKey: repairOrdersQuery.queryKey }); };
    window.addEventListener("app:data-changed", refresh);
    window.addEventListener("app:connection-restored", refresh);
    return () => { window.removeEventListener("app:data-changed", refresh); window.removeEventListener("app:connection-restored", refresh); };
  }, [qc]);

  const visible = useMemo(() => orders.filter((o) => {
    if (statusFilter === "in-shop" && !isInShop(o)) return false;
    if (statusFilter !== "in-shop" && statusFilter !== "all" && repairStatus(o.status) !== statusFilter) return false;
    return repairSearch(o, search);
  }), [orders, search, statusFilter]);

  const report = useMemo(() => {
    const range = weekRange();
    return buildRepairReport(orders, range.from, range.to);
  }, [orders]);

  const openAdd = () => { setForm(emptyForm()); setEditing(null); setAdding(true); };
  const openEdit = (o: RepairOrder) => { setForm(fromOrder(o)); setEditing(o); setAdding(true); };
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.company_name.trim()) { toast.error("กรุณากรอกชื่อบริษัท"); return; }
    setSaving(true);
    try {
      const payload = {
        company_name: form.company_name.trim(), contact_person: form.contact_person || null, contact_phone: form.contact_phone || null,
        sales_person: form.sales_person || null, equipment_model: form.equipment_model || null, serial_number: form.serial_number || null,
        issue_description: form.issue_description || null, check_in_date: form.check_in_date, status: form.status,
        next_action: form.next_action || null, assigned_tech: form.assigned_tech || null,
        target_delivery_date: form.target_delivery_date || null, actual_delivery_date: form.actual_delivery_date || null,
      };
      const { error } = editing
        ? await supabase.from("repair_orders").update(payload).eq("id", editing.id)
        : await supabase.from("repair_orders").insert(payload);
      if (error) throw error;
      toast.success(editing ? "อัปเดตเครื่องซ่อมแล้ว" : "รับเครื่องเข้าช็อปแล้ว");
      setAdding(false);
      await qc.invalidateQueries({ queryKey: repairOrdersQuery.queryKey });
    } catch (e) {
      toast.error(describeSubmitError(e));
    } finally {
      setSaving(false);
    }
  };

  const weeklyReport = async () => {
    setReporting(true);
    try {
      const range = weekRange();
      const { buildGridWorkbook } = await import("@/lib/excel-layout");
      const blob = await buildGridWorkbook(repairReportSheets(report, range.from, range.to, palette()));
      await saveFile(blob, exportFilename("รายงานเครื่องค้างช็อป", range.from, "xlsx", range.to));
    } catch {
      toast.error("ออกรายงาน Excel ไม่สำเร็จ");
    } finally {
      setReporting(false);
    }
  };

  return <div className="min-w-0 space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground"><Wrench className="size-4" /> รับเครื่องเข้าซ่อม</div>
        <h1 className="text-2xl font-semibold sm:text-3xl">ติดตามเครื่องค้างช็อป</h1>
        <p className="mt-2 text-sm text-muted-foreground">เครื่องที่อยู่ในช็อป {report.inShopTotal} เครื่อง · ส่งมอบแล้วสัปดาห์นี้ {report.delivered.length} เครื่อง</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="excel" onClick={() => void weeklyReport()} disabled={reporting || isFetching}>
          {reporting ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} ออกรายงานประชุมประจำสัปดาห์
        </Button>
        <Button onClick={openAdd}><Plus /> รับเครื่องเข้าช็อป</Button>
      </div>
    </header>

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {report.byStatus.map((s) => (
        <button key={s.status} type="button" onClick={() => setStatusFilter(statusFilter === s.status ? "in-shop" : s.status)}
          className={`rounded-lg border p-3 text-left transition-colors hover:bg-accent ${statusFilter === s.status ? "border-primary ring-1 ring-primary" : "border-border"}`}>
          <div className="text-xs text-muted-foreground">{s.label}</div>
          <div className="mt-1 text-2xl font-semibold">{s.count}</div>
        </button>
      ))}
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาบริษัท รุ่นเครื่อง S/N ผู้ขาย หรือเบอร์โทร" className="pl-9" />
      </div>
      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="in-shop">อยู่ในช็อป</SelectItem>
          <SelectItem value="all">ทั้งหมด</SelectItem>
          {REPAIR_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button variant="outline" size="icon" aria-label="รีเฟรช" onClick={() => void qc.invalidateQueries({ queryKey: repairOrdersQuery.queryKey })}>
        <RefreshCw className={isFetching ? "animate-spin" : ""} />
      </Button>
    </div>

    {visible.length === 0 ? (
      <div className="rounded-lg border border-dashed border-border py-16 text-center text-muted-foreground">
        <PackageCheck className="mx-auto mb-3 size-8" />
        {orders.length === 0 ? "ยังไม่มีเครื่องรับเข้าซ่อม กด “รับเครื่องเข้าช็อป” เพื่อเริ่มบันทึก" : "ไม่พบเครื่องที่ตรงกับการค้นหา"}
      </div>
    ) : (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((o) => {
          const status = repairStatus(o.status);
          return (
            <article key={o.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{o.company_name}</h2>
                  <p className="truncate text-sm text-muted-foreground">{[o.equipment_model, o.serial_number].filter(Boolean).join(" · ") || "ยังไม่ระบุรุ่น/S/N"}</p>
                </div>
                <Badge variant="outline" className={statusStyle[status]}>{STATUS_LABELS[status]}</Badge>
              </div>
              {o.issue_description && <p className="mt-2 line-clamp-2 text-sm">{o.issue_description}</p>}
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <div>รับเข้า: <span className="text-foreground">{o.check_in_date}</span></div>
                <div>กำหนดส่ง: <span className="text-foreground">{o.target_delivery_date ?? "ยังไม่กำหนด"}</span></div>
                <div>ผู้ดูแล: <span className="text-foreground">{o.sales_person || "-"}</span></div>
                <div>ช่าง: <span className="text-foreground">{o.assigned_tech || "-"}</span></div>
              </dl>
              {o.next_action && <p className="mt-2 rounded-md bg-muted px-2 py-1.5 text-xs">ทำต่อ: {o.next_action}</p>}
              <div className="mt-3 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => openEdit(o)}><Pencil /> แก้ไข / อัปเดตสถานะ</Button>
              </div>
            </article>
          );
        })}
      </div>
    )}

    <Dialog open={adding} onOpenChange={(open) => { if (!saving) setAdding(open); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ClipboardList className="size-5" /> {editing ? "แก้ไข / อัปเดตสถานะเครื่องซ่อม" : "รับเครื่องเข้าช็อป"}</DialogTitle>
          <DialogDescription>กรอกข้อมูลเครื่องที่รับเข้าซ่อม ทุกคนในทีมบันทึกและอัปเดตได้ทันที</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>จากบริษัท *</Label><Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>ผู้ติดต่อ</Label><Input value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>เบอร์โทรผู้ติดต่อ</Label><Input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>ผู้ขาย / ผู้ดูแลเคส</Label><Input value={form.sales_person} onChange={(e) => set("sales_person", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>ช่างผู้รับผิดชอบ</Label><Input value={form.assigned_tech} onChange={(e) => set("assigned_tech", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>รุ่นเครื่อง</Label><Input value={form.equipment_model} onChange={(e) => set("equipment_model", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>หมายเลขเครื่อง (S/N)</Label><Input value={form.serial_number} onChange={(e) => set("serial_number", e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>สาเหตุที่รับ / อาการเสีย</Label><Textarea value={form.issue_description} onChange={(e) => set("issue_description", e.target.value)} rows={2} /></div>
          <div className="space-y-1.5"><Label>รับมาวันที่</Label><DateInput value={form.check_in_date} onChange={(v) => set("check_in_date", v)} /></div>
          <div className="space-y-1.5"><Label>สถานะเครื่อง</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as RepairStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REPAIR_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>กำหนดส่งออกวันที่</Label><DateInput value={form.target_delivery_date} onChange={(v) => set("target_delivery_date", v)} /></div>
          <div className="space-y-1.5"><Label>ส่งออกจริงวันที่</Label><DateInput value={form.actual_delivery_date} onChange={(v) => set("actual_delivery_date", v)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>สิ่งที่ต้องทำต่อ</Label><Textarea value={form.next_action} onChange={(e) => set("next_action", e.target.value)} rows={2} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setAdding(false)} disabled={saving}>ยกเลิก</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="animate-spin" />} {editing ? "บันทึกการแก้ไข" : "รับเครื่องเข้าช็อป"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}

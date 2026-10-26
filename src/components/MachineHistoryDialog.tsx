import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchMachineHistory,
  type MachineHistoryData,
  type TimelineEvent,
  type InspectionRecord,
  type ChecklistItemDetail,
} from "@/lib/machine-history";
import { HandoverReportDialog } from "@/components/HandoverReportDialog";
import { ContractDialog } from "@/components/ContractDialog";
import { ChecklistView } from "@/components/ChecklistView";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Wrench,
  CalendarDays,
  Clock,
  User,
  ShieldCheck,
  ShieldAlert,
  FileText,
  PackageCheck,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  QrCode,
  Printer,
  Copy,
  Share2,
  Download,
  Loader2,
  CalendarClock,
  Sparkles,
  Info,
  MapPin,
  Phone,
  Building2,
  Briefcase,
  X,
  Maximize2,
  Eye,
  ChevronDown,
  ChevronUp,
  Table,
  Layers,
  Activity,
  Gauge,
  TrendingUp,
} from "lucide-react";

function formatDateTh(d?: string | null): string {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear() + 543;
  return `${dd}/${mm}/${yyyy}`;
}

export function MachineHistoryDialog({
  open,
  onOpenChange,
  serialNumber,
  machineUnitId,
  initialUnit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serialNumber?: string | null;
  machineUnitId?: string | null;
  initialUnit?: any;
}) {
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<MachineHistoryData | null>(null);
  const [tab, setTab] = useState<"timeline" | "checklists" | "profile" | "parts" | "passport">("timeline");
  const [timelineFilter, setTimelineFilter] = useState<string>("all");
  const [expandedChecklistId, setExpandedChecklistId] = useState<string | null>(null);
  const [inspectionViewMode, setInspectionViewMode] = useState<"matrix" | "cards">("matrix");

  // Selected appointment for opening Handover / Service Report
  const [selectedApptForReport, setSelectedApptForReport] = useState<any | null>(null);

  // Contract dialog opener
  const [contractDialogOpen, setContractDialogOpen] = useState<boolean>(false);

  // Image preview lightbox
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Passport print ref
  const passportRef = useRef<HTMLDivElement | null>(null);

  const loadData = async () => {
    if (!open) return;
    if (!serialNumber && !machineUnitId && !initialUnit) return;
    setLoading(true);
    try {
      const res = await fetchMachineHistory({
        machineUnitId: machineUnitId || initialUnit?.id,
        serialNumber: serialNumber || initialUnit?.serial_number,
      });
      setData(res);
    } catch (err) {
      console.error(err);
      toast.error("โหลดข้อมูลประวัติเครื่องจักรไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void loadData();
    } else {
      setData(null);
      setTab("timeline");
      setSelectedApptForReport(null);
      setPreviewImage(null);
      setExpandedChecklistId(null);
      setInspectionViewMode("matrix");
    }
  }, [open, serialNumber, machineUnitId]);

  const unit = data?.unit;
  const warranty = data?.warranty;
  const contract = data?.contract;
  const timeline = data?.timeline ?? [];
  const inspections = data?.inspections ?? [];

  const inspectionStats = useMemo(() => {
    let totalItems = 0;
    let passed = 0;
    let warning = 0;
    let failed = 0;
    for (const insp of inspections) {
      totalItems += insp.summary.total;
      passed += insp.summary.passed;
      warning += insp.summary.warning;
      failed += insp.summary.failed;
    }
    return {
      roundCount: inspections.length,
      totalItems,
      passed,
      warning,
      failed,
    };
  }, [inspections]);

  const allInspectionItemLabels = useMemo(() => {
    const set = new Set<string>();
    for (const insp of inspections) {
      for (const it of insp.items) {
        if (it.label) set.add(it.label.trim());
      }
    }
    return Array.from(set);
  }, [inspections]);

  // Filtered timeline events
  const filteredTimeline = useMemo(() => {
    if (timelineFilter === "all") return timeline;
    if (timelineFilter === "pm") {
      return timeline.filter(
        (t) =>
          t.service_type.toLowerCase().includes("pm") ||
          t.service_type.includes("บำรุงรักษา") ||
          t.source === "contract_visit",
      );
    }
    if (timelineFilter === "repair") {
      return timeline.filter(
        (t) =>
          t.service_type.includes("ซ่อม") ||
          t.service_type.toLowerCase().includes("repair") ||
          t.service_type.includes("แก้ไข") ||
          t.service_type.includes("ฉุกเฉิน"),
      );
    }
    if (timelineFilter === "check") {
      return timeline.filter(
        (t) =>
          t.service_type.includes("ตรวจ") ||
          t.service_type.includes("เช็ค") ||
          t.service_type.includes("ติดตั้ง"),
      );
    }
    return timeline;
  }, [timeline, timelineFilter]);

  const passportUrl = useMemo(() => {
    if (typeof window === "undefined" || !unit?.serial_number) return "";
    return `${window.location.origin}/?history=${encodeURIComponent(unit.serial_number)}`;
  }, [unit?.serial_number]);

  const copyPassportLink = () => {
    if (!passportUrl) return;
    navigator.clipboard.writeText(passportUrl);
    toast.success("คัดลอกลิงก์แฟ้มประวัติเครื่องแล้ว");
  };

  const sharePassport = async () => {
    if (!passportUrl || !unit) return;
    const modelName = `${unit.compressor_models?.brands?.name ?? ""} ${unit.compressor_models?.name ?? ""}`.trim();
    const shareText = `แฟ้มประวัติเครื่องจักร (Digital Passport)\nS/N: ${unit.serial_number}\nรุ่น: ${modelName || "-"}\nลูกค้า: ${unit.customers?.name ?? "-"}\nเปิดดูประวัติบริการ: ${passportUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `ประวัติเครื่องจักร S/N ${unit.serial_number}`,
          text: shareText,
          url: passportUrl,
        });
        return;
      } catch {
        /* ignore */
      }
    }
    copyPassportLink();
  };

  const downloadQrCode = () => {
    const canvas = document.getElementById("machine-passport-qr") as HTMLCanvasElement | null;
    if (!canvas || !unit) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `QR-Passport-${unit.serial_number}.png`;
    a.click();
    toast.success("บันทึกรูป QR Code แล้ว");
  };

  const handlePrintPassport = () => {
    window.print();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="z-[99999] w-[min(calc(100vw-1.5rem),960px)] max-w-[960px] max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-background border shadow-2xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Header Bar */}
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b bg-muted/20 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    DIGITAL PASSPORT
                  </span>
                  <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    S/N: {unit?.serial_number || serialNumber || "-"}
                  </span>
                  {unit?.customer_sn && (
                    <span className="font-mono text-xs text-muted-foreground bg-muted/80 px-2 py-0.5 rounded">
                      S/N ลูกค้า: {unit.customer_sn}
                    </span>
                  )}
                </div>

                <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-baseline gap-2">
                  <span>
                    {unit?.compressor_models?.brands?.name ? `${unit.compressor_models.brands.name} ` : ""}
                    {unit?.compressor_models?.name || "เครื่องอัดอากาศ"}
                  </span>
                </DialogTitle>

                <DialogDescription className="text-xs sm:text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    ลูกค้า:{" "}
                    <strong className="text-foreground">
                      {unit?.customers?.cust_id ? `[${unit.customers.cust_id}] ` : ""}
                      {unit?.customers?.name || "-"}
                    </strong>
                  </span>
                  {unit?.site_name && <span>สถานที่: {unit.site_name}</span>}
                  {unit?.province && <span>จังหวัด: {unit.province}</span>}
                </DialogDescription>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-1.5 shrink-0">
                {warranty?.hasWarranty && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-medium gap-1",
                      warranty.isExpired
                        ? "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900"
                        : "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900",
                    )}
                  >
                    {warranty.isExpired ? (
                      <ShieldAlert className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    {warranty.label}
                  </Badge>
                )}

                {contract?.hasContract && (
                  <Badge
                    variant="outline"
                    className="border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900 text-xs font-medium gap-1"
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    สัญญาบริการ ({contract.doneVisits}/{contract.totalVisits} งวด)
                  </Badge>
                )}

                {unit?.status && (
                  <Badge variant="secondary" className="text-xs font-normal">
                    สถานะ: {unit.status}
                  </Badge>
                )}
              </div>
            </div>

            {/* Navigation Tabs */}
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as any)}
              className="w-full mt-3 pt-1"
            >
              <TabsList className="grid grid-cols-5 w-full h-10 p-1 bg-muted/60">
                <TabsTrigger value="timeline" className="text-xs sm:text-sm gap-1.5 font-medium">
                  <Clock className="h-3.5 w-3.5 shrink-0 hidden xs:inline" />
                  <span>ไทม์ไลน์ ({timeline.length})</span>
                </TabsTrigger>
                <TabsTrigger value="checklists" className="text-xs sm:text-sm gap-1.5 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 hidden xs:inline text-primary" />
                  <span>เช็คลิสต์ ({inspections.length})</span>
                </TabsTrigger>
                <TabsTrigger value="profile" className="text-xs sm:text-sm gap-1.5 font-medium">
                  <Info className="h-3.5 w-3.5 shrink-0 hidden xs:inline" />
                  <span>ข้อมูล & สัญญา</span>
                </TabsTrigger>
                <TabsTrigger value="parts" className="text-xs sm:text-sm gap-1.5 font-medium">
                  <PackageCheck className="h-3.5 w-3.5 shrink-0 hidden xs:inline" />
                  <span>อะไหล่ ({unit?.machine_parts?.length ?? 0})</span>
                </TabsTrigger>
                <TabsTrigger value="passport" className="text-xs sm:text-sm gap-1.5 font-medium">
                  <QrCode className="h-3.5 w-3.5 shrink-0 hidden xs:inline" />
                  <span>Digital Passport</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </DialogHeader>

          {/* Modal Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 dropdown-scroll">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">กำลังโหลดประวัติเครื่องจักร...</p>
              </div>
            ) : !unit ? (
              <div className="text-center py-12 space-y-3">
                <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
                <p className="text-base font-semibold">ไม่พบข้อมูลเครื่องจักร</p>
                <p className="text-xs text-muted-foreground">
                  ไม่พบหมายเลขเครื่อง S/N: {serialNumber || machineUnitId} ในระบบ
                </p>
              </div>
            ) : (
              <>
                {/* TAB 1: MAINTENANCE TIMELINE LOG */}
                {tab === "timeline" && (
                  <div className="space-y-4">
                    {/* Filter buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b">
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          variant={timelineFilter === "all" ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs font-normal"
                          onClick={() => setTimelineFilter("all")}
                        >
                          ทั้งหมด ({timeline.length})
                        </Button>
                        <Button
                          type="button"
                          variant={timelineFilter === "pm" ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs font-normal"
                          onClick={() => setTimelineFilter("pm")}
                        >
                          งาน PM รายปี
                        </Button>
                        <Button
                          type="button"
                          variant={timelineFilter === "repair" ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs font-normal"
                          onClick={() => setTimelineFilter("repair")}
                        >
                          งานซ่อมแก้ไข
                        </Button>
                        <Button
                          type="button"
                          variant={timelineFilter === "check" ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs font-normal"
                          onClick={() => setTimelineFilter("check")}
                        >
                          ตรวจเช็ค / ติดตั้ง
                        </Button>
                      </div>

                      <span className="text-xs text-muted-foreground">
                        แสดง {filteredTimeline.length} รายการ
                      </span>
                    </div>

                    {filteredTimeline.length === 0 ? (
                      <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
                        ไม่พบประวัติการเข้าบริการในหมวดนี้
                      </div>
                    ) : (
                      <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                        {filteredTimeline.map((ev, idx) => {
                          const isClosed = ev.status === "closed" || ev.source === "maintenance_log";
                          const isScheduled = ev.status === "scheduled";
                          return (
                            <div key={ev.id} className="relative group">
                              {/* Dot marker */}
                              <div
                                className={cn(
                                  "absolute -left-6 sm:-left-8 top-1 flex h-6 w-6 sm:h-8 sm:w-8 -translate-x-1/2 items-center justify-center rounded-full border-2 bg-background shadow-xs transition-transform group-hover:scale-110",
                                  isClosed
                                    ? ev.result === "not_ok"
                                      ? "border-rose-500 text-rose-500"
                                      : "border-emerald-500 text-emerald-600"
                                    : isScheduled
                                      ? "border-blue-500 text-blue-500"
                                      : "border-amber-500 text-amber-500",
                                )}
                              >
                                {isClosed ? (
                                  ev.result === "not_ok" ? (
                                    <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
                                  ) : (
                                    <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                  )
                                ) : (
                                  <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                                )}
                              </div>

                              {/* Timeline Entry Card */}
                              <Card className="rounded-xl border shadow-xs overflow-hidden transition-all hover:border-primary/40 hover:shadow-sm">
                                <div className="p-4 space-y-3">
                                  {/* Top line: Date, Service Type, Status */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="flex items-center gap-1 font-semibold text-sm text-foreground bg-muted/60 px-2.5 py-0.5 rounded-md">
                                        <CalendarDays className="h-3.5 w-3.5 text-primary" />
                                        {formatDateTh(ev.date)}
                                        {ev.time && <span className="font-normal text-muted-foreground">({ev.time} น.)</span>}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className="font-medium text-xs bg-primary/5 text-primary border-primary/20"
                                      >
                                        {ev.service_type}
                                      </Badge>
                                      {ev.job_no && (
                                        <span className="text-[11px] font-mono text-muted-foreground">
                                          #{ev.job_no}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      {ev.result && (
                                        <Badge
                                          variant={ev.result === "not_ok" ? "destructive" : "secondary"}
                                          className="text-[11px]"
                                        >
                                          {ev.result === "not_ok" ? "พบปัญหา" : "ผ่าน / ปกติ"}
                                        </Badge>
                                      )}
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[11px]",
                                          isClosed
                                            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                                            : isScheduled
                                              ? "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-300"
                                              : "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300",
                                        )}
                                      >
                                        {isClosed ? "ปิดงานแล้ว" : isScheduled ? "นัดหมายล่วงหน้า" : "กำลังดำเนินการ"}
                                      </Badge>
                                    </div>
                                  </div>

                                  {/* Staff info */}
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1 font-medium text-foreground">
                                      <User className="h-3.5 w-3.5 text-primary" />
                                      ช่างผู้รับผิดชอบ: {ev.staff_name}
                                    </span>
                                    {ev.vehicle_plate && (
                                      <span>ทะเบียนรถ: {ev.vehicle_plate}</span>
                                    )}
                                  </div>

                                  {/* Job Detail */}
                                  {ev.job_detail && (
                                    <p className="text-sm whitespace-pre-wrap break-words text-foreground bg-muted/20 p-2.5 rounded-lg border border-border/50">
                                      {ev.job_detail}
                                    </p>
                                  )}

                                  {/* Close Notes if any */}
                                  {ev.close_note && (
                                    <div className="text-xs text-muted-foreground bg-amber-50/60 dark:bg-amber-950/20 p-2 rounded border border-amber-200/50 dark:border-amber-900/40">
                                      <strong className="text-amber-800 dark:text-amber-300">หมายเหตุปิดงาน: </strong>
                                      {ev.close_note}
                                    </div>
                                  )}

                                  {/* Replaced Parts */}
                                  {(ev.parts_replaced || ev.parts_note) && (
                                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-50/40 p-2.5 dark:bg-emerald-950/15 space-y-1">
                                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                                        <PackageCheck className="h-4 w-4 text-emerald-600" />
                                        อะไหล่และอุปกรณ์ที่เปลี่ยนในรอบนี้:
                                      </div>
                                      {ev.parts_replaced && (
                                        <p className="text-xs text-emerald-900 dark:text-emerald-200 whitespace-pre-wrap">
                                          {ev.parts_replaced}
                                        </p>
                                      )}
                                      {ev.parts_note && (
                                        <p className="text-[11px] text-muted-foreground">
                                          หมายเหตุอะไหล่: {ev.parts_note}
                                        </p>
                                      )}
                                    </div>
                                  )}

                                  {/* Checklist Summary & Expander */}
                                  {ev.checklistSummary && (
                                    <div className="space-y-2 rounded-lg bg-muted/30 p-2.5 border border-border/60">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                          <span>
                                            ผลตรวจเช็คลิสต์: ผ่าน {ev.checklistSummary.passedItems}/
                                            {ev.checklistSummary.totalItems} รายการ
                                            {ev.checklistSummary.warningItems > 0 && (
                                              <span className="text-amber-600 font-medium ml-1">
                                                (ควรเฝ้าระวัง {ev.checklistSummary.warningItems})
                                              </span>
                                            )}
                                            {ev.checklistSummary.failedItems > 0 && (
                                              <span className="text-rose-600 font-medium ml-1">
                                                (ต้องแก้ไข {ev.checklistSummary.failedItems})
                                              </span>
                                            )}
                                          </span>
                                        </div>

                                        {ev.checklistData && (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-[11px] gap-1 text-primary hover:bg-primary/10 cursor-pointer font-medium"
                                            onClick={() =>
                                              setExpandedChecklistId(
                                                expandedChecklistId === ev.id ? null : ev.id,
                                              )
                                            }
                                          >
                                            {expandedChecklistId === ev.id ? (
                                              <>
                                                <ChevronUp className="h-3 w-3" /> ซ่อนผลเช็คลิสต์
                                              </>
                                            ) : (
                                              <>
                                                <ChevronDown className="h-3 w-3" /> ดูค่าวัดฉบับเต็ม ({ev.checklistSummary.totalItems} ข้อ)
                                              </>
                                            )}
                                          </Button>
                                        )}
                                      </div>

                                      {ev.checklistData && expandedChecklistId === ev.id && (
                                        <div className="pt-2 border-t mt-1 bg-background/90 rounded-md p-2.5 shadow-2xs">
                                          <ChecklistView value={ev.checklistData} />
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Job Photos Attachments */}
                                  {ev.attachments && ev.attachments.length > 0 && (
                                    <div className="space-y-1.5 pt-1">
                                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                        <ImageIcon className="h-3.5 w-3.5" />
                                        ภาพบันทึกหน้างาน ({ev.attachments.length} รูป):
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        {ev.attachments.map((att, photoIdx) => (
                                          <button
                                            key={photoIdx}
                                            type="button"
                                            onClick={() => setPreviewImage(att.url)}
                                            className="group relative h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-lg border bg-muted cursor-pointer transition-transform hover:scale-105"
                                          >
                                            <img
                                              src={att.url}
                                              alt={att.name || `ภาพหน้างาน ${photoIdx + 1}`}
                                              className="h-full w-full object-cover"
                                              loading="lazy"
                                            />
                                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                              <Maximize2 className="h-4 w-4" />
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Action button: View Service Report */}
                                  {ev.rawAppointment && (
                                    <div className="pt-1 flex justify-end">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer font-medium"
                                        onClick={() => setSelectedApptForReport(ev.rawAppointment)}
                                      >
                                        <FileText className="h-3.5 w-3.5" />
                                        ดูใบรายงานบริการ (Service Report)
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </Card>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB: CHECKLIST & INSPECTION HISTORY */}
                {tab === "checklists" && (
                  <div className="space-y-5">
                    {/* Top KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Card className="p-3.5 border shadow-2xs space-y-1">
                        <span className="text-[11px] font-medium text-muted-foreground block flex items-center gap-1">
                          <Activity className="h-3.5 w-3.5 text-primary" />
                          รอบตรวจเช็คทั้งหมด
                        </span>
                        <div className="text-xl sm:text-2xl font-bold text-foreground">
                          {inspectionStats.roundCount} <span className="text-xs font-normal text-muted-foreground">รอบ</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">บันทึกตรวจเช็คตามสัญญา</p>
                      </Card>

                      <Card className="p-3.5 border-l-4 border-l-emerald-500 shadow-2xs space-y-1">
                        <span className="text-[11px] font-medium text-muted-foreground block flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          ผ่านเกณฑ์ปกติ
                        </span>
                        <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {inspectionStats.passed} <span className="text-xs font-normal text-muted-foreground">รายการ</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">สภาพเครื่องสมบูรณ์</p>
                      </Card>

                      <Card className="p-3.5 border-l-4 border-l-amber-500 shadow-2xs space-y-1">
                        <span className="text-[11px] font-medium text-muted-foreground block flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          ควรเฝ้าระวัง
                        </span>
                        <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
                          {inspectionStats.warning} <span className="text-xs font-normal text-muted-foreground">รายการ</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">สังเกตหรือเปลี่ยนในรอบหน้า</p>
                      </Card>

                      <Card className="p-3.5 border-l-4 border-l-rose-500 shadow-2xs space-y-1">
                        <span className="text-[11px] font-medium text-muted-foreground block flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                          ต้องแก้ไขด่วน
                        </span>
                        <div className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400">
                          {inspectionStats.failed} <span className="text-xs font-normal text-muted-foreground">รายการ</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">พบความผิดปกติ</p>
                      </Card>
                    </div>

                    {/* Mode Toggle Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant={inspectionViewMode === "matrix" ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs gap-1.5 font-medium cursor-pointer"
                          onClick={() => setInspectionViewMode("matrix")}
                        >
                          <Table className="h-3.5 w-3.5" />
                          ตารางเปรียบเทียบค่าข้ามรอบ (Matrix)
                        </Button>
                        <Button
                          type="button"
                          variant={inspectionViewMode === "cards" ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs gap-1.5 font-medium cursor-pointer"
                          onClick={() => setInspectionViewMode("cards")}
                        >
                          <Layers className="h-3.5 w-3.5" />
                          รายละเอียดตามรอบวัน ({inspections.length})
                        </Button>
                      </div>

                      <span className="text-xs text-muted-foreground">
                        ผูกข้อมูลเข้ากับ S/N {unit?.serial_number}
                      </span>
                    </div>

                    {inspections.length === 0 ? (
                      <div className="rounded-xl border border-dashed py-14 text-center space-y-2 text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 text-muted-foreground/60 mx-auto" />
                        <p className="text-sm font-semibold text-foreground">ยังไม่มีประวัติการบันทึกเช็คลิสต์</p>
                        <p className="text-xs max-w-md mx-auto">
                          เมื่อช่างเข้าบริการและบันทึกผลการตรวจเช็คหน้างานพร้อมค่าวัดตัวเลขและรูปถ่าย ระบบจะซิงค์ข้อมูลเข้าสู่ Digital Passport ของเครื่องนี้อัตโนมัติ
                        </p>
                      </div>
                    ) : inspectionViewMode === "matrix" ? (
                      /* VIEW 1: COMPARISON MATRIX */
                      <div className="space-y-4">
                        <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
                          <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <TrendingUp className="h-4 w-4 text-primary" />
                              เปรียบเทียบผลตรวจเช็คและค่าวัดตัวเลขแต่ละรอบบริการ (Inspection Trend & Abnormal Check)
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {inspections.length} รอบตรวจล่าสุด
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                                  <th className="p-3 min-w-[200px] sticky left-0 bg-muted/90 backdrop-blur-xs z-10 border-r shadow-xs">
                                    รายการตรวจสอบ / ค่าวัด
                                  </th>
                                  {inspections.map((insp, idx) => (
                                    <th key={insp.id} className="p-3 min-w-[170px] border-r last:border-r-0">
                                      <div className="space-y-0.5">
                                        <div className="text-foreground font-bold text-xs flex items-center gap-1">
                                          <span>รอบที่ {inspections.length - idx}</span>
                                          <span className="font-normal text-[11px] text-muted-foreground">
                                            ({formatDateTh(insp.date)})
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-muted-foreground truncate">
                                          ช่าง: {insp.staff_name}
                                        </div>
                                        <div className="flex items-center gap-1 pt-1">
                                          <span className="rounded bg-emerald-500/15 text-emerald-700 px-1.5 py-0.2 text-[10px] font-semibold">
                                            ผ่าน {insp.summary.passed}
                                          </span>
                                          {insp.summary.warning > 0 && (
                                            <span className="rounded bg-amber-500/20 text-amber-800 px-1.5 py-0.2 text-[10px] font-semibold">
                                              เตือน {insp.summary.warning}
                                            </span>
                                          )}
                                          {insp.summary.failed > 0 && (
                                            <span className="rounded bg-rose-500/20 text-rose-700 px-1.5 py-0.2 text-[10px] font-semibold">
                                              แก้ไข {insp.summary.failed}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {allInspectionItemLabels.map((lbl, rowIdx) => {
                                  return (
                                    <tr
                                      key={rowIdx}
                                      className="border-b hover:bg-muted/20 transition-colors"
                                    >
                                      <td className="p-3 font-medium text-foreground sticky left-0 bg-background/95 backdrop-blur-xs z-10 border-r shadow-xs">
                                        {lbl}
                                      </td>
                                      {inspections.map((insp) => {
                                        const matchItem = insp.items.find((it) => it.label === lbl);
                                        if (!matchItem) {
                                          return (
                                            <td key={insp.id} className="p-3 text-muted-foreground border-r last:border-r-0 text-center">
                                              -
                                            </td>
                                          );
                                        }

                                        const isNormal = matchItem.status === "normal";
                                        const isWarning = matchItem.status === "replace";
                                        const isFailed = matchItem.status === "abnormal";

                                        return (
                                          <td
                                            key={insp.id}
                                            className={cn(
                                              "p-3 border-r last:border-r-0 align-top transition-colors",
                                              isWarning && "bg-amber-500/10 dark:bg-amber-950/20",
                                              isFailed && "bg-rose-500/10 dark:bg-rose-950/20",
                                            )}
                                          >
                                            <div className="space-y-1">
                                              {matchItem.status && (
                                                <span
                                                  className={cn(
                                                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                                                    isNormal && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-300",
                                                    isWarning && "bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300",
                                                    isFailed && "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300",
                                                  )}
                                                >
                                                  {isNormal && <CheckCircle2 className="h-3 w-3" />}
                                                  {(isWarning || isFailed) && <AlertTriangle className="h-3 w-3" />}
                                                  {matchItem.statusLabelTh}
                                                </span>
                                              )}

                                              {matchItem.displayValue ? (
                                                <div className="font-mono text-xs font-bold text-foreground">
                                                  {matchItem.displayValue}
                                                </div>
                                              ) : (
                                                !matchItem.status && <span className="text-muted-foreground">-</span>
                                              )}
                                            </div>
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Photos from inspections */}
                        <div className="space-y-2 pt-2">
                          <h5 className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5">
                            <ImageIcon className="h-4 w-4 text-primary" />
                            ภาพบันทึกหน้างานตามรอบตรวจเช็ค
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {inspections
                              .filter((insp) => insp.attachments && insp.attachments.length > 0)
                              .map((insp) => (
                                <div key={insp.id} className="p-3 rounded-xl border bg-card space-y-2">
                                  <div className="flex items-center justify-between text-xs border-b pb-1">
                                    <span className="font-semibold text-foreground">
                                      {formatDateTh(insp.date)} · ช่าง {insp.staff_name}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {insp.attachments.length} รูป
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {insp.attachments.map((att, photoIdx) => (
                                      <button
                                        key={photoIdx}
                                        type="button"
                                        onClick={() => setPreviewImage(att.url)}
                                        className="group relative h-16 w-16 overflow-hidden rounded-lg border bg-muted cursor-pointer hover:scale-105 transition-transform"
                                      >
                                        <img
                                          src={att.url}
                                          alt={att.name || `ภาพรอบตรวจ`}
                                          className="h-full w-full object-cover"
                                          loading="lazy"
                                        />
                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                          <Maximize2 className="h-3.5 w-3.5" />
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* VIEW 2: ROUND-BY-ROUND CARDS */
                      <div className="space-y-4">
                        {inspections.map((insp, idx) => (
                          <Card key={insp.id} className="p-4 rounded-xl border shadow-2xs space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-foreground">
                                    รอบตรวจที่ {inspections.length - idx} · {formatDateTh(insp.date)}
                                  </span>
                                  {insp.job_no && (
                                    <span className="font-mono text-xs text-muted-foreground">
                                      #{insp.job_no}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {insp.template_name} · ช่างผู้ตรวจ: {insp.staff_name}
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 text-xs">
                                  ผ่าน {insp.summary.passed}
                                </Badge>
                                {insp.summary.warning > 0 && (
                                  <Badge className="bg-amber-500/20 text-amber-800 border-amber-300 text-xs">
                                    ควรเฝ้าระวัง {insp.summary.warning}
                                  </Badge>
                                )}
                                {insp.summary.failed > 0 && (
                                  <Badge className="bg-rose-500/20 text-rose-700 border-rose-300 text-xs">
                                    ต้องแก้ไข {insp.summary.failed}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Inspection Items Table */}
                            <div className="rounded-lg border overflow-hidden">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-muted/40 text-muted-foreground font-semibold border-b">
                                    <th className="p-2 text-left">รายการตรวจสอบ</th>
                                    <th className="p-2 text-left w-32">สถานะ</th>
                                    <th className="p-2 text-left">ค่าวัดตัวเลข / รายละเอียด</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {insp.items.map((it) => (
                                    <tr key={it.id} className="border-b last:border-b-0">
                                      <td className="p-2 font-medium text-foreground">{it.label}</td>
                                      <td className="p-2">
                                        {it.status ? (
                                          <span
                                            className={cn(
                                              "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold",
                                              it.status === "normal" && "bg-emerald-500/15 text-emerald-700 border border-emerald-300",
                                              it.status === "replace" && "bg-amber-500/20 text-amber-800 border border-amber-300",
                                              it.status === "abnormal" && "bg-rose-500/20 text-rose-700 border border-rose-300",
                                            )}
                                          >
                                            {it.statusLabelTh}
                                          </span>
                                        ) : (
                                          "-"
                                        )}
                                      </td>
                                      <td className="p-2 font-mono font-bold text-foreground">
                                        {it.displayValue || "-"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Photos in this round */}
                            {insp.attachments && insp.attachments.length > 0 && (
                              <div className="space-y-1 pt-1">
                                <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                                  <ImageIcon className="h-3 w-3" /> รูปภาพหน้างานรอบนี้ ({insp.attachments.length} รูป):
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {insp.attachments.map((att, photoIdx) => (
                                    <button
                                      key={photoIdx}
                                      type="button"
                                      onClick={() => setPreviewImage(att.url)}
                                      className="group relative h-16 w-16 overflow-hidden rounded-lg border bg-muted cursor-pointer hover:scale-105 transition-transform"
                                    >
                                      <img
                                        src={att.url}
                                        alt={att.name || `ภาพรอบตรวจ`}
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                      />
                                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                        <Maximize2 className="h-3.5 w-3.5" />
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {insp.rawAppointment && (
                              <div className="flex justify-end pt-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                                  onClick={() => setSelectedApptForReport(insp.rawAppointment)}
                                >
                                  <FileText className="h-3 w-3" /> ดูใบรายงานบริการ
                                </Button>
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: PROFILE & CONTRACT DETAILS */}
                {tab === "profile" && (
                  <div className="space-y-5">
                    {/* Top Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Warranty Card */}
                      <Card className="p-4 border-l-4 border-l-primary space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            สถานะการรับประกัน (Warranty)
                          </span>
                          <Badge
                            variant={warranty?.isExpired ? "destructive" : "default"}
                            className="text-xs"
                          >
                            {warranty?.hasWarranty
                              ? warranty.isExpired
                                ? "หมดประกันแล้ว"
                                : "อยู่ในประกัน"
                              : "ไม่มีข้อมูล"}
                          </Badge>
                        </div>
                        <div className="text-lg font-bold text-foreground">
                          {warranty?.hasWarranty ? formatDateTh(warranty.warrantyEnd) : "ไม่ระบุวันหมดประกัน"}
                        </div>
                        <p className="text-xs text-muted-foreground">{warranty?.label}</p>
                      </Card>

                      {/* Contract Card */}
                      <Card className="p-4 border-l-4 border-l-blue-500 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                            <CalendarClock className="h-4 w-4 text-blue-500" />
                            สัญญาบริการรายปี (Service Contract)
                          </span>
                          {contract?.hasContract && (
                            <Badge variant="outline" className="text-xs border-blue-400 text-blue-600">
                              ใช้งานอยู่
                            </Badge>
                          )}
                        </div>
                        <div className="text-lg font-bold text-foreground">
                          {contract?.hasContract
                            ? `เข้าแล้ว ${contract.doneVisits} จาก ${contract.totalVisits} ครั้ง/ปี`
                            : "ยังไม่มีสัญญาบริการที่ผูกไว้"}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>งวดถัดไป: {formatDateTh(contract?.nextVisitDate) || "ไม่มีกำหนด"}</span>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs text-blue-600"
                            onClick={() => setContractDialogOpen(true)}
                          >
                            จัดการสัญญา &gt;
                          </Button>
                        </div>
                      </Card>
                    </div>

                    {/* Machine Specifications */}
                    <Card className="p-4 space-y-3">
                      <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                        <Wrench className="h-4 w-4 text-primary" /> ข้อมูลทางเทคนิคและสเปกเครื่อง
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        <div className="p-2.5 rounded-lg bg-muted/30">
                          <span className="text-xs text-muted-foreground block">หมายเลขซีเรียล (S/N)</span>
                          <span className="font-mono font-bold text-foreground">{unit.serial_number}</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-muted/30">
                          <span className="text-xs text-muted-foreground block">S/N ของลูกค้า</span>
                          <span className="font-mono text-foreground">{unit.customer_sn || "-"}</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-muted/30">
                          <span className="text-xs text-muted-foreground block">รุ่นเครื่องจักร</span>
                          <span className="font-semibold text-foreground">
                            {unit.compressor_models?.brands?.name ? `${unit.compressor_models.brands.name} ` : ""}
                            {unit.compressor_models?.name || "-"}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-muted/30">
                          <span className="text-xs text-muted-foreground block">ชนิดปั๊ม (Pump Type)</span>
                          <span className="text-foreground">{unit.compressor_models?.pump_type || "-"}</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-muted/30">
                          <span className="text-xs text-muted-foreground block">วันที่ติดตั้ง (Installation)</span>
                          <span className="text-foreground">{formatDateTh(unit.install_date)}</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-muted/30">
                          <span className="text-xs text-muted-foreground block">ชั่วโมงการทำงานต่อวัน</span>
                          <span className="text-foreground">
                            {unit.daily_hours != null ? `${unit.daily_hours} ชม./วัน` : "-"}
                          </span>
                        </div>
                      </div>
                    </Card>

                    {/* Customer & Location */}
                    <Card className="p-4 space-y-3">
                      <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-primary" /> ข้อมูลลูกค้าและสถานที่ติดตั้ง
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="p-2.5 rounded-lg bg-muted/30">
                          <span className="text-xs text-muted-foreground block">ชื่อลูกค้า / บริษัท</span>
                          <span className="font-semibold text-foreground">
                            {unit.customers?.cust_id ? `[${unit.customers.cust_id}] ` : ""}
                            {unit.customers?.name || "-"}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-muted/30">
                          <span className="text-xs text-muted-foreground block">เบอร์ติดต่อ</span>
                          <span className="text-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {unit.customers?.phone || "-"}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-muted/30">
                          <span className="text-xs text-muted-foreground block">สถานที่ / โรงงาน (Site Name)</span>
                          <span className="text-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {unit.site_name || "-"}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-muted/30">
                          <span className="text-xs text-muted-foreground block">ผู้ขาย / เซลล์รับผิดชอบ</span>
                          <span className="text-foreground flex items-center gap-1">
                            <Briefcase className="h-3 w-3 text-muted-foreground" />
                            {unit.seller || "-"}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-muted/30 sm:col-span-2">
                          <span className="text-xs text-muted-foreground block">ที่อยู่จัดส่ง / บริการ</span>
                          <span className="text-foreground">
                            {[unit.address_line, unit.district, unit.province].filter(Boolean).join(" • ") ||
                              unit.customers?.address ||
                              "-"}
                          </span>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* TAB 3: INSTALLED PARTS & WEAR STATUS */}
                {tab === "parts" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                        <PackageCheck className="h-4 w-4 text-primary" />
                        รายการอะไหล่ประจำเครื่องจักร ({unit.machine_parts?.length ?? 0} รายการ)
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        คำนวณจาก ชม.ทำงาน {unit.daily_hours ?? 0} ชม./วัน
                      </span>
                    </div>

                    {!unit.machine_parts || unit.machine_parts.length === 0 ? (
                      <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
                        ยังไม่มีรายการอะไหล่ที่ผูกไว้กับเครื่องจักรนี้
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {unit.machine_parts.map((mp) => {
                          const p = mp.products;
                          const interval = mp.service_interval_hours ?? p?.service_interval_hours ?? null;
                          const lastChanged = mp.last_changed_at;
                          const daily = unit.daily_hours ?? 0;

                          // Compute next change date
                          const nextChangeDate = (() => {
                            if (!lastChanged || !interval || daily <= 0) return null;
                            const d = new Date(lastChanged);
                            d.setDate(d.getDate() + Math.round(interval / daily));
                            return d.toISOString().slice(0, 10);
                          })();

                          // Compute hours used
                          const usedHours =
                            mp.hours_used != null && mp.hours_used > 0
                              ? mp.hours_used
                              : lastChanged && daily > 0
                                ? Math.round(
                                    Math.max(
                                      0,
                                      Math.floor((Date.now() - new Date(lastChanged).getTime()) / 86400000),
                                    ) * daily,
                                  )
                                : null;

                          const isOverdue = usedHours != null && interval != null && usedHours >= interval;
                          const isWarning =
                            usedHours != null && interval != null && !isOverdue && usedHours >= interval * 0.85;

                          return (
                            <Card key={mp.id} className="p-3.5 space-y-2 border shadow-2xs">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <span className="text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                    {p?.categories?.name || "อะไหล่"}
                                  </span>
                                  <h5 className="font-semibold text-sm text-foreground mt-1 truncate">
                                    {p?.name || "ไม่ระบุชื่ออะไหล่"}
                                  </h5>
                                  <p className="font-mono text-xs text-muted-foreground">
                                    P/N: {p?.part_number || "-"}
                                  </p>
                                </div>
                                <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
                                  x{mp.quantity ?? 1}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t">
                                <div>
                                  <span className="text-muted-foreground block text-[10px]">เปลี่ยนล่าสุด:</span>
                                  <span className="font-medium text-foreground">
                                    {formatDateTh(lastChanged)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-[10px]">รอบถัดไป:</span>
                                  <span
                                    className={cn(
                                      "font-medium",
                                      isOverdue
                                        ? "text-rose-600 font-bold"
                                        : isWarning
                                          ? "text-amber-600 font-bold"
                                          : "text-foreground",
                                    )}
                                  >
                                    {formatDateTh(nextChangeDate)}
                                  </span>
                                </div>
                              </div>

                              {interval && (
                                <div className="text-[11px] text-muted-foreground flex items-center justify-between bg-muted/30 px-2 py-1 rounded">
                                  <span>อายุบริการ: {interval.toLocaleString()} ชม.</span>
                                  <span>ใช้งานแล้ว: {usedHours != null ? `${usedHours.toLocaleString()} ชม.` : "-"}</span>
                                </div>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: DIGITAL PASSPORT & QR CODE */}
                {tab === "passport" && (
                  <div className="space-y-6">
                    {/* Official Digital Passport Card */}
                    <div
                      ref={passportRef}
                      className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-card to-primary/5 p-6 shadow-md space-y-5"
                    >
                      <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 border-b border-primary/20 pb-4">
                        <div className="space-y-1 text-center sm:text-left">
                          <div className="flex items-center justify-center sm:justify-start gap-2">
                            <Sparkles className="h-5 w-5 text-primary" />
                            <h3 className="text-xl font-bold tracking-tight text-foreground">
                              MACHINE DIGITAL PASSPORT
                            </h3>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            ระบบบันทึกและตรวจสอบประวัติการบริการเครื่องจักร (Pneumax Air Service)
                          </p>
                        </div>

                        {/* Status Badge on Passport */}
                        <Badge variant="outline" className="text-xs bg-background/80 border-primary font-semibold">
                          VERIFIED MACHINE
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
                        {/* Left: Specs table */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div className="p-2.5 rounded-lg bg-background/80 border">
                            <span className="text-xs text-muted-foreground block">Serial Number</span>
                            <span className="font-mono text-base font-bold text-foreground">
                              {unit.serial_number}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-background/80 border">
                            <span className="text-xs text-muted-foreground block">Model / Brand</span>
                            <span className="font-semibold text-foreground">
                              {unit.compressor_models?.brands?.name ? `${unit.compressor_models.brands.name} ` : ""}
                              {unit.compressor_models?.name || "-"}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-background/80 border">
                            <span className="text-xs text-muted-foreground block">Customer</span>
                            <span className="font-medium text-foreground">
                              {unit.customers?.cust_id ? `[${unit.customers.cust_id}] ` : ""}
                              {unit.customers?.name || "-"}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-background/80 border">
                            <span className="text-xs text-muted-foreground block">Installation</span>
                            <span className="text-foreground">{formatDateTh(unit.install_date)}</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-background/80 border">
                            <span className="text-xs text-muted-foreground block">Warranty Status</span>
                            <span
                              className={cn(
                                "font-semibold",
                                warranty?.isExpired ? "text-rose-600" : "text-emerald-600",
                              )}
                            >
                              {warranty?.label || "-"}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-background/80 border">
                            <span className="text-xs text-muted-foreground block">Service Contract</span>
                            <span className="font-medium text-blue-600">
                              {contract?.hasContract
                                ? `${contract.doneVisits}/${contract.totalVisits} งวดเสร็จสิ้น`
                                : "ไม่มีสัญญา"}
                            </span>
                          </div>
                        </div>

                        {/* Right: QR Code */}
                        <div className="flex flex-col items-center justify-center p-4 bg-background rounded-xl border-2 border-dashed shadow-xs">
                          <QRCodeCanvas
                            id="machine-passport-qr"
                            value={passportUrl}
                            size={160}
                            includeMargin
                            level="H"
                          />
                          <p className="text-[11px] font-mono text-muted-foreground mt-2">
                            SCAN TO VIEW HISTORY
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Passport Action Buttons */}
                    <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={copyPassportLink}
                        className="h-9 gap-1.5 cursor-pointer"
                      >
                        <Copy className="h-4 w-4" /> คัดลอกลิงก์
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={sharePassport}
                        className="h-9 gap-1.5 cursor-pointer"
                      >
                        <Share2 className="h-4 w-4" /> ส่งต่อ / แชร์
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={downloadQrCode}
                        className="h-9 gap-1.5 cursor-pointer"
                      >
                        <Download className="h-4 w-4" /> บันทึกรูป QR
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handlePrintPassport}
                        className="h-9 gap-1.5 cursor-pointer"
                      >
                        <Printer className="h-4 w-4" /> พิมพ์ Digital Passport
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox Image Preview Dialog */}
      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={(v) => !v && setPreviewImage(null)}>
          <DialogContent className="z-[999999] max-w-[90vw] max-h-[90vh] p-2 bg-black/90 border-0 flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={previewImage}
              alt="ภาพขยาย"
              className="max-h-[85vh] max-w-full rounded object-contain"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Linked Service Report (Handover Report Dialog) */}
      {selectedApptForReport && (
        <HandoverReportDialog
          appt={selectedApptForReport}
          onClose={() => setSelectedApptForReport(null)}
        />
      )}

      {/* Contract Dialog if user wants to view or update contract */}
      {contractDialogOpen && unit && (
        <ContractDialog
          open={contractDialogOpen}
          onOpenChange={setContractDialogOpen}
          machineUnitId={unit.id}
          serialNumber={unit.serial_number}
          machineLabel={
            unit.compressor_models
              ? `${unit.compressor_models.brands?.name ?? ""} ${unit.compressor_models.name}`.trim()
              : undefined
          }
          customerId={unit.customers?.id}
          customerName={unit.customers?.name ?? ""}
          onSaved={loadData}
        />
      )}
    </>
  );
}

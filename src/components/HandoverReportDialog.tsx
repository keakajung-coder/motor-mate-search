import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  CheckCircle2,
  Download,
  FileDown,
  FileText,
  Loader2,
  PenTool,
  Printer,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";
import { elementToPdfBlobPaged, formatDate, saveFile } from "@/lib/report";
import { parseAttachments, type JobAttachment } from "@/components/JobAttachments";
import { splitNames } from "@/components/ui/multi-combobox";
import { useDirectory } from "@/lib/directory";
import { ChecklistView } from "@/components/ChecklistView";
import type { ChecklistResult } from "@/lib/checklist";
import { DateInput } from "@/components/ui/date-input";
import { cn } from "@/lib/utils";
import { PNEUMAX_LOGO_SRC } from "@/assets/pneumaxLogo";

export type HandoverMachineData = {
  serial: string;
  label: string;
  customerSn: string;
  selected: boolean;
  jobDetail: string;
  result: "ok" | "not_ok" | "";
  closeNote: string;
  partsReplaced: string;
  recommendations: string;
  summary: string;
  includeChecklist: boolean;
  photos: JobAttachment[];
};

export type HandoverReportState = {
  reportNo: string;
  reportDate: string;
  customerName: string;
  custId: string;
  contactName: string;
  contactPhone: string;
  customerAddress: string;
  visitDate: string;
  visitTime: string;
  staffName: string;
  vehiclePlate: string;
  salesRep: string;
  serviceType: string;
  overallSummary: string;
  machines: HandoverMachineData[];

  // 1. Sales เจ้าของงาน
  salesName: string;
  salesSignature: string | null;
  salesDate: string;

  // 2. Engineer คุมงาน
  engineerName: string;
  engineerSignature: string | null;
  engineerDate: string;

  // 3. Technician ช่างผู้ปฏิบัติงาน
  technicianName: string;
  technicianSignature: string | null;
  technicianDate: string;

  // 4. ผู้รับมอบงาน (ลูกค้า)
  receiverName: string;
  receiverSignature: string | null;
  receiverDate: string;
};

/** โลโก้ PNEUMAX ทางการตามภาพที่ผู้ใช้กำหนด (กระบอกสูบนิวเมติกสีแดง + ตัวอักษร PNEUMAX ตรงกลาง) */
export function PneumaxLogo({ className = "h-16 w-auto" }: { className?: string }) {
  return (
    <img
      src={PNEUMAX_LOGO_SRC}
      alt="PNEUMAX"
      className={cn("object-contain shrink-0 select-none", className)}
      loading="eager"
      decoding="sync"
    />
  );
}

/** ส่วนหัวกระดาษอย่างเป็นทางการของ บริษัท นิวแม็ก จำกัด */
export function PneumaxHeader({ report }: { report: HandoverReportState }) {
  return (
    <header className="handover-header border-b-2 border-slate-800 pb-3 mb-3.5 break-inside-avoid page-break-inside-avoid">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
        {/* ฝั่งซ้าย: โลโก้ PNEUMAX และข้อมูลบริษัท นิวแม็ก จำกัด */}
        <div className="flex items-center gap-3.5 max-w-[65%]">
          <PneumaxLogo className="h-16 w-auto shrink-0" />
          <div className="text-[11px] leading-tight text-slate-700 space-y-0.5">
            <p className="font-extrabold text-slate-900 text-sm tracking-tight">
              บริษัท นิวแม็ก จำกัด <span className="font-semibold text-slate-600 text-xs">(สำนักงานใหญ่)</span>
            </p>
            <p className="font-bold text-slate-800 text-[11px] tracking-wider uppercase">
              PNEUMAX CO., LTD.
            </p>
            <p className="text-slate-600 pt-0.5">
              เลขประจำตัวผู้เสียภาษี: <strong className="text-slate-800">0105524020764</strong>
            </p>
            <p className="text-slate-600">
              107/1 ถนนเฉลิมพระเกียรติ ร.9 แขวงประเวศ เขตประเวศ กรุงเทพฯ 10250
            </p>
            <p className="text-slate-600">
              โทรศัพท์: <strong>02-726-8000</strong> (แผนก Air Compressor ต่อ 640-644, 661) · แฟกซ์: 02-726-8266
            </p>
            <p className="text-slate-600">
              อีเมล: <strong className="text-primary">sales@pneumax.co.th</strong> · เว็บไซต์: <strong>www.pneumax.co.th</strong>
            </p>
          </div>
        </div>

        {/* ฝั่งขวา: ชื่อเอกสารและข้อมูลการส่งมอบ */}
        <div className="text-right text-[11px] space-y-1 sm:min-w-[210px] shrink-0">
          <div className="rounded border border-primary/30 bg-primary/5 px-2.5 py-1 text-right">
            <h1 className="text-base font-extrabold tracking-tight text-slate-900 leading-tight">
              ใบส่งมอบงาน
            </h1>
            <p className="text-[10px] font-bold text-primary tracking-wider uppercase">
              JOB HANDOVER REPORT
            </p>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50/80 px-2 py-1 text-[11px] space-y-0.5 text-left">
            <div className="flex justify-between gap-1">
              <span className="text-slate-500">เลขที่เอกสาร:</span>
              <strong className="font-mono text-slate-900">{report.reportNo}</strong>
            </div>
            <div className="flex justify-between gap-1">
              <span className="text-slate-500">วันที่ส่งมอบ:</span>
              <strong className="text-slate-800">{formatDate(report.reportDate)}</strong>
            </div>
            <div className="flex justify-between gap-1">
              <span className="text-slate-500">ประเภทงาน:</span>
              <span className="truncate font-semibold text-slate-800">{report.serviceType || "งานบริการซ่อมบำรุง"}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/** ลายเซ็นดิจิทัล Canvas */
function SignatureModal({
  title,
  name,
  onSave,
  onClose,
}: {
  title: string;
  name: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasStroke(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stop = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke) {
      toast.error("กรุณาลงลายเซ็นก่อนกดยืนยัน");
      return;
    }
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
    toast.success("บันทึกลายเซ็นเรียบร้อย");
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <PenTool className="h-4 w-4 text-primary" />
            {title} {name ? `(${name})` : ""}
          </DialogTitle>
          <DialogDescription>
            ใช้ปลายนิ้ว ปากกาสไตลัส หรือเมาส์เพื่อลงลายเซ็นในกรอบด้านล่าง
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative touch-none rounded-xl border-2 border-dashed border-primary/30 bg-slate-50/50 dark:bg-slate-900/50">
            <canvas
              ref={canvasRef}
              width={400}
              height={180}
              className="h-[180px] w-full cursor-crosshair"
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={stop}
              onPointerCancel={stop}
            />
            {!hasStroke && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                ลงลายมือชื่อที่นี่
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={clear}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> ล้างลายเซ็น
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                ยกเลิก
              </Button>
              <Button type="button" size="sm" onClick={save} disabled={!hasStroke}>
                ตกลง
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** หน้าต่างจัดทำและดูตัวอย่างใบส่งมอบงาน (Job Handover Report) */
export function HandoverReportDialog({
  appt,
  onClose,
  initialAttachments,
}: {
  appt: {
    id: string;
    customer_name?: string | null;
    cust_id?: string | null;
    customer_address?: string | null;
    contact_name?: string | null;
    contact_phone?: string | null;
    machine_label?: string | null;
    serial_number?: string | null;
    customer_sn?: string | null;
    job_detail?: string | null;
    service_type?: string | null;
    visit_date?: string | null;
    visit_time?: string | null;
    staff_name?: string | null;
    vehicle_plate?: string | null;
    sales_rep?: string | null;
    job_no?: string | null;
    result?: string | null;
    close_note?: string | null;
    parts_replaced?: string | null;
    quotation_items?: string | null;
    checklist?: any;
    attachments?: string | null;
  };
  onClose: () => void;
  initialAttachments?: JobAttachment[];
}) {
  const dir = useDirectory();
  const printRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState<"" | "pdf" | "image" | "print">("");
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("preview");
  const [signingWho, setSigningWho] = useState<"sales" | "engineer" | "technician" | "receiver" | null>(null);

  // ดึงรูปที่แนบไว้ในใบงาน
  const baseAttachments = useMemo(() => {
    if (initialAttachments && initialAttachments.length) return initialAttachments;
    return parseAttachments(appt.attachments);
  }, [appt.attachments, initialAttachments]);

  // สร้างเลขที่ใบส่งมอบงานอัตโนมัติ เช่น HVR-261015-1030
  const autoReportNo = useMemo(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const dStr = `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}`;
    const tStr = `${p(d.getHours())}${p(d.getMinutes())}`;
    return `HVR-${dStr}-${tStr}`;
  }, []);

  // ค้นหาเครื่องทั้งหมดที่ผูกกับลูกค้ารายนี้จาก Directory
  const customerMachines = useMemo(() => {
    const targetCustomer = (appt.customer_name ?? "").trim().toLowerCase();
    const targetCustId = (appt.cust_id ?? "").trim().toLowerCase();
    const list = dir.machines.filter((m) => {
      const matchName = targetCustomer && m.customer.trim().toLowerCase() === targetCustomer;
      const matchId = targetCustId && m.cust_id.trim().toLowerCase() === targetCustId;
      return matchName || matchId;
    });

    // ตรวจสอบเครื่องที่ระบุในใบงานนี้ หากยังไม่อยู่ในลิสต์ให้เพิ่มเข้ามา
    const apptSerials = splitNames(appt.serial_number ?? "");
    apptSerials.forEach((sn) => {
      if (!list.some((m) => m.serial.trim().toLowerCase() === sn.trim().toLowerCase())) {
        list.unshift({
          serial: sn,
          label: appt.machine_label ?? "เครื่องอัดอากาศ",
          customer_sn: appt.customer_sn ?? "",
          customer: appt.customer_name ?? "",
          cust_id: appt.cust_id ?? "",
          address: appt.customer_address ?? "",
          phone: appt.contact_phone ?? "",
          seller: appt.sales_rep ?? "",
          brand: "",
          model: "",
        });
      }
    });

    return list;
  }, [dir.machines, appt.customer_name, appt.cust_id, appt.serial_number, appt.machine_label, appt.customer_sn, appt.customer_address, appt.contact_phone, appt.sales_rep]);

  // ฟอร์มข้อมูลใบส่งมอบงาน
  const [report, setReport] = useState<HandoverReportState>(() => {
    const apptSerials = splitNames(appt.serial_number ?? "");
    const initialMachines: HandoverMachineData[] = customerMachines.map((m) => {
      const isCurrentAppt = apptSerials.length === 0 || apptSerials.includes(m.serial);
      return {
        serial: m.serial,
        label: m.label || "เครื่องอัดอากาศ",
        customerSn: m.customer_sn || "",
        selected: isCurrentAppt,
        jobDetail: isCurrentAppt ? (appt.job_detail ?? "") : "",
        result: isCurrentAppt ? ((appt.result as "ok" | "not_ok") || "ok") : "ok",
        closeNote: isCurrentAppt ? (appt.close_note ?? "") : "",
        partsReplaced: isCurrentAppt ? (appt.parts_replaced ?? "") : "",
        recommendations: isCurrentAppt ? (appt.quotation_items ?? "") : "",
        summary: isCurrentAppt
          ? [appt.result === "ok" ? "เครื่องทำงานปกติ ทดสอบระบบเรียบร้อย" : "", appt.close_note].filter(Boolean).join(" ")
          : "เครื่องทำงานปกติ ทดสอบระบบเรียบร้อย",
        includeChecklist: isCurrentAppt && !!appt.checklist,
        photos: isCurrentAppt ? baseAttachments : [],
      };
    });

    if (initialMachines.length === 0) {
      initialMachines.push({
        serial: appt.serial_number || "ไม่ระบุ S/N",
        label: appt.machine_label || "เครื่องอัดอากาศ",
        customerSn: appt.customer_sn || "",
        selected: true,
        jobDetail: appt.job_detail ?? "",
        result: (appt.result as "ok" | "not_ok") || "ok",
        closeNote: appt.close_note ?? "",
        partsReplaced: appt.parts_replaced ?? "",
        recommendations: appt.quotation_items ?? "",
        summary: [appt.result === "ok" ? "เครื่องทำงานปกติ ทดสอบระบบเรียบร้อย" : "", appt.close_note].filter(Boolean).join(" "),
        includeChecklist: !!appt.checklist,
        photos: baseAttachments,
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    return {
      reportNo: appt.job_no ? `HVR-${appt.job_no}` : autoReportNo,
      reportDate: todayStr,
      customerName: appt.customer_name ?? "",
      custId: appt.cust_id ?? "",
      contactName: appt.contact_name ?? "",
      contactPhone: appt.contact_phone ?? "",
      customerAddress: appt.customer_address ?? "",
      visitDate: appt.visit_date ?? todayStr,
      visitTime: appt.visit_time ?? "09:00",
      staffName: appt.staff_name ?? "",
      vehiclePlate: appt.vehicle_plate ?? "",
      salesRep: appt.sales_rep ?? "",
      serviceType: appt.service_type ?? "บริการตรวจเช็กซ่อมบำรุง",
      overallSummary:
        appt.close_note ||
        "ทีมช่างได้เข้าปฏิบัติงานตรวจเช็กและซ่อมบำรุงตามรายการข้างต้นเรียบร้อยแล้ว เครื่องจักรพร้อมใช้งานตามปกติ",
      machines: initialMachines,

      // 1. Sales
      salesName: appt.sales_rep ?? "",
      salesSignature: null,
      salesDate: todayStr,

      // 2. Engineer
      engineerName: "",
      engineerSignature: null,
      engineerDate: todayStr,

      // 3. Technician
      technicianName: appt.staff_name ?? "",
      technicianSignature: null,
      technicianDate: todayStr,

      // 4. Receiver
      receiverName: appt.contact_name ?? "",
      receiverSignature: null,
      receiverDate: todayStr,
    };
  });

  const updateMachine = (idx: number, patch: Partial<HandoverMachineData>) => {
    setReport((prev) => {
      const nextMachines = [...prev.machines];
      nextMachines[idx] = { ...nextMachines[idx], ...patch };
      return { ...prev, machines: nextMachines };
    });
  };

  const selectedMachines = useMemo(
    () => report.machines.filter((m) => m.selected),
    [report.machines],
  );

  // ส่งออก PDF โดยคำนึงถึง 1 หน้า vs หลายหน้า
  const handleExportPdf = async () => {
    const el = printRef.current;
    if (!el) return;
    setExporting("pdf");
    try {
      const filename = `${report.reportNo}_${report.customerName || "ใบส่งมอบงาน"}.pdf`;
      const isSingleMachine = selectedMachines.length === 1;
      const blob = await elementToPdfBlobPaged(el, isSingleMachine ? 1 : 0, {
        orientation: "portrait",
        pageBreakSelector: ".handover-break-candidate, .handover-machine-card, .handover-summary, .handover-signatures",
      });
      await saveFile(blob, filename);
      toast.success("ดาวน์โหลด PDF ใบส่งมอบงานเรียบร้อย");
    } catch (e) {
      toast.error("ส่งออก PDF ไม่สำเร็จ: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExporting("");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-none overflow-y-auto p-4 sm:w-[calc(100vw-2rem)] lg:max-w-5xl">
        <DialogHeader className="border-b pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <FileText className="h-5 w-5 text-primary" />
                ใบส่งมอบงานและรายงานผลบริการ (Job Handover Report)
              </DialogTitle>
              <DialogDescription className="text-xs">
                จัดกลุ่มรายงานแยกตามหมายเลขเครื่อง (S/N) พร้อมข้อมูล บริษัท นิวแม็ก จำกัด และระบบลงนาม 4 บทบาท
              </DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    activeTab === "preview"
                      ? "bg-background shadow-xs text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ตัวอย่างเอกสาร
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("edit")}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    activeTab === "edit"
                      ? "bg-background shadow-xs text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  แก้ไขข้อมูล / เลือกลงนาม ({selectedMachines.length})
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={handlePrint}
              >
                <Printer className="h-3.5 w-3.5" /> พิมพ์
              </Button>
              <Button
                size="sm"
                className="gap-1 text-xs"
                onClick={handleExportPdf}
                disabled={exporting !== ""}
              >
                {exporting === "pdf" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileDown className="h-3.5 w-3.5" />
                )}
                ดาวน์โหลด PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Tab 1: แก้ไขข้อมูลและเลือกลงนาม */}
        {activeTab === "edit" && (
          <div className="space-y-5 py-2">
            {/* กล่องเลือกเครื่องจักรที่จะรวมในรายงาน */}
            <div className="rounded-xl border bg-card p-4 shadow-2xs">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    1. เลือกเครื่องที่จะรวมในใบส่งมอบงานนี้ (รวมได้หลายเครื่อง)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    ดึงประวัติเครื่องจักรของลูกค้า "{report.customerName}" อัตโนมัติ ติ๊กเลือกเครื่องที่ต้องการออกรายงาน
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  เลือก {selectedMachines.length} จาก {report.machines.length} เครื่อง
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {report.machines.map((m, idx) => (
                  <label
                    key={m.serial + idx}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      m.selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border bg-muted/20 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={m.selected}
                      onChange={(e) => updateMachine(idx, { selected: e.target.checked })}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="font-semibold text-foreground">
                        S/N: {m.serial}
                        {m.customerSn && (
                          <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                            (S/N ลูกค้า: {m.customerSn})
                          </span>
                        )}
                      </p>
                      <p className="truncate text-muted-foreground">{m.label || "เครื่องอัดอากาศ"}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* กล่องแก้ไขรายละเอียดข้อมูลทั่วไป */}
            <div className="rounded-xl border bg-card p-4 shadow-2xs">
              <h3 className="mb-3 text-sm font-bold text-foreground">
                2. ข้อมูลทั่วไปของงานและลูกค้า
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label className="text-xs">เลขที่ใบส่งมอบ</Label>
                  <Input
                    value={report.reportNo}
                    onChange={(e) => setReport({ ...report, reportNo: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">วันที่ส่งมอบงาน</Label>
                  <DateInput
                    value={report.reportDate}
                    onChange={(v) => setReport({ ...report, reportDate: v })}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">ชื่อลูกค้า</Label>
                  <Input
                    value={report.customerName}
                    onChange={(e) => setReport({ ...report, customerName: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">ผู้ติดต่อ / เบอร์โทร</Label>
                  <Input
                    value={[report.contactName, report.contactPhone].filter(Boolean).join(" · ")}
                    onChange={(e) => {
                      const [name, phone] = e.target.value.split("·").map((s) => s.trim());
                      setReport({ ...report, contactName: name || "", contactPhone: phone || "" });
                    }}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">สถานที่ปฏิบัติงาน / ที่อยู่</Label>
                  <Input
                    value={report.customerAddress}
                    onChange={(e) => setReport({ ...report, customerAddress: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">ช่างผู้ปฏิบัติงาน</Label>
                  <Input
                    value={report.staffName}
                    onChange={(e) => setReport({ ...report, staffName: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">พนักงานขาย (เซลล์)</Label>
                  <Input
                    value={report.salesRep}
                    onChange={(e) => setReport({ ...report, salesRep: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* กล่องแก้ไขรายละเอียดทีละเครื่อง (1 หัวข้อต่อ 1 S/N) */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground">
                3. รายละเอียดงานแยกตามเครื่อง (S/N)
              </h3>
              {selectedMachines.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                  ยังไม่ได้เลือกเครื่องจักร กรุณาติ๊กเลือกเครื่องอย่างน้อย 1 เครื่องด้านบน
                </div>
              ) : (
                report.machines.map((m, idx) => {
                  if (!m.selected) return null;
                  return (
                    <div
                      key={m.serial + idx}
                      className="rounded-xl border border-primary/20 bg-card p-4 shadow-2xs space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="text-xs">
                            เครื่องที่ {idx + 1}
                          </Badge>
                          <span className="font-bold text-sm text-foreground">
                            S/N: {m.serial}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({m.label})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>แนบ Checklist:</span>
                            <Switch
                              checked={m.includeChecklist}
                              onCheckedChange={(c) => updateMachine(idx, { includeChecklist: c })}
                            />
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => updateMachine(idx, { selected: false })}
                          >
                            <X className="h-3.5 w-3.5" /> ตัดออกจากใบนี้
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs font-semibold">งานที่ไปทำ (Job Detail)</Label>
                          <Textarea
                            rows={2}
                            value={m.jobDetail}
                            onChange={(e) => updateMachine(idx, { jobDetail: e.target.value })}
                            placeholder="ระบุรายละเอียดงานที่เข้าไปทำ..."
                            className="text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold">ผลงานที่ทำเสร็จ (Result Status)</Label>
                          <div className="flex items-center gap-2 mb-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant={m.result === "ok" ? "default" : "outline"}
                              className={`h-7 px-2 text-xs ${m.result === "ok" ? "bg-emerald-600 hover:bg-emerald-600/90" : ""}`}
                              onClick={() => updateMachine(idx, { result: "ok" })}
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" /> เรียบร้อย
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={m.result === "not_ok" ? "destructive" : "outline"}
                              className="h-7 px-2 text-xs"
                              onClick={() => updateMachine(idx, { result: "not_ok" })}
                            >
                              <XCircle className="mr-1 h-3 w-3" /> ต้องติดตามต่อ
                            </Button>
                          </div>
                          <Input
                            value={m.closeNote}
                            onChange={(e) => updateMachine(idx, { closeNote: e.target.value })}
                            placeholder="หมายเหตุผลงาน เช่น เดินเครื่องปกติ แรงดันคงที่"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold">อะไหล่ที่เปลี่ยนในงานนี้</Label>
                          <Input
                            value={m.partsReplaced}
                            onChange={(e) => updateMachine(idx, { partsReplaced: e.target.value })}
                            placeholder="เช่น กรองอากาศ, กรองน้ำมัน, น้ำมันคอมเพรสเซอร์"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold">รายการแนะนำ / ข้อเสนอแนะเพิ่มเติม</Label>
                          <Input
                            value={m.recommendations}
                            onChange={(e) => updateMachine(idx, { recommendations: e.target.value })}
                            placeholder="เช่น ควรตรวจเช็กสายพานในอีก 500 ชม. หรือเสนอราคา Air Filter"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-xs font-semibold">
                            ข้อความสรุปงานเครื่องนี้ (Editable Text Area)
                          </Label>
                          <Textarea
                            rows={2}
                            value={m.summary}
                            onChange={(e) => updateMachine(idx, { summary: e.target.value })}
                            placeholder="พิมพ์ข้อความสรุปงานหรือคำแนะนำสำหรับเครื่องนี้เพิ่มเติม..."
                            className="text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ส่วนลงลายมือชื่อ 4 บทบาท */}
            <div className="rounded-xl border bg-card p-4 shadow-2xs">
              <h3 className="mb-1 text-sm font-bold text-foreground">
                4. ลายมือชื่อผู้ส่งมอบงาน (3 บทบาท) และผู้รับมอบงาน (ลูกค้า)
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                รองรับการพิมพ์ชื่อ วันที่ และเซ็นชื่อดิจิทัลผ่านหน้าจอครบทั้ง 4 ตำแหน่ง
              </p>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                {/* 1. Sales */}
                <div className="rounded-lg border p-3 space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
                  <Badge variant="outline" className="text-[10px] bg-background">
                    ฝั่งผู้ส่งมอบ · 1
                  </Badge>
                  <p className="text-xs font-bold text-foreground">Sales เจ้าของงาน</p>
                  <div>
                    <Label className="text-[10px]">ชื่อพนักงานขาย</Label>
                    <Input
                      value={report.salesName}
                      onChange={(e) => setReport({ ...report, salesName: e.target.value })}
                      className="h-7 text-xs"
                      placeholder="ชื่อ-นามสกุล เซลล์"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">วันที่ลงนาม</Label>
                    <DateInput
                      value={report.salesDate}
                      onChange={(v) => setReport({ ...report, salesDate: v })}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="pt-1">
                    {report.salesSignature ? (
                      <div className="flex items-center gap-1.5">
                        <img
                          src={report.salesSignature}
                          alt="ลายเซ็น Sales"
                          className="h-8 border rounded bg-white px-1.5 py-0.5 object-contain"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-destructive px-1.5"
                          onClick={() => setReport({ ...report, salesSignature: null })}
                        >
                          ลบ
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 w-full text-[11px] gap-1"
                        onClick={() => setSigningWho("sales")}
                      >
                        <PenTool className="h-3 w-3" /> เซ็นดิจิทัล
                      </Button>
                    )}
                  </div>
                </div>

                {/* 2. Engineer */}
                <div className="rounded-lg border p-3 space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
                  <Badge variant="outline" className="text-[10px] bg-background">
                    ฝั่งผู้ส่งมอบ · 2
                  </Badge>
                  <p className="text-xs font-bold text-foreground">Engineer คุมงาน</p>
                  <div>
                    <Label className="text-[10px]">ชื่อวิศวกรคุมงาน</Label>
                    <Input
                      value={report.engineerName}
                      onChange={(e) => setReport({ ...report, engineerName: e.target.value })}
                      className="h-7 text-xs"
                      placeholder="ชื่อ-นามสกุล วิศวกร"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">วันที่ลงนาม</Label>
                    <DateInput
                      value={report.engineerDate}
                      onChange={(v) => setReport({ ...report, engineerDate: v })}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="pt-1">
                    {report.engineerSignature ? (
                      <div className="flex items-center gap-1.5">
                        <img
                          src={report.engineerSignature}
                          alt="ลายเซ็น Engineer"
                          className="h-8 border rounded bg-white px-1.5 py-0.5 object-contain"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-destructive px-1.5"
                          onClick={() => setReport({ ...report, engineerSignature: null })}
                        >
                          ลบ
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 w-full text-[11px] gap-1"
                        onClick={() => setSigningWho("engineer")}
                      >
                        <PenTool className="h-3 w-3" /> เซ็นดิจิทัล
                      </Button>
                    )}
                  </div>
                </div>

                {/* 3. Technician */}
                <div className="rounded-lg border p-3 space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
                  <Badge variant="outline" className="text-[10px] bg-background">
                    ฝั่งผู้ส่งมอบ · 3
                  </Badge>
                  <p className="text-xs font-bold text-foreground">Technician (ช่างผู้ปฏิบัติงาน)</p>
                  <div>
                    <Label className="text-[10px]">ชื่อช่างบริการ</Label>
                    <Input
                      value={report.technicianName}
                      onChange={(e) => setReport({ ...report, technicianName: e.target.value })}
                      className="h-7 text-xs"
                      placeholder="ชื่อ-นามสกุล ช่าง"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">วันที่ลงนาม</Label>
                    <DateInput
                      value={report.technicianDate}
                      onChange={(v) => setReport({ ...report, technicianDate: v })}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="pt-1">
                    {report.technicianSignature ? (
                      <div className="flex items-center gap-1.5">
                        <img
                          src={report.technicianSignature}
                          alt="ลายเซ็น ช่าง"
                          className="h-8 border rounded bg-white px-1.5 py-0.5 object-contain"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-destructive px-1.5"
                          onClick={() => setReport({ ...report, technicianSignature: null })}
                        >
                          ลบ
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 w-full text-[11px] gap-1"
                        onClick={() => setSigningWho("technician")}
                      >
                        <PenTool className="h-3 w-3" /> เซ็นดิจิทัล
                      </Button>
                    )}
                  </div>
                </div>

                {/* 4. Customer Receiver */}
                <div className="rounded-lg border border-primary/30 p-3 space-y-2 bg-primary/5">
                  <Badge className="text-[10px]">ฝั่งลูกค้า</Badge>
                  <p className="text-xs font-bold text-foreground">ผู้รับมอบงาน (ลูกค้า)</p>
                  <div>
                    <Label className="text-[10px]">ชื่อตัวแทนลูกค้า</Label>
                    <Input
                      value={report.receiverName}
                      onChange={(e) => setReport({ ...report, receiverName: e.target.value })}
                      className="h-7 text-xs"
                      placeholder="ชื่อ-นามสกุล ลูกค้า"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">วันที่ลงนาม</Label>
                    <DateInput
                      value={report.receiverDate}
                      onChange={(v) => setReport({ ...report, receiverDate: v })}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="pt-1">
                    {report.receiverSignature ? (
                      <div className="flex items-center gap-1.5">
                        <img
                          src={report.receiverSignature}
                          alt="ลายเซ็น ผู้รับมอบงาน"
                          className="h-8 border rounded bg-white px-1.5 py-0.5 object-contain"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-destructive px-1.5"
                          onClick={() => setReport({ ...report, receiverSignature: null })}
                        >
                          ลบ
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 w-full text-[11px] gap-1"
                        onClick={() => setSigningWho("receiver")}
                      >
                        <PenTool className="h-3 w-3" /> เซ็นดิจิทัล
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: ตัวอย่างเอกสารจริง พร้อมพิมพ์ / Export PDF */}
        {activeTab === "preview" && (
          <div className="overflow-x-auto py-2">
            <div className="mx-auto w-[210mm] min-h-[297mm] shadow-lg rounded-sm border border-slate-200 bg-white text-slate-900">
              <div ref={printRef}>
                <HandoverReportPrintView
                  report={report}
                  checklist={appt.checklist as ChecklistResult | null}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="border-t pt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {selectedMachines.length === 0
              ? "⚠️ ยังไม่ได้เลือกเครื่องจักร"
              : `พร้อมส่งออกใบส่งมอบงาน (${selectedMachines.length} เครื่อง)`}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              ปิด
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleExportPdf} disabled={exporting !== ""}>
              {exporting === "pdf" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              ดาวน์โหลด PDF
            </Button>
          </div>
        </DialogFooter>

        {/* Modal ลงลายเซ็น */}
        {signingWho && (
          <SignatureModal
            title={
              signingWho === "sales"
                ? "ลงลายมือชื่อพนักงานขายเจ้าของงาน (Sales)"
                : signingWho === "engineer"
                ? "ลงลายมือชื่อวิศวกรผู้ควบคุมงาน (Engineer)"
                : signingWho === "technician"
                ? "ลงลายมือชื่อช่างผู้ปฏิบัติงาน (Technician)"
                : "ลงลายมือชื่อผู้รับมอบงาน (ลูกค้า)"
            }
            name={
              signingWho === "sales"
                ? report.salesName
                : signingWho === "engineer"
                ? report.engineerName
                : signingWho === "technician"
                ? report.technicianName
                : report.receiverName
            }
            onSave={(dataUrl) => {
              if (signingWho === "sales") {
                setReport((prev) => ({ ...prev, salesSignature: dataUrl }));
              } else if (signingWho === "engineer") {
                setReport((prev) => ({ ...prev, engineerSignature: dataUrl }));
              } else if (signingWho === "technician") {
                setReport((prev) => ({ ...prev, technicianSignature: dataUrl }));
              } else {
                setReport((prev) => ({ ...prev, receiverSignature: dataUrl }));
              }
            }}
            onClose={() => setSigningWho(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** ส่วนแสดงผลเอกสารพิมพ์ A4 ใบส่งมอบงานและรายงานผลบริการ */
export function HandoverReportPrintView({
  report,
  checklist,
}: {
  report: HandoverReportState;
  checklist?: ChecklistResult | null;
}) {
  const selectedMachines = report.machines.filter((m) => m.selected);
  const isSinglePage = selectedMachines.length === 1;

  return (
    <article
      className={`handover-report-export ${
        isSinglePage ? "handover-report-export--single p-6 text-[12px]" : "p-8 text-[12.5px]"
      } text-slate-900 font-sans leading-relaxed bg-white`}
    >
      <div>
        {/* 1. ส่วนหัวกระดาษ PNEUMAX และข้อมูลบริษัท นิวแม็ก จำกัด */}
        <PneumaxHeader report={report} />

        {/* 2. Customer & Service Info Box */}
        <section className="handover-customer-box mb-3.5 rounded-lg border border-slate-300 bg-slate-50/70 p-3 text-[11px] break-inside-avoid page-break-inside-avoid">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            <div>
              <span className="text-slate-500 font-medium">ชื่อลูกค้า / บริษัท:</span>{" "}
              <strong className="text-slate-900 font-bold">
                {report.custId ? `[${report.custId}] ` : ""}
                {report.customerName || "-"}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 font-medium">วันที่เข้าปฏิบัติงาน:</span>{" "}
              <strong className="text-slate-900">
                {formatDate(report.visitDate)} {report.visitTime?.slice(0, 5) ?? ""}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 font-medium">ผู้ติดต่อ:</span>{" "}
              <strong className="text-slate-900">
                {[report.contactName, report.contactPhone].filter(Boolean).join(" · ") || "-"}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 font-medium">ทีมบริการ:</span>{" "}
              <strong className="text-slate-900">
                {[report.technicianName || report.staffName, report.vehiclePlate ? `รถ ${report.vehiclePlate}` : ""].filter(Boolean).join(" · ") || "-"}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 font-medium">พนักงานขาย (Sales):</span>{" "}
              <strong className="text-slate-900">{report.salesName || report.salesRep || "-"}</strong>
            </div>
            <div>
              <span className="text-slate-500 font-medium">วิศวกรผู้คุมงาน:</span>{" "}
              <strong className="text-slate-900">{report.engineerName || "-"}</strong>
            </div>
            <div className="col-span-2">
              <span className="text-slate-500 font-medium">สถานที่ปฏิบัติงาน / ที่อยู่:</span>{" "}
              <span className="text-slate-800">{report.customerAddress || "-"}</span>
            </div>
          </div>
        </section>

        {/* 3. Section ทีละเครื่อง (1 หัวข้อต่อ 1 S/N) */}
        <div className={isSinglePage ? "space-y-3" : "space-y-5"}>
          {selectedMachines.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-6 border rounded">
              ไม่มีเครื่องจักรที่เลือกในรายงานนี้
            </p>
          ) : (
            selectedMachines.map((m, idx) => (
              <section
                key={m.serial + idx}
                className="handover-machine-card handover-break-candidate rounded-lg border border-slate-300 p-3.5 space-y-2.5 break-inside-avoid page-break-inside-avoid bg-white"
              >
                {/* Header เครื่องจักร */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-1.5 bg-slate-100 -mx-3.5 -mt-3.5 px-3.5 py-2 rounded-t-lg">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-900 text-white px-2 py-0.5 text-[10px] font-bold">
                      เครื่องที่ {idx + 1}
                    </span>
                    <span className="font-bold text-xs text-slate-900 font-mono">
                      S/N: {m.serial}
                    </span>
                    {m.customerSn && (
                      <span className="text-[11px] font-medium text-slate-600">
                        (รหัสลูกค้า: {m.customerSn})
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-700">
                    รุ่น/รายละเอียด: {m.label || "-"}
                  </div>
                </div>

                {/* งานที่ทำ & ผลการดำเนินงาน */}
                <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                  <div className="rounded border border-slate-200 bg-slate-50/50 p-2">
                    <p className="font-bold text-slate-700 mb-0.5">งานที่เข้าไปปฏิบัติ (Job Detail)</p>
                    <p className="whitespace-pre-wrap text-slate-800">{m.jobDetail || "-"}</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-slate-50/50 p-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="font-bold text-slate-700">ผลงานที่ทำเสร็จ (Result Status)</p>
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          m.result === "ok"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {m.result === "ok" ? "✓ เรียบร้อย (Normal)" : "⚠️ ต้องติดตามต่อ"}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-slate-800">{m.closeNote || "ตรวจเช็กและทดสอบการทำงานเรียบร้อย"}</p>
                  </div>
                </div>

                {/* อะไหล่ที่เปลี่ยน & รายการแนะนำ */}
                {(m.partsReplaced || m.recommendations) && (
                  <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                    {m.partsReplaced ? (
                      <div className="rounded border border-slate-200 p-2">
                        <p className="font-bold text-slate-700 mb-0.5">🔧 อะไหล่ที่เปลี่ยนในงานนี้</p>
                        <p className="text-slate-800">{m.partsReplaced}</p>
                      </div>
                    ) : (
                      <div />
                    )}
                    {m.recommendations && (
                      <div className="rounded border border-amber-200 bg-amber-50/40 p-2">
                        <p className="font-bold text-amber-900 mb-0.5">💡 รายการแนะนำ / ข้อเสนอแนะเพิ่มเติม</p>
                        <p className="text-amber-800">{m.recommendations}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* รูปภาพประกอบผลงาน (แนบรูปปิดงาน) */}
                {m.photos && m.photos.length > 0 && (
                  <div>
                    <p className="font-bold text-[11px] text-slate-700 mb-1.5">
                      📷 รูปภาพประกอบผลงานการปฏิบัติงาน (Attached Photos)
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {m.photos.map((p, pIdx) => (
                        <div
                          key={p.path + pIdx}
                          className="rounded border border-slate-200 overflow-hidden bg-slate-50 text-center"
                        >
                          <img
                            src={p.url}
                            alt={p.name}
                            crossOrigin="anonymous"
                            className={`${isSinglePage ? "h-20" : "h-24"} w-full object-cover`}
                          />
                          <p className="text-[9px] text-slate-600 truncate px-1 py-0.5">
                            {p.name || `ภาพที่ ${pIdx + 1}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* เช็คลิสต์ตรวจสอบ (ถ้ามีติ๊กให้แสดง) */}
                {m.includeChecklist && checklist && (
                  <div className="rounded border border-slate-200 p-2 bg-slate-50/40">
                    <p className="font-bold text-[11px] text-slate-700 mb-1">
                      📋 ผลการตรวจสอบ Checklist ประจำเครื่อง
                    </p>
                    <ChecklistView value={checklist} />
                  </div>
                )}

                {/* ช่องข้อความสรุปงาน */}
                {m.summary && (
                  <div className="rounded border border-slate-200 bg-slate-50 p-2 text-[11px]">
                    <p className="font-bold text-slate-700 mb-0.5">ข้อความสรุปงาน / ความคิดเห็นช่าง</p>
                    <p className="whitespace-pre-wrap text-slate-800">{m.summary}</p>
                  </div>
                )}
              </section>
            ))
          )}
        </div>

        {/* 4. สรุปภาพรวมและข้อเสนอแนะรวม */}
        {report.overallSummary && (
          <section className="handover-summary handover-break-candidate mt-3 rounded-lg border border-slate-300 bg-slate-50/50 p-2.5 text-[11px] break-inside-avoid page-break-inside-avoid">
            <p className="font-bold text-slate-800 mb-0.5">สรุปภาพรวมการส่งมอบงาน (Summary)</p>
            <p className="whitespace-pre-wrap text-slate-700">{report.overallSummary}</p>
          </section>
        )}
      </div>

      {/* 5. ส่วนลงนามลายเซ็นผู้ส่งมอบ (3 บทบาท) และผู้รับมอบงาน (ลูกค้า) */}
      <footer className="handover-signatures handover-break-candidate mt-4 pt-3 border-t-2 border-slate-800 break-inside-avoid page-break-inside-avoid">
        <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-2">
          การลงนามส่งมอบและรับมอบงาน (Signatures &amp; Acceptance)
        </p>
        <div className="grid grid-cols-4 gap-2 text-center text-[10.5px]">
          {/* 1. Sales */}
          <div className="handover-sig-card flex flex-col justify-between rounded border border-slate-300 bg-slate-50/50 p-2 min-h-[120px]">
            <div>
              <p className="font-bold text-slate-800 leading-tight">พนักงานขายเจ้าของงาน</p>
              <p className="text-[9px] text-slate-500 font-normal">(Sales Representative)</p>
            </div>
            <div className="h-11 flex items-center justify-center w-full">
              {report.salesSignature ? (
                <img
                  src={report.salesSignature}
                  alt="ลายเซ็น Sales"
                  crossOrigin="anonymous"
                  className="h-9 max-w-[100px] object-contain"
                />
              ) : (
                <div className="w-24 border-b border-dotted border-slate-400 mt-4" />
              )}
            </div>
            <div className="text-slate-700 text-[9.5px] space-y-0.5">
              <p className="truncate">({report.salesName || "____________________"})</p>
              <p className="text-[8.5px] text-slate-500">วันที่: {formatDate(report.salesDate)}</p>
            </div>
          </div>

          {/* 2. Engineer */}
          <div className="handover-sig-card flex flex-col justify-between rounded border border-slate-300 bg-slate-50/50 p-2 min-h-[120px]">
            <div>
              <p className="font-bold text-slate-800 leading-tight">วิศวกรผู้ควบคุมงาน</p>
              <p className="text-[9px] text-slate-500 font-normal">(Service Engineer)</p>
            </div>
            <div className="h-11 flex items-center justify-center w-full">
              {report.engineerSignature ? (
                <img
                  src={report.engineerSignature}
                  alt="ลายเซ็น Engineer"
                  crossOrigin="anonymous"
                  className="h-9 max-w-[100px] object-contain"
                />
              ) : (
                <div className="w-24 border-b border-dotted border-slate-400 mt-4" />
              )}
            </div>
            <div className="text-slate-700 text-[9.5px] space-y-0.5">
              <p className="truncate">({report.engineerName || "____________________"})</p>
              <p className="text-[8.5px] text-slate-500">วันที่: {formatDate(report.engineerDate)}</p>
            </div>
          </div>

          {/* 3. Technician */}
          <div className="handover-sig-card flex flex-col justify-between rounded border border-slate-300 bg-slate-50/50 p-2 min-h-[120px]">
            <div>
              <p className="font-bold text-slate-800 leading-tight">ช่างผู้ปฏิบัติงาน</p>
              <p className="text-[9px] text-slate-500 font-normal">(Technician)</p>
            </div>
            <div className="h-11 flex items-center justify-center w-full">
              {report.technicianSignature ? (
                <img
                  src={report.technicianSignature}
                  alt="ลายเซ็น Technician"
                  crossOrigin="anonymous"
                  className="h-9 max-w-[100px] object-contain"
                />
              ) : (
                <div className="w-24 border-b border-dotted border-slate-400 mt-4" />
              )}
            </div>
            <div className="text-slate-700 text-[9.5px] space-y-0.5">
              <p className="truncate">({report.technicianName || "____________________"})</p>
              <p className="text-[8.5px] text-slate-500">วันที่: {formatDate(report.technicianDate)}</p>
            </div>
          </div>

          {/* 4. Customer Receiver */}
          <div className="handover-sig-card flex flex-col justify-between rounded border border-primary/40 bg-primary/5 p-2 min-h-[120px]">
            <div>
              <p className="font-bold text-slate-900 leading-tight">ผู้รับมอบงาน (ลูกค้า)</p>
              <p className="text-[9px] text-slate-500 font-normal">(Customer Acceptance)</p>
            </div>
            <div className="h-11 flex items-center justify-center w-full">
              {report.receiverSignature ? (
                <img
                  src={report.receiverSignature}
                  alt="ลายเซ็น ผู้รับมอบงาน"
                  crossOrigin="anonymous"
                  className="h-9 max-w-[100px] object-contain"
                />
              ) : (
                <div className="w-24 border-b border-dotted border-slate-400 mt-4" />
              )}
            </div>
            <div className="text-slate-700 text-[9.5px] space-y-0.5">
              <p className="truncate">({report.receiverName || "____________________"})</p>
              <p className="text-[8.5px] text-slate-500">วันที่: {formatDate(report.receiverDate)}</p>
            </div>
          </div>
        </div>
      </footer>
    </article>
  );
}

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
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Loader2,
  PenTool,
  Printer,
  RotateCcw,
  Share2,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { elementToPdfBlobPaged, formatDate, saveFile, shareOrDownload } from "@/lib/report";
import { parseAttachments, serializeAttachments, type JobAttachment } from "@/components/JobAttachments";
import { splitNames, joinNames } from "@/components/ui/multi-combobox";
import { useDirectory } from "@/lib/directory";
import { ChecklistView } from "@/components/ChecklistView";
import type { ChecklistResult } from "@/lib/checklist";
import { DateInput } from "@/components/ui/date-input";

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
  delivererName: string;
  delivererSignature: string | null;
  delivererDate: string;
  receiverName: string;
  receiverSignature: string | null;
  receiverDate: string;
};

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
            ใช้ปลายนิ้ว ปากกา หรือเมาส์เพื่อลงลายเซ็นในกรอบด้านล่าง
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
  const [signingWho, setSigningWho] = useState<"deliverer" | "receiver" | null>(null);

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

    // หากไม่มีเครื่องใน Directory เลย ให้สร้างรายการจากใบงานนี้
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

    return {
      reportNo: appt.job_no ? `HVR-${appt.job_no}` : autoReportNo,
      reportDate: new Date().toISOString().slice(0, 10),
      customerName: appt.customer_name ?? "",
      custId: appt.cust_id ?? "",
      contactName: appt.contact_name ?? "",
      contactPhone: appt.contact_phone ?? "",
      customerAddress: appt.customer_address ?? "",
      visitDate: appt.visit_date ?? new Date().toISOString().slice(0, 10),
      visitTime: appt.visit_time ?? "09:00",
      staffName: appt.staff_name ?? "",
      vehiclePlate: appt.vehicle_plate ?? "",
      salesRep: appt.sales_rep ?? "",
      serviceType: appt.service_type ?? "บริการตรวจเช็กซ่อมบำรุง",
      overallSummary:
        appt.close_note ||
        "ทีมช่างได้เข้าปฏิบัติงานตรวจเช็กและซ่อมบำรุงตามรายการข้างต้นเรียบร้อยแล้ว เครื่องจักรพร้อมใช้งานตามปกติ",
      machines: initialMachines,
      delivererName: appt.staff_name ?? "",
      delivererSignature: null,
      delivererDate: new Date().toISOString().slice(0, 10),
      receiverName: appt.contact_name ?? "",
      receiverSignature: null,
      receiverDate: new Date().toISOString().slice(0, 10),
    };
  });

  // อัปเดตข้อมูลเครื่องรายตัว
  const updateMachine = (idx: number, patch: Partial<HandoverMachineData>) => {
    setReport((prev) => {
      const nextMachines = [...prev.machines];
      nextMachines[idx] = { ...nextMachines[idx], ...patch };
      return { ...prev, machines: nextMachines };
    });
  };

  // เครื่องที่ถูกเลือกให้แสดงในเอกสาร
  const selectedMachines = useMemo(
    () => report.machines.filter((m) => m.selected),
    [report.machines],
  );

  // ส่งออก PDF
  const handleExportPdf = async () => {
    const el = printRef.current;
    if (!el) return;
    setExporting("pdf");
    try {
      const filename = `${report.reportNo}_${report.customerName || "ใบส่งมอบงาน"}.pdf`;
      const blob = await elementToPdfBlobPaged(el, 0, {
        orientation: "portrait",
      });
      await saveFile(blob, filename);
      toast.success("ดาวน์โหลด PDF ใบส่งมอบงานเรียบร้อย");
    } catch (e) {
      toast.error("ส่งออก PDF ไม่สำเร็จ: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExporting("");
    }
  };

  // สั่งพิมพ์ผ่านเบราว์เซอร์
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
                จัดกลุ่มรายงานแยกตามหมายเลขเครื่อง (S/N) พร้อมรูปภาพประกอบ เช็คลิสต์ และลายเซ็นส่งมอบ
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
                  แก้ไขข้อมูล / เลือกเครื่อง ({selectedMachines.length})
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

        {/* Tab 1: แก้ไขข้อมูลและเลือกเครื่องจักร */}
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

            {/* กล่องแก้ไขรายละเอียดข้อมูลหัวเอกสาร */}
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
                            ช่องข้อความสรุปงานเครื่องนี้ (Editable Text Area)
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

            {/* ส่วนลงลายมือชื่อ */}
            <div className="rounded-xl border bg-card p-4 shadow-2xs">
              <h3 className="mb-3 text-sm font-bold text-foreground">
                4. ลายมือชื่อผู้ส่งมอบงานและผู้รับมอบงาน
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* ผู้ส่งมอบงาน */}
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs font-bold text-foreground">ผู้ส่งมอบงาน (ฝ่ายบริการ/ช่าง)</p>
                  <div>
                    <Label className="text-[11px]">ชื่อผู้ส่งมอบ</Label>
                    <Input
                      value={report.delivererName}
                      onChange={(e) => setReport({ ...report, delivererName: e.target.value })}
                      className="h-8 text-xs"
                      placeholder="ชื่อ-นามสกุล ช่างบริการ"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    {report.delivererSignature ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={report.delivererSignature}
                          alt="ลายเซ็นผู้ส่งมอบ"
                          className="h-10 border rounded bg-white px-2 py-0.5 object-contain"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive"
                          onClick={() => setReport({ ...report, delivererSignature: null })}
                        >
                          ลบ
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setSigningWho("deliverer")}
                      >
                        <PenTool className="h-3 w-3" /> เซ็นชื่อดิจิทัล (หน้าจอ)
                      </Button>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      วันที่: {formatDate(report.delivererDate)}
                    </span>
                  </div>
                </div>

                {/* ผู้รับมอบงาน */}
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs font-bold text-foreground">ผู้รับมอบงาน (ลูกค้า/ตัวแทน)</p>
                  <div>
                    <Label className="text-[11px]">ชื่อผู้รับมอบ</Label>
                    <Input
                      value={report.receiverName}
                      onChange={(e) => setReport({ ...report, receiverName: e.target.value })}
                      className="h-8 text-xs"
                      placeholder="ชื่อ-นามสกุล ตัวแทนลูกค้า"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    {report.receiverSignature ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={report.receiverSignature}
                          alt="ลายเซ็นผู้รับมอบ"
                          className="h-10 border rounded bg-white px-2 py-0.5 object-contain"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive"
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
                        className="h-7 text-xs gap-1"
                        onClick={() => setSigningWho("receiver")}
                      >
                        <PenTool className="h-3 w-3" /> เซ็นชื่อดิจิทัล (หน้าจอ)
                      </Button>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      วันที่: {formatDate(report.receiverDate)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: ตัวอย่างเอกสารจริง พร้อมพิมพ์ / Export PDF */}
        {activeTab === "preview" && (
          <div className="overflow-x-auto py-2">
            <div className="mx-auto w-[210mm] min-h-[297mm] shadow-lg rounded-sm border border-slate-200 bg-white dark:bg-white dark:text-slate-900">
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
            title={signingWho === "deliverer" ? "ลงลายมือชื่อผู้ส่งมอบงาน" : "ลงลายมือชื่อผู้รับมอบงาน"}
            name={signingWho === "deliverer" ? report.delivererName : report.receiverName}
            onSave={(dataUrl) => {
              if (signingWho === "deliverer") {
                setReport((prev) => ({ ...prev, delivererSignature: dataUrl }));
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

  return (
    <article className="handover-report-export p-8 text-slate-900 font-sans leading-relaxed text-[13px] bg-white">
      {/* 1. Header ตราและหัวเอกสาร */}
      <header className="border-b-2 border-slate-800 pb-4 mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-wider uppercase font-bold text-primary">
            MOTOR MATE SERVICE & ENGINEERING
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            ใบส่งมอบงานและรายงานการบริการ
          </h1>
          <p className="text-xs font-semibold text-slate-600">
            JOB HANDOVER & SERVICE REPORT
          </p>
        </div>
        <div className="text-right text-xs space-y-1">
          <div className="inline-block rounded border border-slate-300 bg-slate-50 px-2.5 py-1">
            <span className="text-slate-500 font-normal">เลขที่รายงาน: </span>
            <strong className="font-mono text-slate-900">{report.reportNo}</strong>
          </div>
          <p className="text-slate-600">
            วันที่ส่งมอบ: <strong>{formatDate(report.reportDate)}</strong>
          </p>
          <p className="text-slate-600">
            ประเภทงาน: <strong>{report.serviceType || "งานบริการตรวจเช็กซ่อมบำรุง"}</strong>
          </p>
        </div>
      </header>

      {/* 2. Customer & Service Info Box */}
      <section className="mb-5 rounded-lg border border-slate-300 bg-slate-50/70 p-3.5 text-xs">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
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
            <span className="text-slate-500 font-medium">ทีมช่างผู้รับผิดชอบ:</span>{" "}
            <strong className="text-slate-900">
              {[report.staffName, report.vehiclePlate ? `รถ ${report.vehiclePlate}` : ""].filter(Boolean).join(" · ") || "-"}
            </strong>
          </div>
          <div className="col-span-2">
            <span className="text-slate-500 font-medium">สถานที่ปฏิบัติงาน / ที่อยู่:</span>{" "}
            <span className="text-slate-800">{report.customerAddress || "-"}</span>
          </div>
        </div>
      </section>

      {/* 3. Section ทีละเครื่อง (1 หัวข้อต่อ 1 S/N) */}
      <div className="space-y-6">
        {selectedMachines.length === 0 ? (
          <p className="text-center text-xs text-slate-500 py-6 border rounded">
            ไม่มีเครื่องจักรที่เลือกในรายงานนี้
          </p>
        ) : (
          selectedMachines.map((m, idx) => (
            <section
              key={m.serial + idx}
              className="rounded-lg border border-slate-300 p-4 space-y-3.5 break-inside-avoid page-break-inside-avoid bg-white"
            >
              {/* Header เครื่องจักร */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 bg-slate-100 -mx-4 -mt-4 px-4 py-2.5 rounded-t-lg">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-800 text-white px-2 py-0.5 text-xs font-bold">
                    เครื่องที่ {idx + 1}
                  </span>
                  <span className="font-bold text-sm text-slate-900 font-mono">
                    S/N: {m.serial}
                  </span>
                  {m.customerSn && (
                    <span className="text-xs font-medium text-slate-600">
                      (รหัสลูกค้า: {m.customerSn})
                    </span>
                  )}
                </div>
                <div className="text-xs font-semibold text-slate-700">
                  รุ่น/รายละเอียด: {m.label || "-"}
                </div>
              </div>

              {/* งานที่ทำ & ผลการดำเนินงาน */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                  <p className="font-bold text-slate-700 mb-1">งานที่เข้าไปปฏิบัติ (Job Detail)</p>
                  <p className="whitespace-pre-wrap text-slate-800">{m.jobDetail || "-"}</p>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-slate-700">ผลงานที่ทำเสร็จ (Result Status)</p>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
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
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {m.partsReplaced && (
                    <div className="rounded border border-slate-200 p-2.5">
                      <p className="font-bold text-slate-700 mb-1">🔧 อะไหล่ที่เปลี่ยนในงานนี้</p>
                      <p className="text-slate-800">{m.partsReplaced}</p>
                    </div>
                  )}
                  {m.recommendations && (
                    <div className="rounded border border-amber-200 bg-amber-50/40 p-2.5">
                      <p className="font-bold text-amber-900 mb-1">💡 รายการแนะนำ / ข้อเสนอแนะเพิ่มเติม</p>
                      <p className="text-amber-800">{m.recommendations}</p>
                    </div>
                  )}
                </div>
              )}

              {/* รูปภาพประกอบผลงาน (แนบรูปปิดงาน) */}
              {m.photos && m.photos.length > 0 && (
                <div>
                  <p className="font-bold text-xs text-slate-700 mb-2">
                    📷 รูปภาพประกอบผลงานการปฏิบัติงาน (Attached Photos)
                  </p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {m.photos.map((p, pIdx) => (
                      <div
                        key={p.path + pIdx}
                        className="rounded border border-slate-200 overflow-hidden bg-slate-50 text-center"
                      >
                        <img
                          src={p.url}
                          alt={p.name}
                          crossOrigin="anonymous"
                          className="h-28 w-full object-cover"
                        />
                        <p className="text-[10px] text-slate-600 truncate px-1 py-1">
                          {p.name || `ภาพที่ ${pIdx + 1}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* เช็คลิสต์ตรวจสอบ (ถ้ามีติ๊กให้แสดง) */}
              {m.includeChecklist && checklist && (
                <div className="rounded border border-slate-200 p-2.5 bg-slate-50/40">
                  <p className="font-bold text-xs text-slate-700 mb-1.5">
                    📋 ผลการตรวจสอบ Checklist ประจำเครื่อง
                  </p>
                  <ChecklistView value={checklist} />
                </div>
              )}

              {/* ช่องข้อความสรุปงาน */}
              {m.summary && (
                <div className="rounded border border-slate-200 bg-slate-50 p-2.5 text-xs">
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
        <section className="mt-5 rounded-lg border border-slate-300 bg-slate-50/50 p-3 text-xs break-inside-avoid page-break-inside-avoid">
          <p className="font-bold text-slate-800 mb-1">สรุปภาพรวมการส่งมอบงาน (Summary)</p>
          <p className="whitespace-pre-wrap text-slate-700">{report.overallSummary}</p>
        </section>
      )}

      {/* 5. ส่วนลงนามลายเซ็นผู้ส่งมอบและผู้รับมอบงาน */}
      <footer className="mt-8 pt-4 border-t-2 border-slate-800 break-inside-avoid page-break-inside-avoid">
        <div className="grid grid-cols-2 gap-8 text-center text-xs">
          {/* ช่องผู้ส่งมอบงาน */}
          <div className="flex flex-col items-center justify-between rounded-lg border border-slate-300 p-3.5 min-h-[140px]">
            <p className="font-bold text-slate-800 mb-2">
              ผู้ส่งมอบงาน (Service Engineer / Technician)
            </p>
            <div className="h-14 flex items-center justify-center w-full">
              {report.delivererSignature ? (
                <img
                  src={report.delivererSignature}
                  alt="ลายเซ็นผู้ส่งมอบ"
                  crossOrigin="anonymous"
                  className="h-12 max-w-[180px] object-contain"
                />
              ) : (
                <div className="w-48 border-b border-dotted border-slate-400 mt-6" />
              )}
            </div>
            <div className="mt-2 text-slate-700 space-y-0.5">
              <p>ลงชื่อ: ({report.delivererName || "____________________"})</p>
              <p className="text-[11px] text-slate-500">
                วันที่: {formatDate(report.delivererDate)}
              </p>
            </div>
          </div>

          {/* ช่องผู้รับมอบงาน */}
          <div className="flex flex-col items-center justify-between rounded-lg border border-slate-300 p-3.5 min-h-[140px]">
            <p className="font-bold text-slate-800 mb-2">
              ผู้รับมอบงาน (Customer Acceptance)
            </p>
            <div className="h-14 flex items-center justify-center w-full">
              {report.receiverSignature ? (
                <img
                  src={report.receiverSignature}
                  alt="ลายเซ็นผู้รับมอบ"
                  crossOrigin="anonymous"
                  className="h-12 max-w-[180px] object-contain"
                />
              ) : (
                <div className="w-48 border-b border-dotted border-slate-400 mt-6" />
              )}
            </div>
            <div className="mt-2 text-slate-700 space-y-0.5">
              <p>ลงชื่อ: ({report.receiverName || "____________________"})</p>
              <p className="text-[11px] text-slate-500">
                วันที่: {formatDate(report.receiverDate)}
              </p>
            </div>
          </div>
        </div>
      </footer>
    </article>
  );
}

import { useRef, useState } from "react";
import { FileDown, Loader2, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { exportFilename } from "@/lib/export-filename";

export type JobFormRecord = {
  job_no?: string | null; customer_name?: string | null; cust_id?: string | null; customer_address?: string | null;
  contact_name?: string | null; contact_phone?: string | null; machine_label?: string | null; serial_number?: string | null;
  customer_sn?: string | null; service_type?: string | null; work_types?: string | null; visit_date?: string | null;
  visit_time?: string | null; staff_name?: string | null; sales_rep?: string | null; vehicle_plate?: string | null;
  job_detail?: string | null; priority?: string | null; billing_type?: string | null; po_number?: string | null;
  parts_note?: string | null; logistics_note?: string | null; close_note?: string | null; result?: string | null; status?: string | null;
};

const v = (s?: string | null) => (s && String(s).trim()) || "-";
const thDate = (d?: string | null) => {
  if (!d) return "-";
  const t = new Date(d + "T00:00:00");
  return isNaN(t.getTime()) ? d : t.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] border-b border-border py-1.5 text-sm" style={{ breakInside: "avoid" }}>
      <span className="font-semibold text-muted-foreground">{label}</span>
      <span className="whitespace-pre-wrap break-words">{value}</span>
    </div>
  );
}

export function JobFormView({ record, onClose }: { record: JobFormRecord; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"" | "pdf" | "share">("");
  const filename = exportFilename(`ใบงาน-${record.customer_name || record.job_no || "งาน"}`, record.visit_date || new Date().toISOString().slice(0, 10), "pdf");

  const build = async () => {
    const el = ref.current;
    if (!el) throw new Error("ไม่พบแบบฟอร์ม");
    const { elementsToA4PdfBlob } = await import("@/lib/report");
    return elementsToA4PdfBlob([el]);
  };
  const run = async (kind: "pdf" | "share") => {
    setBusy(kind);
    try {
      const blob = await build();
      const { saveFile, shareOrDownload } = await import("@/lib/report");
      if (kind === "pdf") await saveFile(blob, filename);
      else await shareOrDownload(blob, filename, filename);
    } catch (e) {
      toast.error("ส่งออกไม่สำเร็จ: " + (e as Error).message);
    } finally { setBusy(""); }
  };

  const staff = (record.staff_name || "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean).join(", ");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-none sm:w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>แบบฟอร์มใบงาน</DialogTitle>
          <DialogDescription>ดูเป็นเอกสาร A4 แล้วบันทึก PDF หรือแชร์</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => run("pdf")} disabled={!!busy}>
            {busy === "pdf" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />} บันทึก PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => run("share")} disabled={!!busy}>
            {busy === "share" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Share2 className="mr-1 h-4 w-4" />} แชร์
          </Button>
          <Button size="sm" variant="ghost" onClick={() => window.print()} disabled={!!busy}>
            <Printer className="mr-1 h-4 w-4" /> พิมพ์
          </Button>
        </div>
        <div className="force-scrollbar max-h-[70vh] overflow-auto rounded border border-border bg-muted p-2" style={{ touchAction: "pan-x pan-y" }}>
          <div ref={ref} className="mx-auto w-[794px] bg-card p-10 text-card-foreground">
            <div className="mb-4 flex items-end justify-between border-b-2 border-foreground pb-2">
              <div>
                <h2 className="text-2xl font-bold">ใบงานบริการ</h2>
                <p className="text-sm text-muted-foreground">Service Job Form</p>
              </div>
              <div className="text-right text-sm">
                <div>เลขที่งาน: <b>{v(record.job_no)}</b></div>
                <div>สถานะ: {v(record.status)}</div>
              </div>
            </div>
            <h3 className="mb-1 mt-3 text-base font-bold">ข้อมูลลูกค้า</h3>
            <Row label="ชื่อลูกค้า" value={v(record.customer_name)} />
            <Row label="รหัสลูกค้า" value={v(record.cust_id)} />
            <Row label="ที่อยู่" value={v(record.customer_address)} />
            <Row label="ผู้ติดต่อ / โทร" value={`${v(record.contact_name)} / ${v(record.contact_phone)}`} />
            <h3 className="mb-1 mt-4 text-base font-bold">ข้อมูลเครื่อง</h3>
            <Row label="รุ่นเครื่อง" value={v(record.machine_label)} />
            <Row label="หมายเลขเครื่อง" value={v(record.serial_number)} />
            <Row label="S/N ลูกค้า" value={v(record.customer_sn)} />
            <h3 className="mb-1 mt-4 text-base font-bold">รายละเอียดนัดหมาย</h3>
            <Row label="ประเภทงาน" value={[record.service_type, record.work_types].filter((x) => x && x.trim()).join(" · ") || "-"} />
            <Row label="วันที่ / เวลา" value={`${thDate(record.visit_date)} ${record.visit_time ? "เวลา " + record.visit_time : ""}`} />
            <Row label="ช่าง" value={staff || "-"} />
            <Row label="พนักงานขาย" value={v(record.sales_rep)} />
            <Row label="ทะเบียนรถ" value={v(record.vehicle_plate)} />
            <Row label="ความเร่งด่วน" value={v(record.priority)} />
            <Row label="การเรียกเก็บ / PO" value={`${v(record.billing_type)} / ${v(record.po_number)}`} />
            <h3 className="mb-1 mt-4 text-base font-bold">รายละเอียดงานและหมายเหตุ</h3>
            <Row label="งานที่ไปทำ" value={v(record.job_detail)} />
            <Row label="อะไหล่" value={v(record.parts_note)} />
            <Row label="หมายเหตุ" value={v(record.logistics_note)} />
            {(record.result || record.close_note) && <Row label="ผลการปิดงาน" value={`${v(record.result)}\n${record.close_note || ""}`.trim()} />}
            <div className="mt-12 grid grid-cols-2 gap-10 text-center text-sm" style={{ breakInside: "avoid" }}>
              <div><div className="border-t border-foreground pt-1">ลายมือชื่อช่าง</div></div>
              <div><div className="border-t border-foreground pt-1">ลายมือชื่อลูกค้า</div></div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

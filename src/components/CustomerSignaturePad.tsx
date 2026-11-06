import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, CheckCircle2, Eraser, PenTool, RotateCcw, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { canvasToCompressedDataUrl } from "@/lib/image-compress";

export interface CustomerSignaturePadRef {
  /** ล้างผ้าใบเซ็นชื่อ */
  clear: () => void;
  /** ตรวจสอบว่าผ้าใบว่างเปล่าหรือไม่ */
  isEmpty: () => boolean;
  /** ตัดขอบและแปลงเป็น Base64 Data URL (image/png) */
  getTrimmedSignature: () => string | null;
  /** ยืนยันการเซ็นชื่อและอัปเดต state */
  confirmSignature: () => string | null;
}

export interface CustomerSignaturePadProps {
  /** ชื่อ-นามสกุล ผู้รับมอบงาน (ตัวบรรจง) */
  signerName: string;
  onSignerNameChange: (name: string) => void;
  /** ลายเซ็นในรูปแบบ Base64 Data URL (image/png) */
  value: string | null;
  /** Callback เมื่อมีการอัปเดตหรือล้างลายเซ็น */
  onChange: (dataUrl: string | null) => void;
  /** ปิดการแก้ไข (แสดงเฉพาะตัวอย่าง) */
  readOnly?: boolean;
  /** ข้อความเตือนหรือข้อกำหนด */
  required?: boolean;
}

export const CustomerSignaturePad = forwardRef<CustomerSignaturePadRef, CustomerSignaturePadProps>(
  function CustomerSignaturePad(
    { signerName, onSignerNameChange, value, onChange, readOnly = false, required = false },
    ref,
  ) {
    const padRef = useRef<SignatureCanvas | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [hasStrokes, setHasStrokes] = useState(false);

    // ปรับขนาดผ้าใบให้ตรงกับขนาด container จริง (โดยเฉพาะบนมือถือ/แท็บเล็ต)
    const resizeCanvas = () => {
      if (!padRef.current) return;
      const canvas = padRef.current.getCanvas();
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && (canvas.width === 0 || Math.abs(canvas.offsetWidth - rect.width) > 4)) {
        // หากยังไม่ได้ยืนยัน ให้คงสเกลความละเอียดสูงตาม devicePixelRatio
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = rect.width * ratio;
        canvas.height = (rect.height || 180) * ratio;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.scale(ratio, ratio);
      }
    };

    useEffect(() => {
      // ตรวจสอบขนาด canvas เมื่อ mount หรือเมื่อหน้าจอเปลี่ยนขนาด
      const timer = setTimeout(resizeCanvas, 60);
      window.addEventListener("resize", resizeCanvas);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("resize", resizeCanvas);
      };
    }, [value]);

    const handleClear = () => {
      if (padRef.current) {
        padRef.current.clear();
      }
      setHasStrokes(false);
      onChange(null);
    };

    const handleConfirm = () => {
      if (!padRef.current || padRef.current.isEmpty()) {
        toast.error("กรุณาลงลายมือชื่อก่อนกดยืนยัน");
        return null;
      }
      try {
        const trimmed = padRef.current.getTrimmedCanvas();
        const dataUrl = canvasToCompressedDataUrl(trimmed);
        onChange(dataUrl);
        toast.success("บันทึกลายเซ็นเรียบร้อย");
        return dataUrl;
      } catch (err) {
        console.error("Signature trim error:", err);
        const dataUrl = canvasToCompressedDataUrl(padRef.current.getCanvas());
        onChange(dataUrl);
        return dataUrl;
      }
    };

    useImperativeHandle(ref, () => ({
      clear: handleClear,
      isEmpty: () => {
        if (value) return false;
        if (!padRef.current) return true;
        return padRef.current.isEmpty();
      },
      getTrimmedSignature: () => {
        if (value) return value;
        if (!padRef.current || padRef.current.isEmpty()) return null;
        try {
          return canvasToCompressedDataUrl(padRef.current.getTrimmedCanvas());
        } catch {
          return canvasToCompressedDataUrl(padRef.current.getCanvas());
        }
      },
      confirmSignature: handleConfirm,
    }));

    return (
      <div className="min-w-0 space-y-3 rounded-xl border border-border/80 bg-card p-3.5 shadow-xs sm:p-4">
        {/* Header ส่วนลายเซ็น */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PenTool className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight text-foreground flex items-center gap-1.5">
                ลายมือชื่อลูกค้า / ผู้รับมอบงาน (Customer Signature)
                <span className="text-[11px] font-normal text-muted-foreground">(ไม่บังคับ)</span>
              </p>
              <p className="text-xs text-muted-foreground">
                ลงลายมือชื่อดิจิทัลด้วยนิ้วมือหรือปากกา Stylus บนหน้าจอเพื่อรับมอบงาน (หากต้องการ)
              </p>
            </div>
          </div>
          {value ? (
            <Badge
              variant="outline"
              className="border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> ลงนามเรียบร้อย
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              ยังไม่ลงนาม (ไม่บังคับ)
            </Badge>
          )}
        </div>

        {/* ช่องระบุชื่อ-นามสกุล ผู้รับมอบงาน วางคู่กับช่องลายเซ็น */}
        <div className="min-w-0 space-y-1.5">
          <Label
            htmlFor="customer-signer-name"
            className="text-xs font-medium text-foreground flex items-center gap-1.5"
          >
            <UserCheck className="h-3.5 w-3.5 text-primary" />
            ชื่อ-นามสกุล ผู้รับมอบงาน (ตัวบรรจง){" "}
            <span className="text-[11px] font-normal text-muted-foreground">
              (ถ้ามี / ไม่บังคับ)
            </span>
          </Label>
          <Input
            id="customer-signer-name"
            placeholder="ระบุชื่อ-นามสกุลผู้รับมอบงาน (ถ้ามี) เช่น สมชาย มีสุข"
            value={signerName}
            onChange={(e) => onSignerNameChange(e.target.value)}
            disabled={readOnly}
            className="h-9 min-w-0 bg-background text-sm"
          />
        </div>

        {/* กล่องผ้าใบเซ็นชื่อ / แสดง Thumbnail Preview เมื่อยืนยันแล้ว */}
        <div className="min-w-0 space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">
            ช่องเซ็นชื่อดิจิทัล (Digital Signature Pad)
          </Label>

          {value ? (
            /* Thumbnail Preview ของลายเซ็นที่เซ็นและยืนยันแล้ว */
            <div className="relative rounded-lg border-2 border-dashed border-emerald-500/40 bg-white p-3 text-center dark:bg-slate-900">
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="flex h-24 max-w-full items-center justify-center overflow-hidden rounded bg-slate-50/50 p-2 dark:bg-slate-950/50">
                  <img
                    src={value}
                    alt="ภาพตัวอย่างลายเซ็นผู้รับมอบงาน"
                    className="max-h-20 max-w-full object-contain filter dark:invert"
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-foreground">
                    {signerName.trim() ? `(${signerName.trim()})` : "(ผู้รับมอบงาน)"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    ผู้รับมอบงาน / ตรวจรับงานเรียบร้อย
                  </p>
                </div>
              </div>

              {!readOnly && (
                <div className="mt-2.5 flex justify-end border-t pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClear}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> ล้างเพื่อเซ็นใหม่ (Clear)
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Canvas สำหรับเซ็นชื่อ พร้อม touch-none ล็อกหน้าจอไม่ให้เลื่อน */
            <div className="space-y-2">
              <div
                ref={containerRef}
                style={{ touchAction: "none" }}
                className="relative h-44 w-full touch-none select-none overflow-hidden rounded-lg border-2 border-dashed border-primary/40 bg-white shadow-inner dark:bg-slate-950"
              >
                <SignatureCanvas
                  ref={padRef}
                  penColor="#0f172a"
                  minWidth={1.5}
                  maxWidth={3.5}
                  velocityFilterWeight={0.7}
                  clearOnResize={false}
                  onBegin={() => setHasStrokes(true)}
                  canvasProps={{
                    className: "h-full w-full touch-none block cursor-crosshair",
                    style: { touchAction: "none" },
                  }}
                />

                {/* ข้อความ Watermark แนะนำตำแหน่งเซ็นชื่อ */}
                {!hasStrokes && (
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs text-slate-400 select-none dark:text-slate-500">
                    <PenTool className="h-5 w-5 opacity-40" />
                    <span>ใช้นิ้วมือหรือปากกา Stylus ลงลายมือชื่อที่นี่</span>
                    <span className="text-[10px] text-slate-400/80">
                      (หน้าจอจะถูกล็อกไม่ให้เลื่อนขณะจรดเส้น)
                    </span>
                  </div>
                )}
              </div>

              {/* ปุ่มควบคุม: ล้างเพื่อเซ็นใหม่ & ยืนยันเซ็นชื่อ */}
              {!readOnly && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    disabled={!hasStrokes}
                    className="h-8 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <Eraser className="mr-1.5 h-3.5 w-3.5" /> ล้างเพื่อเซ็นใหม่ (Clear)
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleConfirm}
                    disabled={!hasStrokes}
                    className="h-8 text-xs font-medium"
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> ยืนยันเซ็นชื่อ
                    (Confirm)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  },
);

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldAlert, Loader2, CalendarX2 } from "lucide-react";

export interface ScheduleConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: string[];
  onConfirmOverride: () => void | Promise<void>;
  onCancel?: () => void;
  busy?: boolean;
}

/**
 * Pop-up แจ้งเตือนตารางงานซ้อน (Schedule Conflict) พร้อมระบบ Double Confirmation สำหรับแอดมิน
 * Step 1: แสดงรายละเอียดงานที่ซ้อนกัน + ปุ่ม "ยกเลิก / แก้ไขเวลา" และ "ยืนยันลงงานซ้อน (Admin Override)"
 * Step 2: ยืนยันรอบที่ 2 (Double Confirmation): "ต้องการบังคับบันทึกงานซ้อนช่วงเวลานี้ใช่หรือไม่? (กรณีช่างเปลี่ยนรถ/สลับงาน)"
 */
export function ScheduleConflictDialog({
  open,
  onOpenChange,
  conflicts,
  onConfirmOverride,
  onCancel,
  busy = false,
}: ScheduleConflictDialogProps) {
  const [step, setStep] = useState<"warning" | "double_confirm">("warning");

  // รีเซ็ตกลับไปหน้าเตือนรอบที่ 1 ทุกครั้งที่เปิดกล่องข้อความใหม่
  useEffect(() => {
    if (open) {
      setStep("warning");
    }
  }, [open]);

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    await onConfirmOverride();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!busy ? onOpenChange(o) : null)}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-lg sm:w-[calc(100vw-2rem)]">
        {step === "warning" ? (
          <>
            <DialogHeader className="gap-1">
              <div className="flex items-center gap-2 text-destructive">
                <div className="rounded-full bg-destructive/10 p-2">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <DialogTitle className="text-base sm:text-lg">
                  แจ้งเตือนตารางงานซ้อน (Schedule Conflict)
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs sm:text-sm">
                ระบบตรวจพบว่าช่างหรือยานพาหนะถูกลงงานอื่น หรือมีวันลาในช่วงเวลาเดียวกัน
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3.5 space-y-2">
                <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                  <CalendarX2 className="h-4 w-4 shrink-0" />
                  รายละเอียดเงื่อนไขที่ซ้อนกัน ({conflicts.length} รายการ):
                </p>
                <ul className="space-y-1.5 text-xs text-foreground/90 pl-1">
                  {conflicts.map((c, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                      <span className="leading-relaxed font-medium">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                💡 <span className="font-medium">คำแนะนำ:</span> ท่านสามารถเลือก{" "}
                <strong>"ยกเลิก / แก้ไขเวลา"</strong> เพื่อปรับเปลี่ยนเวลาหรือทีมช่าง
                หรือเลือกยืนยันด้วยสิทธิ์แอดมินเพื่อบังคับลงงานซ้อน
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={busy}
                className="w-full sm:w-auto"
              >
                ยกเลิก / แก้ไขเวลา
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setStep("double_confirm")}
                disabled={busy}
                className="w-full sm:w-auto"
              >
                <ShieldAlert className="mr-1.5 h-4 w-4" />
                ยืนยันลงงานซ้อน (Admin Override)
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="gap-1">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <div className="rounded-full bg-amber-500/10 p-2">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <DialogTitle className="text-base sm:text-lg">
                  ยืนยันบังคับบันทึกงานซ้อน (Double Confirmation)
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs sm:text-sm">
                การดำเนินการนี้ต้องได้รับการยืนยันซ้ำจากแอดมินเพื่อความถูกต้องของตารางงาน
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3">
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  ต้องการบังคับบันทึกงานซ้อนช่วงเวลานี้ใช่หรือไม่? (กรณีช่างเปลี่ยนรถ/สลับงาน)
                </p>
                <p className="mt-2 text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                  เมื่อยืนยัน ระบบจะบันทึกข้อมูลลงตารางงานทันที และจะติด Flag{" "}
                  <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px] text-foreground border">
                    [Admin Override: ลงงานซ้อน]
                  </code>{" "}
                  พร้อมเก็บประวัติลงใน Audit Log ของระบบเพื่อใช้ตรวจสอบย้อนหลัง
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("warning")}
                disabled={busy}
                className="w-full sm:w-auto"
              >
                ย้อนกลับ
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirm}
                disabled={busy}
                className="w-full sm:w-auto"
              >
                {busy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldAlert className="mr-1.5 h-4 w-4" />
                )}
                ยืนยันลงงานซ้อน (Admin Override)
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

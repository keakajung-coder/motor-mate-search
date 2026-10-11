import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CalendarX, Plus, Trash2, Pencil, CalendarDays, Palmtree, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/report";
import { type Holiday } from "@/lib/holidays";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/ConfirmButton";

const COLOR_OPTIONS: { id: string; label: string; bg: string; badge: string; dot: string }[] = [
  { id: "rose", label: "แดง / ชมพู (มาตรฐาน)", bg: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900", badge: "bg-rose-500", dot: "bg-rose-500" },
  { id: "amber", label: "ส้ม / เหลือง", bg: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900", badge: "bg-amber-500", dot: "bg-amber-500" },
  { id: "purple", label: "ม่วง", bg: "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-900", badge: "bg-purple-500", dot: "bg-purple-500" },
  { id: "blue", label: "ฟ้า / น้ำเงิน", bg: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900", badge: "bg-blue-500", dot: "bg-blue-500" },
  { id: "emerald", label: "เขียว", bg: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900", badge: "bg-emerald-500", dot: "bg-emerald-500" },
];

export function getHolidayColor(colorId?: string) {
  return COLOR_OPTIONS.find((c) => c.id === colorId) ?? COLOR_OPTIONS[0];
}

/** ฟอร์มสร้าง / แก้ไขวันหยุด */
export function HolidayFormDialog({
  open,
  onOpenChange,
  initialDate,
  editingHoliday,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: string;
  editingHoliday?: Holiday | null;
  onSave: (data: { date: string; title: string; note: string; color: string }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [date, setDate] = useState(editingHoliday?.date ?? initialDate ?? "");
  const [title, setTitle] = useState(editingHoliday?.title ?? "");
  const [note, setNote] = useState(editingHoliday?.note ?? "");
  const [color, setColor] = useState(editingHoliday?.color ?? "rose");
  const [busy, setBusy] = useState(false);

  // รีเซ็ตค่าเมื่อเปิด dialog ใหม่
  const handleOpen = (val: boolean) => {
    if (val) {
      setDate(editingHoliday?.date ?? initialDate ?? "");
      setTitle(editingHoliday?.title ?? "");
      setNote(editingHoliday?.note ?? "");
      setColor(editingHoliday?.color ?? "rose");
    }
    onOpenChange(val);
  };

  const submit = async () => {
    if (!date.trim()) {
      toast.error("กรุณาระบุวันที่หยุด");
      return;
    }
    if (!title.trim()) {
      toast.error("กรุณาระบุชื่อวันหยุด หรือสาเหตุการหยุด");
      return;
    }

    setBusy(true);
    try {
      await onSave({
        date: date.trim(),
        title: title.trim(),
        note: note.trim(),
        color,
      });
      toast.success(editingHoliday ? "บันทึกการแก้ไขวันหยุดแล้ว" : "เพิ่มวันหยุดในปฏิทินเรียบร้อย");
      onOpenChange(false);
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Palmtree className="h-5 w-5 text-rose-500" />
            {editingHoliday ? "แก้ไขวันหยุดในปฏิทิน" : "เพิ่มวันหยุดในปฏิทิน"}
          </DialogTitle>
          <DialogDescription>
            กำหนดวันหยุดและบันทึกข้อมูลว่าหยุดเนื่องจากอะไร จะแสดงป้ายเตือนบนปฏิทินและคิวงาน
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="holiday-date">วันที่หยุด *</Label>
            <DateInput
              id="holiday-date"
              value={date}
              onChange={setDate}
              className="w-full"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="holiday-title">ชื่อวันหยุด / หัวข้อ *</Label>
            <Input
              id="holiday-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น วันสงกรานต์, วันหยุดประจำปี, ปิดปรับปรุงโรงงาน"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="holiday-note">ข้อมูล / สาเหตุที่หยุด (รายละเอียด)</Label>
            <Textarea
              id="holiday-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น หยุดทำการทั้งบริษัท ไม่มีคิวช่างออกบริการ หรือมีช่างสแตนด์บายฉุกเฉิน..."
            />
            <p className="text-[11px] text-muted-foreground">
              รายละเอียดนี้จะแสดงเมื่อแตะดูวันที่หรือคิวงานประจำวัน
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>สีป้ายกำกับ</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  className={
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all " +
                    (color === c.id
                      ? "border-primary bg-primary/10 font-medium ring-2 ring-primary"
                      : "border-border hover:bg-accent text-muted-foreground")
                  }
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                  <span>{c.label.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <div>
            {editingHoliday && onDelete && (
              <ConfirmButton
                title="ลบวันหยุดนี้ออกจากปฏิทิน?"
                description={`ต้องการยกเลิกวันหยุด "${editingHoliday.title}" วันที่ ${formatDate(editingHoliday.date)} หรือไม่`}
                onConfirm={async () => {
                  await onDelete(editingHoliday.id);
                  toast.success("ลบวันหยุดเรียบร้อย");
                  onOpenChange(false);
                }}
                className="text-destructive"
              >
                <Trash2 className="mr-1 h-4 w-4" /> ลบวันหยุด
              </ConfirmButton>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              ยกเลิก
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? "กำลังบันทึก..." : "บันทึกวันหยุด"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** หน้าต่างจัดการวันหยุดทั้งหมด (ดูรายการ / เพิ่ม / ลบ) */
export function HolidayManagerDialog({
  open,
  onOpenChange,
  holidays,
  onAdd,
  onUpdate,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holidays: Holiday[];
  onAdd: (data: Omit<Holiday, "id">) => Promise<Holiday>;
  onUpdate: (h: Holiday) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);

  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <div className="flex items-center gap-2">
                <Palmtree className="h-5 w-5 text-rose-500" />
                <DialogTitle>จัดการวันหยุดในปฏิทิน</DialogTitle>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className="flex items-center gap-1"
              >
                <Plus className="h-4 w-4" /> เพิ่มวันหยุดใหม่
              </Button>
            </div>
            <DialogDescription className="mt-1">
              กำหนดวันหยุดบริษัท วันหยุดนักขัตฤกษ์ และบันทึกสาเหตุการหยุด ข้อมูลจะปรากฏบนปฏิทินทุกมุมมอง
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1">
            {sorted.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <CalendarX className="mx-auto h-10 w-10 opacity-40 mb-2" />
                <p className="font-medium">ยังไม่มีการบันทึกวันหยุด</p>
                <p className="text-xs mt-1">กดปุ่ม "เพิ่มวันหยุดใหม่" ด้านบนเพื่อเริ่มกำหนดวันหยุด</p>
              </div>
            ) : (
              sorted.map((h) => {
                const colorTheme = getHolidayColor(h.color);
                return (
                  <div
                    key={h.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border p-3 transition-all ${colorTheme.bg}`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold tracking-tight">{h.title}</span>
                        <Badge variant="outline" className="text-xs bg-background/80">
                          <CalendarDays className="mr-1 h-3 w-3" />
                          {formatDate(h.date)}
                        </Badge>
                      </div>
                      {h.note ? (
                        <p className="text-xs leading-relaxed opacity-90 line-clamp-2">
                          <span className="font-semibold">สาเหตุ/รายละเอียด:</span> {h.note}
                        </p>
                      ) : (
                        <p className="text-xs opacity-60 italic">ไม่มีบันทึกรายละเอียดเพิ่มเติม</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(h);
                          setFormOpen(true);
                        }}
                        className="h-8 px-2"
                        title="แก้ไขวันหยุด"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="ml-1 text-xs">แก้ไข</span>
                      </Button>
                      <ConfirmButton
                        title="ลบวันหยุดนี้?"
                        description={`ต้องการลบวันหยุด "${h.title}" (${formatDate(h.date)}) ออกจากปฏิทินหรือไม่`}
                        onConfirm={async () => {
                          await onDelete(h.id);
                          toast.success("ลบวันหยุดแล้ว");
                        }}
                        className="h-8 px-2 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </ConfirmButton>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HolidayFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingHoliday={editing}
        onSave={async (data) => {
          if (editing) {
            await onUpdate({ ...editing, ...data });
          } else {
            await onAdd(data);
          }
        }}
        onDelete={async (id) => {
          await onDelete(id);
        }}
      />
    </>
  );
}

/** ป้ายแบนเนอร์แสดงวันหยุด (ใช้ใน DayDetailDialog และ DayList) */
export function HolidayBanner({
  holiday,
  onEdit,
  onDelete,
}: {
  holiday: Holiday;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const color = getHolidayColor(holiday.color);
  return (
    <div className={`relative overflow-hidden rounded-xl border p-3 shadow-xs ${color.bg}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Palmtree className="h-5 w-5 shrink-0 text-rose-500 animate-pulse" />
            <span className="text-base font-bold sm:text-lg">วันหยุด: {holiday.title}</span>
          </div>
          {holiday.note && (
            <p className="text-xs sm:text-sm leading-relaxed opacity-95 pl-7">
              <span className="font-semibold">สาเหตุการหยุด:</span> {holiday.note}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {onEdit && (
            <Button size="sm" variant="outline" onClick={onEdit} className="h-7 px-2 text-xs bg-background/80">
              <Pencil className="mr-1 h-3 w-3" /> แก้ไขวันหยุด
            </Button>
          )}
          {onDelete && (
            <ConfirmButton
              title="ยกเลิกวันหยุดนี้?"
              description={`ต้องการลบวันหยุด "${holiday.title}" หรือไม่`}
              onConfirm={onDelete}
              className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3" />
            </ConfirmButton>
          )}
        </div>
      </div>
    </div>
  );
}

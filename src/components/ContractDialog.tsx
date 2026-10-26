import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, Plus, Sparkles, Trash2, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DateInput } from "@/components/ui/date-input";
import { cn } from "@/lib/utils";
import { spreadVisits, type GeneratedVisitPreview } from "@/lib/contract-schedule";
import { listContracts, saveContract, deactivateContract, type ContractVisitInput } from "@/lib/contracts.functions";
import { useAccess } from "@/lib/access";
import { MachineHistoryDialog } from "@/components/MachineHistoryDialog";
import { AutoScheduleRuleModal } from "@/components/AutoScheduleRuleModal";

type VisitRow = ContractVisitInput & { status?: string };

function todayISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * หน้าต่างจัดการ "สัญญาคอนแทรครายปี" ของเครื่องจักร 1 เครื่อง
 * - กำหนดรอบบริการและรูปแบบวัน (Auto-Schedule Rules) → สร้างงวดอัตโนมัติทั้งสัญญา
 * - ทุกงวดเริ่มต้นเป็น "ยังไม่ได้นัดหมาย (Unscheduled)" สามารถแก้ไขวัน/เวลาแยกงวดหลบวันหยุดได้อิสระ
 * - กดติ๊กยืนยันนัดหมายเมื่อโทรคอนเฟิร์มกับลูกค้าแล้ว
 */
export function ContractDialog({
  open,
  onOpenChange,
  machineUnitId,
  serialNumber,
  machineLabel,
  customerId,
  customerName,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machineUnitId?: string | null;
  serialNumber?: string | null;
  machineLabel?: string | null;
  customerId?: string | null;
  customerName: string;
  onSaved?: () => void;
}) {
  const { isAdmin } = useAccess();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [autoScheduleModalOpen, setAutoScheduleModalOpen] = useState(false);
  const [contractId, setContractId] = useState<string | null>(null);
  const [visitsPerYear, setVisitsPerYear] = useState(4);
  const [startDate, setStartDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);
  const [visits, setVisits] = useState<VisitRow[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listContracts({ data: { machineUnitId: machineUnitId ?? null } })
      .then((r) => {
        const c = (r.contracts as any[])[0];
        if (c) {
          setContractId(c.id);
          setVisitsPerYear(c.visits_per_year ?? 4);
          setStartDate(c.start_date ?? todayISO());
          setNote(c.note ?? "");
          setActive(!!c.active);
          setVisits(
            ((c.service_contract_visits as any[]) ?? [])
              .sort((a, b) => a.visit_no - b.visit_no)
              .map((v) => ({
                visit_no: v.visit_no,
                visit_date: v.visit_date,
                visit_time: v.visit_time ?? "",
                job_detail: v.job_detail ?? "",
                parts_note: v.parts_note ?? "",
                status: v.status || "unscheduled",
              })),
          );
        } else {
          setContractId(null);
          setVisitsPerYear(4);
          setStartDate(todayISO());
          setNote("");
          setActive(true);
          setVisits([]);
        }
      })
      .catch(() => toast.error("โหลดข้อมูลสัญญาไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [open, machineUnitId]);

  const doneCount = useMemo(() => visits.filter((v) => v.status === "done").length, [visits]);
  const unscheduledCount = useMemo(
    () => visits.filter((v) => v.status !== "done" && v.status !== "scheduled").length,
    [visits],
  );

  const handleApplyAutoSchedule = (generated: GeneratedVisitPreview[]) => {
    setVisitsPerYear(generated.length);
    setVisits((prev) =>
      generated.map((g, i) => {
        const old = prev.find((v) => v.visit_no === i + 1);
        if (old && old.status === "done") return old;
        return {
          visit_no: i + 1,
          visit_date: g.visit_date,
          visit_time: g.visit_time || old?.visit_time || "",
          job_detail: old?.job_detail || g.job_detail || "",
          parts_note: old?.parts_note || g.parts_note || "",
          status: old?.status || "unscheduled",
        };
      }),
    );
    toast.success(`คำนวณและตั้งงวดบริการอัตโนมัติ ${generated.length} ครั้งเรียบร้อยแล้ว`);
  };

  const setVisit = (no: number, patch: Partial<VisitRow>) =>
    setVisits((prev) => prev.map((v) => (v.visit_no === no ? { ...v, ...patch } : v)));

  const removeVisit = (no: number) =>
    setVisits((prev) => prev.filter((v) => v.visit_no !== no).map((v, i) => ({ ...v, visit_no: i + 1 })));

  const addVisit = () =>
    setVisits((prev) => [
      ...prev,
      {
        visit_no: prev.length + 1,
        visit_date: startDate,
        visit_time: "",
        job_detail: "",
        parts_note: "",
        status: "unscheduled",
      },
    ]);

  const save = async () => {
    if (visits.length === 0) return toast.error("กรุณากำหนดงวดเข้าบริการอย่างน้อย 1 ครั้ง");
    setSaving(true);
    try {
      await saveContract({
        data: {
          id: contractId,
          customer_id: customerId ?? null,
          customer_name: customerName,
          machine_unit_id: machineUnitId ?? null,
          serial_number: serialNumber ?? null,
          machine_label: machineLabel ?? null,
          visits_per_year: visitsPerYear,
          start_date: startDate,
          note: note || null,
          active,
          visits: visits.map((v) => ({
            visit_no: v.visit_no,
            visit_date: v.visit_date,
            visit_time: v.visit_time || null,
            job_detail: v.job_detail || null,
            parts_note: v.parts_note || null,
            status: v.status || "unscheduled",
          })),
        },
      });
      toast.success("บันทึกสัญญาและซิงค์นัดหมายลงแพลนเนอร์แล้ว");
      window.dispatchEvent(new Event("planner:reload"));
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกสัญญาไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    if (!contractId) return;
    setSaving(true);
    try {
      await deactivateContract({ data: { id: contractId } });
      toast.success("ยกเลิกสัญญาแล้ว (ประวัติยังคงอยู่)");
      setActive(false);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ยกเลิกสัญญาไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5" /> สัญญาคอนแทรครายปี
              </DialogTitle>
              <DialogDescription>
                {customerName} · {machineLabel ?? "-"} · S/N {serialNumber ?? "-"}
              </DialogDescription>
            </div>
            {(serialNumber || machineUnitId) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10 cursor-pointer font-semibold shadow-2xs"
                onClick={() => setHistoryOpen(true)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                ดูประวัติเครื่อง (Digital Passport)
              </Button>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลดสัญญา...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>จำนวนครั้งเข้าบริการ / ปี</Label>
                <Input
                  type="number"
                  min={1}
                  max={52}
                  value={visitsPerYear}
                  disabled={!isAdmin}
                  onChange={(e) => setVisitsPerYear(Math.max(1, Math.min(52, Number(e.target.value) || 1)))}
                />
              </div>
              <div>
                <Label>วันเริ่มสัญญา</Label>
                <DateInput value={startDate} onChange={setStartDate} disabled={!isAdmin} />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-primary/40 text-primary hover:bg-primary/10 font-semibold"
                  disabled={!isAdmin}
                  onClick={() => setAutoScheduleModalOpen(true)}
                >
                  <Sparkles className="mr-1 h-4 w-4" /> สร้างงวดอัตโนมัติ (Auto-Schedule)
                </Button>
              </div>
            </div>

            <div>
              <Label>หมายเหตุสัญญา</Label>
              <Textarea value={note} disabled={!isAdmin} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="เงื่อนไขสัญญา / ข้อควรจำ" />
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-semibold">
                    งวดเข้าบริการ ({visits.length} ครั้ง
                    {doneCount > 0 ? ` · ทำแล้ว ${doneCount}` : ""}
                    {unscheduledCount > 0 ? ` · รอยืนยัน ${unscheduledCount}` : ""})
                  </Label>
                </div>
                {isAdmin && (
                  <Button type="button" size="sm" variant="outline" onClick={addVisit}>
                    <Plus className="mr-1 h-4 w-4" /> เพิ่มงวด
                  </Button>
                )}
              </div>

              {visits.length === 0 && (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground space-y-2">
                  <p>ยังไม่มีงวดเข้าบริการ</p>
                  <p className="text-xs">
                    กดปุ่ม <strong>"สร้างงวดอัตโนมัติ (Auto-Schedule)"</strong> เพื่อเลือกรูปแบบวัน หรือกด <strong>"เพิ่มงวด"</strong> เอง
                  </p>
                </div>
              )}

              {visits.map((v) => {
                const isDone = v.status === "done";
                const isScheduled = v.status === "scheduled";
                const isUnscheduled = !isDone && !isScheduled;

                return (
                  <div
                    key={v.visit_no}
                    className={cn(
                      "space-y-2.5 rounded-xl border p-3.5 transition-all",
                      isUnscheduled
                        ? "border-rose-900/30 bg-rose-50/40 dark:bg-rose-950/20"
                        : isScheduled
                          ? "border-blue-200 bg-blue-50/30 dark:bg-blue-950/20"
                          : "border-border bg-card",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-foreground">
                          งวดที่ {v.visit_no}
                        </span>

                        {isDone ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 text-xs">
                            ปิดงานแล้ว
                          </Badge>
                        ) : isScheduled ? (
                          <Badge className="bg-blue-50 text-blue-700 border-blue-300 text-xs">
                            นัดหมายแล้ว (Scheduled)
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-900/15 text-rose-900 border-rose-800/40 dark:bg-rose-950/60 dark:text-rose-200 text-xs font-semibold">
                            ยังไม่ได้นัดหมาย (Unscheduled)
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Toggle Confirm Scheduling */}
                        {isAdmin && !isDone && (
                          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1 text-xs font-medium shadow-2xs hover:bg-muted/50 transition-colors">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-emerald-600 rounded cursor-pointer"
                              checked={isScheduled}
                              onChange={(e) =>
                                setVisit(v.visit_no, {
                                  status: e.target.checked ? "scheduled" : "unscheduled",
                                })
                              }
                            />
                            <span>
                              {isScheduled ? "✓ ยืนยันนัดแล้ว" : "รอยืนยัน (คลิกเพื่อยืนยัน)"}
                            </span>
                          </label>
                        )}

                        {isAdmin && !isDone && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => removeVisit(v.visit_no)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <div className="flex items-center justify-between pb-0.5">
                          <Label className="text-xs">วันที่เข้าบริการ (แก้ไขหลบวันหยุดได้อิสระ)</Label>
                        </div>
                        <DateInput
                          size="sm"
                          value={v.visit_date}
                          disabled={!isAdmin || isDone}
                          onChange={(d) => setVisit(v.visit_no, { visit_date: d })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">เวลา</Label>
                        <Input
                          type="time"
                          value={v.visit_time ?? ""}
                          disabled={!isAdmin || isDone}
                          onChange={(e) => setVisit(v.visit_no, { visit_time: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">รายละเอียดงาน</Label>
                      <Input
                        value={v.job_detail ?? ""}
                        disabled={!isAdmin || isDone}
                        onChange={(e) => setVisit(v.visit_no, { job_detail: e.target.value })}
                        placeholder="เช่น เช็กระยะ 2,000 ชม. ตามสัญญาบริการ"
                      />
                    </div>

                    <div>
                      <Label className="text-xs">อะไหล่ที่ต้องเตรียม</Label>
                      <Input
                        value={v.parts_note ?? ""}
                        disabled={!isAdmin || isDone}
                        onChange={(e) => setVisit(v.visit_no, { parts_note: e.target.value })}
                        placeholder="เช่น ไส้กรองอากาศ, ไส้กรองน้ำมัน, น้ำมันหล่อลื่น"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div>
            {isAdmin && contractId && active && (
              <Button type="button" variant="ghost" className="text-destructive" disabled={saving} onClick={deactivate}>
                ยกเลิกสัญญา
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ปิด
            </Button>
            {isAdmin && (
              <Button type="button" disabled={saving || loading} onClick={save}>
                {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} บันทึกสัญญา
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Auto-Schedule Rules Configuration Modal */}
      {autoScheduleModalOpen && (
        <AutoScheduleRuleModal
          open={autoScheduleModalOpen}
          onOpenChange={setAutoScheduleModalOpen}
          initialStartDate={startDate}
          initialVisitsPerYear={visitsPerYear}
          onApply={handleApplyAutoSchedule}
        />
      )}

      {historyOpen && (
        <MachineHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          machineUnitId={machineUnitId}
          serialNumber={serialNumber}
        />
      )}
    </Dialog>
  );
}

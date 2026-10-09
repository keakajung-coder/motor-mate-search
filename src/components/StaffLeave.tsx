import { useCallback, useEffect, useState } from "react";
import { Palmtree, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmButton } from "@/components/ConfirmButton";
import { storedAdminCode } from "@/lib/access";
import { staffLeaveRequest } from "@/lib/staff-leave.functions";
import { LEAVE_LABELS, LEAVE_PERIODS, isLeavePeriod, type StaffLeave, type LeavePeriod } from "@/lib/staff-leave";
import { toast } from "sonner";

function readCode() { return storedAdminCode() || localStorage.getItem("pc_viewer") || ""; }
export function useStaffLeave() {
  const [rows, setRows] = useState<StaffLeave[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const result = await staffLeaveRequest({ data: { code: readCode(), action: "list" } });
      setRows(result.rows.filter((row): row is StaffLeave => isLeavePeriod(row.period)));
      setStaff(result.staff);
      setError("");
    } catch { setError("โหลดวันลาไม่สำเร็จ กรุณาลองอีกครั้ง"); }
  }, []);
  useEffect(() => {
    void load();
    window.addEventListener("app:connection-restored", load);
    return () => window.removeEventListener("app:connection-restored", load);
  }, [load]);
  return { rows, staff, error, load };
}

export function LeaveCell({ date, rows, onManage, compact = false }: { date: string; rows: StaffLeave[]; onManage?: (date: string) => void; compact?: boolean }) {
  const list = rows.filter((row) => row.leave_date === date);
  return <div className="space-y-1 whitespace-normal" onClick={(event) => event.stopPropagation()}>
    {list.map((row) => <div key={row.id} className={`leave-marker leave-marker--${row.period}`} title={`${row.staff_name} · ${LEAVE_LABELS[row.period]}`}>
      <Palmtree className="size-3 shrink-0" />
      {compact ? <span className="sr-only">{row.staff_name} · {LEAVE_LABELS[row.period]}</span> : <span className="min-w-0 break-words">{row.staff_name} · {LEAVE_LABELS[row.period]}</span>}
    </div>)}
    {onManage && <Button type="button" variant="ghost" size="sm" className="no-print h-6 w-full justify-start gap-1 px-1 text-xs text-muted-foreground" title="บันทึกวันลาพนักงาน" aria-label={`บันทึกวันลา ${date}`} onClick={() => onManage(date)}>
      <Plus className="size-3" />{!compact && "วันลา"}
    </Button>}
  </div>;
}

export function StaffLeaveDialog({ date, onClose, staff, rows, reload }: { date: string | null; onClose: () => void; staff: { id: string; name: string }[]; rows: StaffLeave[]; reload: () => Promise<void> }) {
  const [staffId, setStaffId] = useState("");
  const [day, setDay] = useState("");
  const [period, setPeriod] = useState<LeavePeriod>("full");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (date) { setDay(date); setStaffId(""); setPeriod("full"); } }, [date]);
  const selected = rows.find((row) => row.staff_id === staffId && row.leave_date === day);
  const chooseStaff = (id: string) => { setStaffId(id); setPeriod(rows.find((row) => row.staff_id === id && row.leave_date === day)?.period ?? "full"); };
  const save = async () => {
    setBusy(true);
    try {
      await staffLeaveRequest({ data: { code: storedAdminCode(), action: "save", staffId, date: day, period } });
      await reload(); toast.success("บันทึกวันลาแล้ว"); onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    setBusy(true);
    try { await staffLeaveRequest({ data: { code: storedAdminCode(), action: "delete", id } }); await reload(); toast.success("ยกเลิกวันลาแล้ว"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "ยกเลิกไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  return <Dialog open={!!date} onOpenChange={(open) => { if (!open && !busy) onClose(); }}><DialogContent>
    <DialogHeader><DialogTitle>บันทึกวันลาพนักงาน</DialogTitle></DialogHeader>
    <div className="grid min-w-0 gap-4 lg:grid-cols-3">
      <div className="space-y-2"><Label htmlFor="leave-staff">พนักงาน</Label><Select value={staffId} onValueChange={chooseStaff} disabled={busy}><SelectTrigger id="leave-staff" className="w-full"><SelectValue placeholder="เลือกพนักงาน" /></SelectTrigger><SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="leave-date">วันที่ลา</Label><DateInput id="leave-date" value={day} disabled={busy} onChange={(value) => { setDay(value); setPeriod(rows.find((row) => row.staff_id === staffId && row.leave_date === value)?.period ?? "full"); }} /></div>
      <div className="space-y-2"><Label htmlFor="leave-period">ช่วงการลา</Label><Select value={period} disabled={busy} onValueChange={(value) => { if (isLeavePeriod(value)) setPeriod(value); }}><SelectTrigger id="leave-period" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{LEAVE_PERIODS.map((p) => <SelectItem key={p} value={p}>{LEAVE_LABELS[p]}</SelectItem>)}</SelectContent></Select></div>
    </div>
    <div className="space-y-2">{rows.filter((row) => row.leave_date === day).map((row) => <div key={row.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b py-2"><span className={`leave-marker leave-marker--${row.period}`}>{row.staff_name} · {LEAVE_LABELS[row.period]}</span>{!busy && <ConfirmButton confirmText="ยืนยันยกเลิกวันลา" title="ยกเลิกวันลา?" description={`${row.staff_name} · ${LEAVE_LABELS[row.period]}`} onConfirm={() => remove(row.id)}>ยกเลิกวันลา</ConfirmButton>}</div>)}</div>
    <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>ปิด</Button><Button disabled={busy || !staffId || !day} onClick={save}>{busy && <Loader2 className="size-4 animate-spin" />}{selected ? "บันทึกการแก้ไข" : "บันทึกวันลา"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
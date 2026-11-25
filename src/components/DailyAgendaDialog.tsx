import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCopy, ClipboardList, RotateCw, Send, Truck, User, Wrench, Handshake, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateInput } from "@/components/ui/date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserRole } from "@/lib/user-role";
import { sendAdminAlert } from "@/lib/notify.functions";
import {
  AGENDA_ALERT_HOUR, AGENDA_REFRESH_MINUTE_BEFORE, agendaForDate, agendaTechnicians, agendaZoneWarning,
  bangkokMinutes, bangkokToday, formatAgendaLine, shiftIsoDate, thaiDateLabel, type AgendaJob,
} from "@/lib/daily-agenda";

const SEEN_KEY = "daily_agenda_seen_date";
const ALL = "__all__";

/** True while the user is busy (another dialog open or dragging a job), so silent refresh/auto-open waits. */
function userIsBusy() {
  if (typeof document === "undefined") return true;
  return !!document.querySelector('[role="dialog"], [role="alertdialog"], [data-dragging="true"]');
}

export function DailyAgendaDialog({ jobs, isAdmin, onRefresh }: { jobs: AgendaJob[]; isAdmin: boolean; onRefresh: () => Promise<void> | void }) {
  const { role, userName } = useUserRole();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => bangkokToday());
  const [tech, setTech] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  const viewer = useMemo(() => ({ isAdmin, role, userName }), [isAdmin, role, userName]);
  const list = useMemo(() => agendaForDate(jobs, date, viewer, isAdmin ? tech : ""), [jobs, date, viewer, isAdmin, tech]);
  const techs = useMemo(() => agendaTechnicians(jobs, date), [jobs, date]);
  const lineText = useMemo(() => formatAgendaLine(date, list, jobs), [date, list, jobs]);

  const silentRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refreshRef.current(); } catch { /* keep current data; session untouched */ } finally { setRefreshing(false); }
  }, []);

  const openToday = useCallback(() => {
    setDate(bangkokToday());
    setOpen(true);
    try { localStorage.setItem(SEEN_KEY, bangkokToday()); } catch { /* ignore */ }
  }, []);

  // Auto-open once per day (after 08:00 Bangkok) and silent refresh at 07:55, never touching the session.
  useEffect(() => {
    let refreshedFor = "";
    const tick = () => {
      const today = bangkokToday();
      const mins = bangkokMinutes();
      const alertAt = AGENDA_ALERT_HOUR * 60;
      if (mins >= alertAt - AGENDA_REFRESH_MINUTE_BEFORE && refreshedFor !== today && !userIsBusy()) {
        refreshedFor = today;
        void silentRefresh();
      }
      let seen = "";
      try { seen = localStorage.getItem(SEEN_KEY) ?? ""; } catch { /* ignore */ }
      if (mins >= alertAt && seen !== today && !userIsBusy()) {
        openToday();
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try { new Notification("สรุปงานวันนี้", { body: "เปิดดูงานวันนี้ไปไหนในแพลนเนอร์" }); } catch { /* ignore */ }
        }
      }
    };
    const first = window.setTimeout(tick, 1500);
    const id = window.setInterval(tick, 60_000);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, [openToday, silentRefresh]);

  useEffect(() => { if (open) void silentRefresh(); }, [open, silentRefresh]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(lineText); toast.success("คัดลอกสรุปแล้ว วางใน LINE ได้เลย"); }
    catch { toast.error("คัดลอกไม่สำเร็จ ลองกดค้างที่ข้อความแล้วคัดลอกเอง"); }
  };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ text: lineText }); return; } catch { return; } }
    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(lineText)}`, "_blank", "noopener");
  };
  const sendLine = async () => {
    setSending(true);
    try {
      const r = await sendAdminAlert({ data: { title: `สรุปงาน ${thaiDateLabel(date)}`, body: lineText.split("\n").slice(1).join("\n") } });
      if (r.line === "sent") toast.success("ส่งสรุปเข้า LINE แอดมินแล้ว");
      else if (r.line === "skipped") toast.warning("ยังไม่ได้ตั้งค่า LINE แอดมิน (ตั้งได้ในหน้าแอดมิน)");
      else toast.error("ส่ง LINE ไม่สำเร็จ: " + (("errors" in r && r.errors?.[0]) || "ลองใหม่อีกครั้ง"));
    } catch (e) {
      toast.error("ส่ง LINE ไม่สำเร็จ: " + (e instanceof Error ? e.message : String(e)));
    } finally { setSending(false); }
  };

  const isToday = date === bangkokToday();
  return (
    <>
      <Button variant="outline" className="h-11 gap-1.5" onClick={openToday} title="สรุปงานวันนี้ไปไหน">
        <ClipboardList className="h-4 w-4 text-primary" /> สรุปงาน
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> {isToday ? "วันนี้ไปไหน" : "งานวันที่เลือก"} · {thaiDateLabel(date)}</DialogTitle>
            <DialogDescription>{isAdmin ? "งานทั้งหมดทุกทีมทุกช่างของวันที่เลือก" : `เฉพาะงานที่มีชื่อ ${userName || "คุณ"}`} · {list.length} งาน</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setDate((d) => shiftIsoDate(d, -1))} aria-label="วันก่อนหน้า"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant={isToday ? "default" : "outline"} className="h-10" onClick={() => setDate(bangkokToday())}>วันนี้</Button>
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setDate((d) => shiftIsoDate(d, 1))} aria-label="วันถัดไป"><ChevronRight className="h-4 w-4" /></Button>
            <div className="w-40"><DateInput value={date} onChange={(v) => v && setDate(v)} /></div>
            {isAdmin && (
              <Select value={tech || ALL} onValueChange={(v) => setTech(v === ALL ? "" : v)}>
                <SelectTrigger className="h-10 w-44"><SelectValue placeholder="ทุกช่าง" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>ทุกช่าง</SelectItem>
                  {techs.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button variant="ghost" className="h-10 gap-1" onClick={() => void silentRefresh()} disabled={refreshing}>
              <RotateCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> อัปเดต
            </Button>
          </div>

          <div className="space-y-2">
            {list.length === 0 && <p className="rounded-md border border-dashed p-6 text-center text-muted-foreground">ไม่มีงานนัดหมายในวันนี้</p>}
            {list.map((j) => {
              const zone = agendaZoneWarning(j, jobs);
              return (
                <div key={j.id} className="rounded-lg border bg-card p-3">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3">
                    <span className="font-mono text-sm font-semibold text-primary">{j.visit_time ? j.visit_time.slice(0, 5) : "--:--"}</span>
                    <span className="min-w-0 text-base font-semibold">{j.customer_name || "-"}</span>
                  </div>
                  <div className="mt-1 grid gap-0.5 text-sm sm:grid-cols-2">
                    <span className="min-w-0">เครื่อง: <b>{j.serial_number || j.machine_label || "-"}</b></span>
                    <span className="min-w-0">งาน: {j.service_type || j.job_detail || "-"}</span>
                    <span className="flex min-w-0 items-center gap-1"><Wrench className="h-3.5 w-3.5 shrink-0" /> {j.staff_name || "-"}</span>
                    <span className="flex min-w-0 items-center gap-1"><Handshake className="h-3.5 w-3.5 shrink-0" /> ผู้ขาย: {j.sales_rep?.trim() || "-"}</span>
                    <span className="flex min-w-0 items-center gap-1"><Truck className="h-3.5 w-3.5 shrink-0" /> {j.vehicle_plate || "-"}</span>
                  </div>
                  {zone && <p className="mt-1 flex items-start gap-1 text-sm font-medium text-orange-600"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> ข้ามโซน: {zone}</p>}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button variant="outline" className="h-11 gap-1.5" onClick={copy}><ClipboardCopy className="h-4 w-4" /> คัดลอกสรุปส่ง LINE</Button>
            <Button variant="outline" className="h-11 gap-1.5" onClick={share}><User className="h-4 w-4" /> แชร์ต่อ</Button>
            <Button className="h-11 gap-1.5" onClick={sendLine} disabled={sending}><Send className="h-4 w-4" /> {sending ? "กำลังส่ง…" : "ส่งเข้า LINE แอดมิน"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

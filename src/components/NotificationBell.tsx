import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NOTIFY_KIND_TH } from "@/lib/notify";
import { alertPulse } from "@/lib/prefs";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/ConfirmButton";
import { EMPTY_DISMISSALS, readDismissals, saveDismissals, visibleNotifications, type NotificationDismissals } from "@/lib/notification-dismissals";

type Row = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

/** กระดิ่งแจ้งเตือนในแอป — แสดงทุกกิจกรรมของผู้ใช้แบบเรียลไทม์ */
export function NotificationBell() {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const dismissals = useRef<NotificationDismissals>(EMPTY_DISMISSALS);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, kind, title, body, link, read, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setRows(visibleNotifications(data as Row[], dismissals.current));
  }, []);

  useEffect(() => {
    dismissals.current = readDismissals();
    load();
    const syncDismissals = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      dismissals.current = readDismissals();
      load();
    };
    window.addEventListener("storage", syncDismissals);
    window.addEventListener("app:connection-restored", load);
    const ch = supabase
      .channel("notifications-bell")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        alertPulse();
        load();
      })
      .subscribe();
    return () => {
      window.removeEventListener("app:connection-restored", load);
      window.removeEventListener("storage", syncDismissals);
      supabase.removeChannel(ch);
    };
  }, [load]);

  const unread = rows.filter((r) => !r.read).length;

  // Notifications are shared and have no user ownership: dismiss locally,
  // preserving other users' messages and server-side deduplication keys.
  const dismiss = (id?: string) => {
    const next: NotificationDismissals = id
      ? { ...dismissals.current, ids: [...new Set([...dismissals.current.ids, id])] }
      : { ids: [], clearedBefore: new Date().toISOString() };
    try {
      saveDismissals(next);
      dismissals.current = next;
      setRows((current) => visibleNotifications(current, next));
    } catch {
      toast.error("ลบแจ้งเตือนไม่สำเร็จ กรุณาอนุญาตการจัดเก็บข้อมูลในเบราว์เซอร์");
    }
  };

  const markAll = async () => {
    const ids = rows.filter((r) => !r.read).map((r) => r.id);
    if (ids.length === 0 || marking) return;
    setMarking(true);
    try {
      const { error } = await supabase.from("notifications").update({ read: true }).in("id", ids);
      if (error) throw error;
      setRows((current) => current.map((row) => ids.includes(row.id) ? { ...row, read: true } : row));
    } catch {
      toast.error("ทำเครื่องหมายว่าอ่านแล้วไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setMarking(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="การแจ้งเตือน">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-1rem)] p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <span className="text-sm font-semibold">การแจ้งเตือน</span>
          <Button variant="ghost" size="sm" onClick={markAll} disabled={unread === 0 || marking}>
            <Check className="mr-1 h-4 w-4" /> อ่านทั้งหมด
          </Button>
          {rows.length > 0 && (
            <ConfirmButton title="ลบแจ้งเตือนทั้งหมด?" description="ข้อความเดิมทั้งหมดจะถูกซ่อนในเบราว์เซอร์นี้ ไม่กระทบผู้ใช้อื่น และยังรับข้อความใหม่ได้ตามปกติ" confirmText="ลบทั้งหมด" onConfirm={() => dismiss()} className="text-destructive">
              <Trash2 className="mr-1 h-4 w-4" /> ลบทั้งหมด
            </ConfirmButton>
          )}
        </div>
        <ul className="max-h-96 divide-y overflow-y-auto">
          {rows.length === 0 && <li className="p-4 text-sm text-muted-foreground">ยังไม่มีการแจ้งเตือน</li>}
          {rows.map((r) => (
            <li key={r.id} className={`p-3 text-sm ${r.read ? "" : "bg-accent/40"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{NOTIFY_KIND_TH[r.kind] ?? r.kind}</Badge>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("th-TH-u-ca-buddhist")}
                </span>
              </div>
              <div className="mt-1 flex items-start gap-2">
                <div className="min-w-0 flex-1 break-words">
                  <p className="font-medium">{r.title}</p>
                  {r.body && <p className="text-xs text-muted-foreground">{r.body}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" aria-label={`ลบแจ้งเตือน ${r.title}`} title="ลบแจ้งเตือน" onClick={() => dismiss(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

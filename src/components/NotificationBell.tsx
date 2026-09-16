import { useCallback, useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NOTIFY_KIND_TH } from "@/lib/notify";
import { alertPulse } from "@/lib/prefs";

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

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, kind, title, body, link, read, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setRows((data ?? []) as Row[]);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("notifications-bell")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        alertPulse();
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const unread = rows.filter((r) => !r.read).length;

  const markAll = async () => {
    const ids = rows.filter((r) => !r.read).map((r) => r.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ read: true }).in("id", ids);
    load();
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
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">การแจ้งเตือน</span>
          <Button variant="ghost" size="sm" onClick={markAll} disabled={unread === 0}>
            <Check className="mr-1 h-4 w-4" /> อ่านทั้งหมด
          </Button>
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
              <p className="mt-1 font-medium">{r.title}</p>
              {r.body && <p className="text-xs text-muted-foreground">{r.body}</p>}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

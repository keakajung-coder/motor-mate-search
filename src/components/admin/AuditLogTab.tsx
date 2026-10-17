import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/data-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, RefreshCw } from "lucide-react";
import { AUDIT_ACTION_TH, type AuditRow } from "@/lib/audit";

/** ประวัติการแก้ไขข้อมูลทั้งระบบ */
export function AuditLogTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("audit_log")
      .select("id, table_name, record_id, action, actor, summary, changes, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    setRows((data ?? []) as AuditRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((r) =>
      `${r.table_name} ${r.summary ?? ""} ${r.actor} ${r.action}`.toLowerCase().includes(kw),
    );
  }, [rows, q]);

  return (
    <Card>
      <CardHeader className="gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" /> ประวัติการแก้ไขข้อมูล
        </CardTitle>
        <div className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
          <Input placeholder="ค้นหาในประวัติ" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="mr-1 h-4 w-4" /> รีเฟรช
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีประวัติ</p>
        ) : (
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
            {filtered.map((r) => (
              <li key={r.id} className="rounded-lg border p-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={r.action === "delete" ? "destructive" : "outline"}>
                    {AUDIT_ACTION_TH[r.action] ?? r.action}
                  </Badge>
                  <span className="font-medium">{r.table_name}</span>
                  <Badge variant="secondary">{r.actor === "admin" ? "แอดมิน" : "ผู้ใช้ทั่วไป"}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("th-TH-u-ca-buddhist")}
                  </span>
                </div>
                {r.summary && <p className="mt-1 text-muted-foreground">{r.summary}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

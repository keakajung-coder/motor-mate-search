import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BarChart3, Camera, FileDown, Loader2 } from "lucide-react";
import { splitNames } from "@/components/ui/multi-combobox";
import { elementToPdfBlobPaged, formatDate, saveFile } from "@/lib/report";

type Row = {
  id: string;
  customer_name: string | null;
  job_detail: string | null;
  staff_name: string | null;
  visit_date: string;
  visit_time: string | null;
  status: string;
  result: string | null;
};

const iso = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** สรุปงานรายวัน/รายเดือน + ภาระงานช่าง + ส่งออกภาพ/PDF */
export function JobReportsPanel({ onPickDate }: { onPickDate?: (date: string) => void }) {
  const [mode, setMode] = useState<"day" | "month">("day");
  const [day, setDay] = useState(iso(new Date()));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  const range = useMemo(() => {
    const d = new Date(day + "T00:00:00");
    if (mode === "day") return { from: day, to: day };
    const from = new Date(d.getFullYear(), d.getMonth(), 1);
    const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { from: iso(from), to: iso(to) };
  }, [day, mode]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("appointments")
      .select("id, customer_name, job_detail, staff_name, visit_date, visit_time, status, result")
      .gte("visit_date", range.from)
      .lte("visit_date", range.to)
      .order("visit_date")
      .order("visit_time");
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }, [range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  const done = rows.filter((r) => r.status === "closed");
  const pendingRows = rows.filter((r) => r.status !== "closed");
  const notOk = done.filter((r) => r.result === "not_ok").length;

  /** ภาระงานรายช่าง (นับแยกทุกชื่อในงานเดียวกัน) */
  const workload = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    for (const r of rows) {
      const names = splitNames(r.staff_name ?? "");
      for (const n of names.length ? names : ["ยังไม่ระบุช่าง"]) {
        const cur = map.get(n) ?? { total: 0, done: 0 };
        cur.total += 1;
        if (r.status === "closed") cur.done += 1;
        map.set(n, cur);
      }
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [rows]);

  const label = mode === "day" ? formatDate(day) : `${range.from} ถึง ${range.to}`;

  const exportReport = async (kind: "image" | "pdf") => {
    const el = ref.current;
    if (!el) return;
    setExporting(kind);
    try {
      if (kind === "pdf") {
        const blob = await elementToPdfBlobPaged(el, 1, { orientation: "portrait" });
        await saveFile(blob, `สรุปงาน-${range.from}.pdf`);
      } else {
        const { toPng } = await import("html-to-image");
        const dataUrl = await toPng(el, { backgroundColor: "#ffffff", cacheBust: true, pixelRatio: 2 });
        const blob = await (await fetch(dataUrl)).blob();
        await saveFile(blob, `สรุปงาน-${range.from}.png`);
      }
      toast.success("บันทึกรายงานเรียบร้อย");
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ: " + (e as Error).message);
    } finally {
      setExporting("");
    }
  };

  return (
    <Card>
      <CardHeader className="gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" /> รายงานสรุปงานบริการ
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {(["day", "month"] as const).map((m) => (
              <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>
                {m === "day" ? "รายวัน" : "รายเดือน"}
              </Button>
            ))}
          </div>
          <input
            type="date"
            aria-label="เลือกวันที่รายงาน"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={day}
            onChange={(e) => e.target.value && setDay(e.target.value)}
          />
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="outline" disabled={!!exporting} onClick={() => exportReport("image")}>
              {exporting === "image" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Camera className="mr-1 h-4 w-4" />}
              PNG
            </Button>
            <Button size="sm" variant="outline" disabled={!!exporting} onClick={() => exportReport("pdf")}>
              {exporting === "pdf" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />}
              PDF
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div ref={ref} className="space-y-4 bg-card p-1">
          <p className="text-sm font-semibold">สรุปงาน {mode === "day" ? "ประจำวัน" : "ประจำเดือน"} · {label}</p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="งานทั้งหมด" value={rows.length} />
            <Metric label="ปิดงานแล้ว" value={done.length} tone="ok" />
            <Metric label="ค้างอยู่" value={pendingRows.length} tone="warn" />
            <Metric label="ปิดงานไม่เรียบร้อย" value={notOk} tone="bad" />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">งานที่ยังค้าง (กดเพื่อไปยังวันนั้น)</p>
            {loading ? (
              <p className="text-xs text-muted-foreground">กำลังโหลด...</p>
            ) : pendingRows.length === 0 ? (
              <p className="text-xs text-muted-foreground">ไม่มีงานค้าง 🎉</p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto scrollbar-none">
                {pendingRows.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => onPickDate?.(r.visit_date)}
                      className="w-full rounded-lg border p-2 text-left text-xs hover:bg-accent/50"
                    >
                      <span className="font-semibold">{r.customer_name || "-"}</span>{" "}
                      <span className="text-muted-foreground">
                        {formatDate(r.visit_date)} {r.visit_time?.slice(0, 5) ?? ""}
                      </span>
                      <span className="block truncate text-muted-foreground">{r.job_detail || "-"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">ภาระงานรายช่าง</p>
            {workload.length === 0 ? (
              <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูล</p>
            ) : (
              <div className="space-y-1">
                {workload.map(([name, w]) => (
                  <div key={name} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs">
                    <span className="truncate">{name}</span>
                    <span className="flex shrink-0 gap-1">
                      <Badge variant="secondary">ทั้งหมด {w.total}</Badge>
                      <Badge className="bg-emerald-600 text-white">ปิดแล้ว {w.done}</Badge>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "bad" }) {
  const cls =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warn"
        ? "border-orange-200 bg-orange-50 text-orange-700"
        : tone === "bad"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-border bg-card text-foreground";
  return (
    <div className={"rounded-xl border p-3 text-center " + cls}>
      <p className="text-2xl font-bold leading-tight">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{label}</p>
    </div>
  );
}

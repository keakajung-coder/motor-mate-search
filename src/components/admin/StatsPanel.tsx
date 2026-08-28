import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { CollapsibleSection } from "@/components/CollapsibleSection";

type Row = {
  id: string;
  seller: string | null;
  status: string | null;
  data_complete: boolean | null;
  warranty_end: string | null;
  contract_service: boolean | null;
  compressor_models: { name: string | null; brands: { name: string | null } | null } | null;
};

/** แผงนับสถิติจำนวนเครื่องจักรแบบเรียลไทม์ */
export function StatsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("machine_units")
      .select(
        "id, seller, status, data_complete, warranty_end, contract_service, compressor_models ( name, brands ( name ) )",
      );
    setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // อัปเดตทันทีเมื่อมีการเพิ่ม/แก้ไข/ลบเครื่องจากที่ใดก็ตาม
  useEffect(() => {
    const ch = supabase
      .channel("machine_units_stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "machine_units" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const byModel = new Map<string, number>();
    const byStatus = new Map<string, number>();
    const bySeller = new Map<string, number>();
    let complete = 0;
    let warranty = 0;
    let contract = 0;
    for (const r of rows) {
      const model =
        [r.compressor_models?.brands?.name, r.compressor_models?.name].filter(Boolean).join(" ") ||
        "ไม่ระบุรุ่น";
      byModel.set(model, (byModel.get(model) ?? 0) + 1);
      const st = (r.status ?? "").trim() || "ไม่ระบุสถานะ";
      byStatus.set(st, (byStatus.get(st) ?? 0) + 1);
      const sl = (r.seller ?? "").trim() || "ไม่ระบุผู้ขาย";
      bySeller.set(sl, (bySeller.get(sl) ?? 0) + 1);
      if (r.data_complete) complete++;
      if (r.warranty_end && r.warranty_end >= today) warranty++;
      if (r.contract_service) contract++;
    }
    const sort = (m: Map<string, number>) =>
      Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    return {
      total: rows.length,
      complete,
      incomplete: rows.length - complete,
      warranty,
      contract,
      byModel: sort(byModel),
      byStatus: sort(byStatus),
      bySeller: sort(bySeller),
    };
  }, [rows]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">📊 บอร์ดนับสถิติจำนวนรวมเรียลไทม์</CardTitle>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="ปั๊มลมทั้งหมด" value={stats.total} tone="primary" />
          <Stat label="ข้อมูลครบถ้วน (เขียว)" value={stats.complete} tone="green" />
          <Stat label="ข้อมูลไม่ครบ (แดง)" value={stats.incomplete} tone="red" />
          <Stat label="อยู่ในระยะประกัน" value={stats.warranty} tone="blue" />
          <Stat label="ติดสัญญาบริการ" value={stats.contract} tone="amber" />
        </div>

        <Breakdown title={`แยกตามยี่ห้อ/รุ่นเครื่อง (${stats.byModel.length} รุ่น)`} items={stats.byModel} />
        <Breakdown title={`แยกตามป้ายสถานะปิดงาน (${stats.byStatus.length} สถานะ)`} items={stats.byStatus} />
        <Breakdown title={`แยกตามพนักงานขาย / เซลล์ (${stats.bySeller.length} คน)`} items={stats.bySeller} />
      </CardContent>
    </Card>
  );
}

const TONES: Record<string, string> = {
  primary: "border-primary/40 bg-primary/10 text-primary",
  green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  red: "border-orange-500/40 bg-orange-500/10 text-orange-700",
  blue: "border-sky-500/40 bg-sky-500/10 text-sky-700",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-700",
};

function Stat({ label, value, tone }: { label: string; value: number; tone: keyof typeof TONES }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${TONES[tone]}`}>
      <div className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
      <div className="text-[11px] leading-tight opacity-80">{label}</div>
    </div>
  );
}

function Breakdown({ title, items }: { title: string; items: [string, number][] }) {
  if (items.length === 0) return null;
  return (
    <CollapsibleSection title={title} subtitle="ยอดนับรวมจากฐานข้อมูลล่าสุด">
      <div className="flex flex-wrap gap-2">
        {items.map(([name, n]) => (
          <span
            key={name}
            className="rounded-full border bg-card px-3 py-1 text-xs"
          >
            {name} <span className="font-semibold text-primary">{n}</span>
          </span>
        ))}
      </div>
    </CollapsibleSection>
  );
}

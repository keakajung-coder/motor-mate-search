import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/data-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ChevronDown, X } from "lucide-react";
import { CollapsibleSection } from "@/components/CollapsibleSection";

type Row = {
  id: string;
  serial_number?: string | null;
  seller: string | null;
  status: string | null;
  data_complete: boolean | null;
  warranty_end: string | null;
  contract_service: boolean | null;
  compressor_models: { name: string | null; brands: { name: string | null } | null } | null;
};

type FieldKey = "model" | "status" | "seller";
const FIELDS: { key: FieldKey; label: string }[] = [
  { key: "model", label: "ยี่ห้อ / รุ่นเครื่อง" },
  { key: "status", label: "ป้ายสถานะปิดงาน" },
  { key: "seller", label: "พนักงานขาย / เซลล์" },
];

const modelOf = (r: Row) =>
  [r.compressor_models?.brands?.name, r.compressor_models?.name].filter(Boolean).join(" ") || "ไม่ระบุรุ่น";
const statusOf = (r: Row) => (r.status ?? "").trim() || "ไม่ระบุสถานะ";
const sellerOf = (r: Row) => (r.seller ?? "").trim() || "ไม่ระบุผู้ขาย";
const VALUE_OF: Record<FieldKey, (r: Row) => string> = { model: modelOf, status: statusOf, seller: sellerOf };

/** แผงนับสถิติจำนวนเครื่องจักรแบบเรียลไทม์ + เปิด/ปิด เลือกฟิลด์ และคลิกกรองข้อมูลได้ */
export function StatsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [fields, setFields] = useState<FieldKey[]>(["model", "status", "seller"]);
  const [filters, setFilters] = useState<Partial<Record<FieldKey, string>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("machine_units")
      .select(
        "id, serial_number, seller, status, data_complete, warranty_end, contract_service, compressor_models ( name, brands ( name ) )",
      );
    setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("app:connection-restored", load);
    return () => window.removeEventListener("app:connection-restored", load);
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

  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        (Object.entries(filters) as [FieldKey, string][]).every(([k, v]) => !v || VALUE_OF[k](r) === v),
      ),
    [rows, filters],
  );

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const count = (fn: (r: Row) => string) => {
      const m = new Map<string, number>();
      for (const r of filtered) m.set(fn(r), (m.get(fn(r)) ?? 0) + 1);
      return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    };
    let complete = 0;
    let warranty = 0;
    let contract = 0;
    for (const r of filtered) {
      if (r.data_complete) complete++;
      if (r.warranty_end && r.warranty_end >= today) warranty++;
      if (r.contract_service) contract++;
    }
    return {
      total: filtered.length,
      complete,
      incomplete: filtered.length - complete,
      warranty,
      contract,
      model: count(modelOf),
      status: count(statusOf),
      seller: count(sellerOf),
    };
  }, [filtered]);

  const activeFilters = (Object.entries(filters) as [FieldKey, string][]).filter(([, v]) => v);

  const toggleField = (k: FieldKey) =>
    setFields((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k]));

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 space-y-0 lg:flex-row lg:items-center lg:justify-between">
        <CardTitle className="text-sm sm:text-base">📊 บอร์ดนับสถิติจำนวนรวมเรียลไทม์</CardTitle>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
            {open ? "ซ่อนบอร์ด" : "แสดงบอร์ด"}
            <ChevronDown className={"ml-1 h-4 w-4 transition-transform " + (open ? "rotate-180" : "")} />
          </Button>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">เลือกฟิลด์ที่ต้องการแสดง:</span>
            {FIELDS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleField(f.key)}
                className={
                  "rounded-full border px-3 py-1 text-xs transition-colors " +
                  (fields.includes(f.key)
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent")
                }
              >
                {fields.includes(f.key) ? "✓ " : ""}
                {f.label}
              </button>
            ))}
          </div>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">กำลังกรอง:</span>
              {activeFilters.map(([k, v]) => (
                <Badge key={k} className="gap-1">
                  {v}
                  <button type="button" onClick={() => setFilters((f) => ({ ...f, [k]: undefined }))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setFilters({})}>
                ล้างตัวกรองทั้งหมด
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 lg:grid-cols-5">
            <Stat label="ปั๊มลมทั้งหมด" value={stats.total} tone="primary" />
            <Stat label="ข้อมูลครบถ้วน (เขียว)" value={stats.complete} tone="green" />
            <Stat label="ข้อมูลไม่ครบ (แดง)" value={stats.incomplete} tone="red" />
            <Stat label="อยู่ในระยะประกัน" value={stats.warranty} tone="blue" />
            <Stat label="ติดสัญญาบริการ" value={stats.contract} tone="amber" />
          </div>

          {FIELDS.filter((f) => fields.includes(f.key)).map((f) => (
            <Breakdown
              key={f.key}
              title={`แยกตาม${f.label} (${stats[f.key].length} รายการ)`}
              items={stats[f.key]}
              active={filters[f.key] ?? null}
              onPick={(name) =>
                setFilters((s) => ({ ...s, [f.key]: s[f.key] === name ? undefined : name }))
              }
            />
          ))}
        </CardContent>
      )}
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
      <div className="text-xl font-bold tabular-nums sm:text-2xl">{value.toLocaleString()}</div>
      <div className="text-[11px] leading-tight opacity-80 sm:text-xs">{label}</div>
    </div>
  );
}

function Breakdown({
  title,
  items,
  active,
  onPick,
}: {
  title: string;
  items: [string, number][];
  active: string | null;
  onPick: (name: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <CollapsibleSection title={title} subtitle="แตะที่รายการเพื่อกรองข้อมูลทั้งบอร์ด">
      <div className="flex flex-wrap gap-2">
        {items.map(([name, n]) => (
          <button
            key={name}
            type="button"
            onClick={() => onPick(name)}
            className={
              "rounded-full border px-3 py-1 text-xs transition-colors " +
              (active === name ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-accent")
            }
          >
            {name} <span className="font-semibold text-primary">{n}</span>
          </button>
        ))}
      </div>
    </CollapsibleSection>
  );
}

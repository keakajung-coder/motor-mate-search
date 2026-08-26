import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Search, Package, CalendarDays, Brain, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useIssues } from "@/components/TroubleshootPanel";

type Mode = "parts" | "planner" | "issue";

type UnitLite = {
  id: string;
  serial_number: string;
  seller: string | null;
  status: string | null;
  customers: { name: string | null } | null;
  compressor_models: { name: string | null; brands: { name: string | null } | null } | null;
};

type ApptLite = {
  id: string;
  customer_name: string | null;
  serial_number: string | null;
  service_type: string | null;
  visit_date: string;
  visit_time: string | null;
  vehicle_plate: string | null;
};

/** ระยะห่างคำแบบง่าย (Levenshtein) สำหรับดักคำพิมพ์ผิด */
function distance(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/** คะแนนความใกล้เคียง: 0 = ตรงเป๊ะ ยิ่งน้อยยิ่งใกล้ */
export function fuzzyScore(text: string, kw: string): number | null {
  const t = text.toLowerCase();
  const k = kw.toLowerCase();
  if (!k) return 0;
  if (t.includes(k)) return 0;
  let best: number | null = null;
  for (const word of t.split(/[\s•·|/,-]+/).filter(Boolean)) {
    const d = distance(word, k);
    const limit = Math.max(1, Math.floor(k.length / 3) + 1);
    if (d <= limit) best = best == null ? d : Math.min(best, d);
  }
  const dAll = distance(t, k);
  if (dAll <= Math.max(2, Math.floor(k.length / 2))) best = best == null ? dAll : Math.min(best, dAll);
  return best;
}

export function SmartSearchDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (p: { text: string; seller: string | null; status: string | null }) => void;
}) {
  const [mode, setMode] = useState<Mode>("parts");
  const [text, setText] = useState("");
  const [seller, setSeller] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [units, setUnits] = useState<UnitLite[]>([]);
  const [appts, setAppts] = useState<ApptLite[]>([]);
  const [loading, setLoading] = useState(false);
  const { issues } = useIssues("published");

  useEffect(() => {
    if (!open || units.length > 0) return;
    setLoading(true);
    (async () => {
      const [u, a] = await Promise.all([
        supabase
          .from("machine_units")
          .select(
            "id, serial_number, seller, status, customers ( name ), compressor_models ( name, brands ( name ) )",
          )
          .order("serial_number"),
        supabase
          .from("appointments")
          .select("id, customer_name, serial_number, service_type, visit_date, visit_time, vehicle_plate")
          .order("visit_date", { ascending: false }),
      ]);
      setUnits((u.data as unknown as UnitLite[]) ?? []);
      setAppts((a.data as unknown as ApptLite[]) ?? []);
      setLoading(false);
    })();
  }, [open]);

  const sellers = useMemo(
    () =>
      Array.from(new Set(units.map((u) => (u.seller ?? "").trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "th"),
      ),
    [units],
  );
  const statuses = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of units) {
      const s = (u.status ?? "").trim() || "ไม่ระบุสถานะ";
      m.set(s, (m.get(s) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [units]);

  const kw = text.trim();

  const unitResults = useMemo(() => {
    const rows = units.filter((u) => {
      if (seller && (u.seller ?? "").trim() !== seller) return false;
      if (status && ((u.status ?? "").trim() || "ไม่ระบุสถานะ") !== status) return false;
      return true;
    });
    if (!kw) return rows.slice(0, 12).map((u) => ({ u, score: 0 }));
    return rows
      .map((u) => {
        const hay = `${u.serial_number} ${u.customers?.name ?? ""} ${u.compressor_models?.brands?.name ?? ""} ${u.compressor_models?.name ?? ""} ${u.seller ?? ""}`;
        return { u, score: fuzzyScore(hay, kw) };
      })
      .filter((r) => r.score != null)
      .sort((a, b) => (a.score as number) - (b.score as number))
      .slice(0, 12) as { u: UnitLite; score: number }[];
  }, [units, kw, seller, status]);

  const apptResults = useMemo(() => {
    if (!kw) return appts.slice(0, 10);
    return appts
      .map((a) => ({
        a,
        score: fuzzyScore(
          `${a.customer_name ?? ""} ${a.serial_number ?? ""} ${a.vehicle_plate ?? ""} ${a.service_type ?? ""}`,
          kw,
        ),
      }))
      .filter((r) => r.score != null)
      .sort((x, y) => (x.score as number) - (y.score as number))
      .slice(0, 10)
      .map((r) => r.a);
  }, [appts, kw]);

  const issueResults = useMemo(() => {
    if (!kw) return issues.slice(0, 6);
    return issues
      .map((i) => ({ i, score: fuzzyScore(`${i.title} ${i.keywords ?? ""}`, kw) }))
      .filter((r) => r.score != null)
      .sort((x, y) => (x.score as number) - (y.score as number))
      .map((r) => r.i);
  }, [issues, kw]);

  const confirm = () => {
    onConfirm({ text: kw, seller, status });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>🔍 ค้นหาทางลัดอัจฉริยะ</DialogTitle>
          <DialogDescription>เลือกโหมดก่อน แล้วพิมพ์คำค้นหา ระบบดักคำพิมพ์ผิดให้อัตโนมัติ</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { k: "parts", label: "⚙️ ค้นหาอะไหล่", icon: Package },
              { k: "planner", label: "📅 ตารางนัดหมาย", icon: CalendarDays },
              { k: "issue", label: "🧠 อาการ/ปัญหา", icon: Brain },
            ] as const
          ).map((m) => (
            <button
              key={m.k}
              type="button"
              onClick={() => setMode(m.k)}
              className={
                "rounded-lg border px-2 py-2 text-xs font-medium transition-colors " +
                (mode === m.k ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent")
              }
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirm()}
              placeholder={
                mode === "issue"
                  ? "พิมพ์อาการเสีย เช่น ลมไม่ขึ้น, ร้อนจัด"
                  : "พิมพ์ชื่อลูกค้า, S/N, รุ่น หรืออะไหล่"
              }
              className="h-12 pl-9 text-base"
            />
          </div>
          <Button className="h-12 px-5" onClick={confirm}>
            ตกลง
          </Button>
        </div>

        {mode === "parts" && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">เซลล์ผู้ขาย:</span>
              <Chip active={seller === null} onClick={() => setSeller(null)}>
                ทั้งหมด
              </Chip>
              {sellers.map((s) => (
                <Chip key={s} active={seller === s} onClick={() => setSeller(seller === s ? null : s)}>
                  {s}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">ป้ายสถานะ:</span>
              <Chip active={status === null} onClick={() => setStatus(null)}>
                ทั้งหมด ({units.length})
              </Chip>
              {statuses.map(([s, n]) => (
                <Chip key={s} active={status === s} onClick={() => setStatus(status === s ? null : s)}>
                  {s} ({n})
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2 rounded-xl border bg-muted/30 p-2">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : mode === "parts" ? (
            unitResults.length === 0 ? (
              <Empty />
            ) : (
              unitResults.map(({ u, score }) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    onConfirm({ text: u.serial_number, seller, status });
                    onOpenChange(false);
                  }}
                  className="block w-full rounded-lg bg-card px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{u.customers?.name ?? "-"}</span>
                    <Badge variant="outline">{u.serial_number}</Badge>
                    {score > 0 && <Badge variant="secondary">ใกล้เคียง</Badge>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[u.compressor_models?.brands?.name, u.compressor_models?.name, u.seller, u.status]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>
                </button>
              ))
            )
          ) : mode === "planner" ? (
            apptResults.length === 0 ? (
              <Empty />
            ) : (
              apptResults.map((a) => (
                <Link
                  key={a.id}
                  to="/planner"
                  onClick={() => onOpenChange(false)}
                  className="block rounded-lg bg-card px-3 py-2 text-sm hover:bg-accent"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{a.visit_date}</Badge>
                    <span className="font-semibold">{a.customer_name ?? "-"}</span>
                    {a.vehicle_plate && <Badge variant="secondary">{a.vehicle_plate}</Badge>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[a.service_type, a.serial_number, a.visit_time].filter(Boolean).join(" • ")}
                  </div>
                </Link>
              ))
            )
          ) : issueResults.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              ไม่พบอาการนี้ในคลัง — กด “ตกลง” เพื่อไปที่แผงอาการหน้าแรกและส่งต่อให้แอดมิน (AI ร่างคำตอบ)
            </div>
          ) : (
            issueResults.map((i) => (
              <div key={i.id} className="space-y-1 rounded-lg bg-card px-3 py-2 text-sm">
                <div className="font-semibold">{i.title}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded bg-muted/50 p-2 text-xs">
                    <div className="mb-1 font-medium">วิธีการตรวจสอบ</div>
                    <pre className="whitespace-pre-wrap font-sans leading-relaxed">{i.check_steps ?? "-"}</pre>
                  </div>
                  <div className="rounded bg-primary/10 p-2 text-xs">
                    <div className="mb-1 font-medium">วิธีการแก้ไข</div>
                    <pre className="whitespace-pre-wrap font-sans leading-relaxed">{i.fix_steps ?? "-"}</pre>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Empty() {
  return <div className="px-3 py-4 text-sm text-muted-foreground">ไม่พบข้อมูลที่ตรงกับคำค้นหา</div>;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1 text-xs transition-colors " +
        (active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")
      }
    >
      {children}
    </button>
  );
}

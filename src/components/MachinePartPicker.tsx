import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/data-client";
import { splitGenuineCrossRef, type PartPickRow } from "@/lib/parts-search";
import { linkedPartCatalog, partLine, type MachinePartLink } from "@/lib/machine-part-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus } from "lucide-react";

export function MachinePartPicker({ serialNumber, onSelect }: { serialNumber?: string | null; onSelect: (lines: string[]) => void }) {
  const [products, setProducts] = useState<PartPickRow[]>([]);
  const [links, setLinks] = useState<MachinePartLink[]>([]);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision(v => v + 1);
    window.addEventListener("app:data-changed", refresh);
    return () => window.removeEventListener("app:data-changed", refresh);
  }, []);
  useEffect(() => {
    let alive = true;
    setBusy(true); setError(""); setPicked([]);
    void (async () => {
      try {
        const [p, m] = await Promise.all([
          supabase.from("products").select("id, name, part_number, cross_reference_parts, supported_serials"),
          supabase.from("machine_parts").select("product_id, machine_unit_id, cross_reference_parts, substitution_note, machine_units(serial_number)"),
        ]);
        if (p.error) throw p.error;
        if (m.error) throw m.error;
        if (!alive) return;
        const serials = (serialNumber ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
        setProducts((p.data ?? []) as PartPickRow[]);
        setLinks(((m.data ?? []) as MachinePartLink[]).filter(l => serials.includes((l.machine_units?.serial_number ?? "").toLowerCase())));
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : "โหลดอะไหล่ไม่สำเร็จ"); }
      finally { if (alive) setBusy(false); }
    })();
    return () => { alive = false; };
  }, [serialNumber, revision]);
  const groups = useMemo(() => splitGenuineCrossRef(linkedPartCatalog(products, links), {
    keyword: query, serials: (serialNumber ?? "").split(",").map(s => s.trim()),
    linkedProductIds: query ? [] : links.flatMap(l => l.product_id ? [l.product_id] : []),
  }), [products, links, query, serialNumber]);
  const options = [...groups.genuine.map(p => ({ p, kind: "แท้" as const })), ...groups.crossRef.map(p => ({ p, kind: "เทียบ" as const }))];
  return <div className="space-y-2">
    <Input aria-label="ค้นหาอะไหล่แท้หรือเทียบ" placeholder="ค้นหารหัสพาร์ทหลัก / พาร์ทเทียบ" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); } }} />
    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : error ? <div className="text-sm text-destructive">{error}<Button type="button" variant="ghost" onClick={() => setRevision(v => v + 1)}>ลองอีกครั้ง</Button></div> :
      <div className="force-scrollbar max-h-56 space-y-3 overflow-y-auto">
        {([ ["อะไหล่แท้ / รายการประจำเครื่อง", groups.genuine, "แท้"], ["อะไหล่เทียบ / พาร์ททดแทน", groups.crossRef, "เทียบ"] ] as const).map(([title, rows, kind]) => <div key={kind}>
          <p className="text-sm font-semibold">{title}</p>
          {rows.length === 0 && <p className="text-xs text-muted-foreground">ไม่มีรายการ</p>}
          {rows.map(p => <label key={p.id} className="flex items-center gap-2 py-1 text-sm"><Checkbox checked={picked.includes(p.id)} onCheckedChange={checked => setPicked(v => checked ? [...v, p.id] : v.filter(id => id !== p.id))} />{partLine(p, kind)}</label>)}
        </div>)}
        {links.filter(l => l.substitution_note).map((l, i) => <p key={i} className="text-xs text-muted-foreground">{l.substitution_note}</p>)}
      </div>}
    <Button type="button" variant="outline" disabled={!picked.length || busy} onClick={() => { onSelect(options.filter(o => picked.includes(o.p.id)).map(o => partLine(o.p, o.kind))); setPicked([]); }}><Plus className="mr-1 h-4 w-4" />เพิ่มรายการที่เลือกลงใบงาน</Button>
  </div>;
}
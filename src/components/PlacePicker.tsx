import { useEffect, useRef, useState } from "react";
import { MapPin, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchPlaces, getPlaceDetails, type PlaceHit } from "@/lib/maps.functions";
import type { PlaceAddress } from "@/lib/place-address";

export function PlacePicker({ onPick }: { onPick: (p: PlaceAddress) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);

  async function run(query: string) {
    if (query.trim().length < 2) return;
    const id = ++seq.current;
    setLoading(true);
    try {
      const r = await searchPlaces({ data: { query } });
      if (id === seq.current) { setHits(r); setOpen(true); }
    } catch (e: any) {
      if (id === seq.current) toast.error(e?.message ?? "ค้นหาไม่สำเร็จ");
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (q.trim().length < 3) { setHits([]); return; }
    const t = setTimeout(() => run(q), 500);
    return () => clearTimeout(t);
  }, [q]);

  async function pick(h: PlaceHit) {
    setOpen(false);
    setLoading(true);
    try {
      const d = await getPlaceDetails({ data: { placeId: h.id } });
      onPick(d);
      setQ(h.name);
      toast.success("ดึงที่อยู่จาก Google Maps แล้ว");
    } catch (e: any) {
      toast.error(e?.message ?? "ดึงข้อมูลสถานที่ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <Input
          value={q}
          placeholder="ค้นหาหมุดจาก Google Maps เช่น ชื่อบริษัท สาขา"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); run(q); } }}
        />
        <Button type="button" variant="outline" onClick={() => run(q)} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>
      {open && (
        <div className="dropdown-scroll absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {hits.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">ไม่พบสถานที่</p>
          ) : (
            hits.map((h) => (
              <button
                key={h.id}
                type="button"
                className="flex w-full items-start gap-2 border-b p-2 text-left text-sm last:border-0 hover:bg-accent"
                onClick={() => pick(h)}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span><span className="font-medium">{h.name}</span><br /><span className="text-xs text-muted-foreground">{h.address}</span></span>
              </button>
            ))
          )}
          <button type="button" className="w-full p-2 text-xs text-muted-foreground hover:bg-accent" onClick={() => setOpen(false)}>ปิด</button>
        </div>
      )}
    </div>
  );
}

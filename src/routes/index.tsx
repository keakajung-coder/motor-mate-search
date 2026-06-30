import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ค้นหาอะไหล่ด้วย S/N เครื่อง" },
      { name: "description", content: "พิมพ์ Serial Number เครื่องเพื่อค้นหารายการอะไหล่" },
    ],
  }),
  component: SearchPage,
});

type MachinePart = {
  id: string;
  quantity: number;
  note: string | null;
  products: {
    id: string;
    name: string;
    part_number: string;
    price: number | null;
    image_url: string | null;
    category_id: string | null;
    categories: { id: string; name: string; sort_order: number | null } | null;
  } | null;
};

type MachineResult = {
  id: string;
  serial_number: string;
  install_date: string | null;
  note: string | null;
  customers: { id: string; name: string; phone: string | null } | null;
  compressor_models:
    | { id: string; name: string; brands: { id: string; name: string } | null }
    | null;
  machine_parts: MachinePart[];
};

function SearchPage() {
  const [sn, setSn] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MachineResult | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!sn.trim()) return;
    setLoading(true);
    setSearched(true);
    const { data, error } = await supabase
      .from("machine_units")
      .select(
        `id, serial_number, install_date, note,
         customers ( id, name, phone ),
         compressor_models ( id, name, brands ( id, name ) ),
         machine_parts (
           id, quantity, note,
           products (
             id, name, part_number, price, image_url, category_id,
             categories ( id, name, sort_order )
           )
         )`
      )
      .ilike("serial_number", sn.trim())
      .maybeSingle();
    setLoading(false);
    if (error) {
      toast.error("ค้นหาผิดพลาด: " + error.message);
      return;
    }
    setResult(data as MachineResult | null);
    if (!data) toast.message("ไม่พบเครื่องที่มี S/N นี้");
  }

  const grouped = groupByCategory(result?.machine_parts ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ค้นหาอะไหล่ด้วย S/N เครื่อง</h1>
        <p className="text-sm text-muted-foreground">พิมพ์ Serial Number ของเครื่องปั๊มลมเพื่อดูรายการอะไหล่</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="กรอก S/N เครื่อง เช่น GA37-2023-001"
          value={sn}
          onChange={(e) => setSn(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-2">ค้นหา</span>
        </Button>
      </form>

      {searched && !loading && !result && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            ไม่พบเครื่องที่มี S/N นี้ในระบบ
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลเครื่อง</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Info label="S/N" value={result.serial_number} />
              <Info
                label="รุ่นเครื่อง"
                value={
                  result.compressor_models
                    ? `${result.compressor_models.brands?.name ?? ""} ${result.compressor_models.name}`.trim()
                    : "-"
                }
              />
              <Info label="ลูกค้า" value={result.customers?.name ?? "-"} />
              <Info label="เบอร์โทร" value={result.customers?.phone ?? "-"} />
              {result.install_date && <Info label="วันที่ติดตั้ง" value={result.install_date} />}
              {result.note && <Info label="หมายเหตุ" value={result.note} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" /> รายการอะไหล่ ({result.machine_parts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {grouped.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีรายการอะไหล่สำหรับเครื่องนี้</p>
              ) : (
                <div className="space-y-6">
                  {grouped.map((g) => (
                    <div key={g.name}>
                      <h3 className="mb-2 text-sm font-semibold text-primary">{g.name}</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {g.items.map((mp) => (
                          <div
                            key={mp.id}
                            className="flex gap-3 rounded-lg border bg-card p-3"
                          >
                            {mp.products?.image_url ? (
                              <img
                                src={mp.products.image_url}
                                alt={mp.products.name}
                                className="h-16 w-16 rounded object-cover"
                              />
                            ) : (
                              <div className="flex h-16 w-16 items-center justify-center rounded bg-muted">
                                <Package className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="font-medium">{mp.products?.name}</div>
                              <div className="text-xs text-muted-foreground">
                                Part#: {mp.products?.part_number}
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                <Badge variant="secondary">จำนวน {mp.quantity}</Badge>
                                {mp.products?.price != null && (
                                  <span className="text-xs text-muted-foreground">
                                    ฿{Number(mp.products.price).toLocaleString()}
                                  </span>
                                )}
                              </div>
                              {mp.note && (
                                <div className="mt-1 text-xs text-muted-foreground">{mp.note}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function groupByCategory(parts: MachinePart[]) {
  const map = new Map<string, { name: string; sort: number; items: MachinePart[] }>();
  for (const p of parts) {
    const cat = p.products?.categories;
    const key = cat?.id ?? "__none__";
    const name = cat?.name ?? "อื่นๆ";
    const sort = cat?.sort_order ?? 999;
    if (!map.has(key)) map.set(key, { name, sort, items: [] });
    map.get(key)!.items.push(p);
  }
  return Array.from(map.values()).sort((a, b) => a.sort - b.sort);
}

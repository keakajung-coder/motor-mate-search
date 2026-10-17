import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/data-client";
import { deleteAsAdmin } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useBundles, type PartBundle } from "@/lib/bundles";
import { Loader2, Plus, Trash2, PackagePlus } from "lucide-react";
import { toast } from "sonner";

type Product = { id: string; name: string; part_number: string };

/** แท็บจัดการ "ชุดอะไหล่" — แอดมินสร้างชุดสำเร็จรูปให้ผู้ใช้เลือกลงเครื่องได้ทีเดียว */
export function BundlesTab() {
  const { bundles, loading, reload } = useBundles();
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase
      .from("products")
      .select("id, name, part_number")
      .order("part_number")
      .then(({ data }) => setProducts((data as Product[]) ?? []));
  }, []);

  const create = async () => {
    const n = name.trim();
    if (!n) return toast.error("ใส่ชื่อชุดอะไหล่ก่อน");
    setBusy(true);
    const { error } = await supabase.from("part_bundles").insert({ name: n, description: desc.trim() || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    setName("");
    setDesc("");
    toast.success("สร้างชุดอะไหล่แล้ว");
    void reload();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">➕ สร้างชุดอะไหล่ใหม่</CardTitle>
        </CardHeader>
        <CardContent className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-1">
            <Label className="text-xs">ชื่อชุด เช่น "ชุดเช็ค 2,000 ชม."</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">คำอธิบาย (ไม่บังคับ)</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <Button onClick={create} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />} สร้างชุด
          </Button>
        </CardContent>
      </Card>

      {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {bundles.map((b) => (
        <BundleEditor key={b.id} bundle={b} products={products} onChanged={reload} />
      ))}
      {!loading && bundles.length === 0 && (
        <p className="text-sm text-muted-foreground">ยังไม่มีชุดอะไหล่ — สร้างชุดแรกด้านบนได้เลย</p>
      )}
    </div>
  );
}

function BundleEditor({
  bundle,
  products,
  onChanged,
}: {
  bundle: PartBundle;
  products: Product[];
  onChanged: () => void;
}) {
  const [pick, setPick] = useState("");
  const [qty, setQty] = useState("1");

  const byLabel = useMemo(() => {
    const m = new Map<string, Product>();
    products.forEach((p) => m.set(`${p.part_number} — ${p.name}`, p));
    return m;
  }, [products]);

  const addItem = async () => {
    const p = byLabel.get(pick.trim());
    if (!p) return toast.error("เลือกอะไหล่จากรายการก่อน");
    const { error } = await supabase
      .from("part_bundle_items")
      .upsert(
        { bundle_id: bundle.id, product_id: p.id, quantity: Math.max(1, Number(qty) || 1) },
        { onConflict: "bundle_id,product_id" },
      );
    if (error) return toast.error(error.message);
    setPick("");
    setQty("1");
    onChanged();
  };

  const removeItem = async (productId: string) => {
    const { error } = await deleteAsAdmin("part_bundle_items", {
      bundle_id: bundle.id,
      product_id: productId,
    });
    if (error) return toast.error(error.message);
    onChanged();
  };

  const removeBundle = async () => {
    const { error } = await deleteAsAdmin("part_bundles", { id: bundle.id });
    if (error) return toast.error(error.message);
    toast.success("ลบชุดอะไหล่แล้ว");
    onChanged();
  };

  return (
    <Card>
        <CardHeader className="flex flex-col gap-2 space-y-0 lg:flex-row lg:items-center lg:justify-between">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <PackagePlus className="h-4 w-4 text-primary" />
          {bundle.name}
          <Badge variant="secondary">{bundle.items.length} รายการ</Badge>
        </CardTitle>
        <ConfirmButton onConfirm={removeBundle} variant="outline">
          <Trash2 className="mr-1 h-4 w-4" /> ลบชุด
        </ConfirmButton>
      </CardHeader>
      <CardContent className="space-y-3">
        {bundle.description && <p className="text-xs text-muted-foreground">{bundle.description}</p>}
        <div className="flex flex-wrap gap-2">
          {bundle.items.map((it) => (
            <span key={it.product_id} className="flex items-center gap-1 rounded-full border bg-card px-3 py-1 text-xs">
              {it.part_number} · {it.name} × {it.quantity}
              <button type="button" className="text-destructive" onClick={() => removeItem(it.product_id)}>
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_6rem_auto] lg:items-end">
          <div className="space-y-1">
            <Label className="text-xs">เพิ่มอะไหล่เข้าชุด (พิมพ์ค้นหาได้)</Label>
            <Input list={`prod-${bundle.id}`} value={pick} onChange={(e) => setPick(e.target.value)} />
            <datalist id={`prod-${bundle.id}`}>
              {products.map((p) => (
                <option key={p.id} value={`${p.part_number} — ${p.name}`} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">จำนวน</Label>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <Button variant="secondary" onClick={addItem}>
            <Plus className="mr-1 h-4 w-4" /> เพิ่ม
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

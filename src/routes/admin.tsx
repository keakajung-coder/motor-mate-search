import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "จัดการข้อมูล - อะไหล่ปั๊มลม" }] }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">จัดการข้อมูล</h1>
      <Tabs defaultValue="machines">
        <TabsList className="flex-wrap">
          <TabsTrigger value="machines">เครื่อง & อะไหล่</TabsTrigger>
          <TabsTrigger value="customers">ลูกค้า</TabsTrigger>
          <TabsTrigger value="products">สินค้า/อะไหล่</TabsTrigger>
          <TabsTrigger value="brands">ยี่ห้อ</TabsTrigger>
          <TabsTrigger value="models">รุ่นเครื่อง</TabsTrigger>
        </TabsList>
        <TabsContent value="machines"><MachinesTab /></TabsContent>
        <TabsContent value="customers"><CustomersTab /></TabsContent>
        <TabsContent value="products"><ProductsTab /></TabsContent>
        <TabsContent value="brands"><BrandsTab /></TabsContent>
        <TabsContent value="models"><ModelsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Brands ----------
function BrandsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");

  async function load() {
    const { data } = await supabase.from("brands").select("*").order("name");
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("brands").insert({ name: name.trim() });
    if (error) return toast.error(error.message);
    setName("");
    toast.success("เพิ่มยี่ห้อแล้ว");
    load();
  }
  async function del(id: string) {
    if (!confirm("ลบยี่ห้อนี้?")) return;
    const { error } = await supabase.from("brands").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <Card>
      <CardHeader><CardTitle>ยี่ห้อปั๊มลม</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder="ชื่อยี่ห้อ เช่น Atlas Copco" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={add}><Plus className="h-4 w-4" /></Button>
        </div>
        <ul className="divide-y rounded border">
          {items.map((b) => (
            <li key={b.id} className="flex items-center justify-between px-3 py-2">
              <span>{b.name}</span>
              <Button size="sm" variant="ghost" onClick={() => del(b.id)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
          {items.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">ยังไม่มีข้อมูล</li>}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---------- Models ----------
function ModelsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState("");

  async function load() {
    const [m, b] = await Promise.all([
      supabase.from("compressor_models").select("*, brands(name)").order("name"),
      supabase.from("brands").select("*").order("name"),
    ]);
    setItems(m.data ?? []);
    setBrands(b.data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim() || !brandId) return toast.error("กรอกชื่อรุ่นและเลือกยี่ห้อ");
    const { error } = await supabase.from("compressor_models").insert({ name: name.trim(), brand_id: brandId });
    if (error) return toast.error(error.message);
    setName("");
    toast.success("เพิ่มรุ่นแล้ว");
    load();
  }
  async function del(id: string) {
    if (!confirm("ลบรุ่นนี้?")) return;
    await supabase.from("compressor_models").delete().eq("id", id);
    load();
  }

  return (
    <Card>
      <CardHeader><CardTitle>รุ่นเครื่อง</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Select value={brandId} onValueChange={setBrandId}>
            <SelectTrigger><SelectValue placeholder="เลือกยี่ห้อ" /></SelectTrigger>
            <SelectContent>
              {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="ชื่อรุ่น เช่น GA37" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={add}><Plus className="h-4 w-4" /></Button>
        </div>
        <ul className="divide-y rounded border">
          {items.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-3 py-2">
              <span>{m.brands?.name} - {m.name}</span>
              <Button size="sm" variant="ghost" onClick={() => del(m.id)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
          {items.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">ยังไม่มีข้อมูล</li>}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---------- Customers ----------
function CustomersTab() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });

  async function load() {
    const { data } = await supabase.from("customers").select("*").order("name");
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.name.trim()) return toast.error("กรอกชื่อลูกค้า");
    const { error } = await supabase.from("customers").insert({
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
    });
    if (error) return toast.error(error.message);
    setForm({ name: "", phone: "", address: "" });
    toast.success("เพิ่มลูกค้าแล้ว");
    load();
  }
  async function del(id: string) {
    if (!confirm("ลบลูกค้านี้?")) return;
    await supabase.from("customers").delete().eq("id", id);
    load();
  }

  return (
    <Card>
      <CardHeader><CardTitle>ลูกค้า</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <Input placeholder="ชื่อลูกค้า" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="เบอร์โทร" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input placeholder="ที่อยู่" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <Button onClick={add}><Plus className="h-4 w-4 mr-1" />เพิ่มลูกค้า</Button>
        <ul className="divide-y rounded border">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-3 py-2">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.phone} {c.address && `• ${c.address}`}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => del(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
          {items.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">ยังไม่มีข้อมูล</li>}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---------- Products ----------
function ProductsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const empty = { name: "", part_number: "", price: "", stock_quantity: "0", brand_id: "", category_id: "", image_url: "", storage_location: "", service_interval_hours: "" };
  const [form, setForm] = useState(empty);

  async function load() {
    const [p, b, c] = await Promise.all([
      supabase.from("products").select("*, brands(name), categories(name)").order("part_number"),
      supabase.from("brands").select("*").order("name"),
      supabase.from("categories").select("*").order("sort_order"),
    ]);
    setItems(p.data ?? []);
    setBrands(b.data ?? []);
    setCats(c.data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function uploadImage(file: File) {
    setUploading(true);
    const path = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) { setUploading(false); toast.error(error.message); return; }
    const { data } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    setForm((f) => ({ ...f, image_url: data?.signedUrl ?? "" }));
    setUploading(false);
    toast.success("อัพโหลดรูปสำเร็จ");
  }

  async function add() {
    if (!form.name.trim() || !form.part_number.trim()) return toast.error("กรอกชื่อและ Part Number");
    const { error } = await supabase.from("products").insert({
      name: form.name.trim(),
      part_number: form.part_number.trim(),
      price: form.price ? Number(form.price) : null,
      stock_quantity: Number(form.stock_quantity) || 0,
      brand_id: form.brand_id || null,
      category_id: form.category_id || null,
      image_url: form.image_url || null,
      storage_location: form.storage_location.trim() || null,
      service_interval_hours: form.service_interval_hours ? Number(form.service_interval_hours) : null,
    });
    if (error) return toast.error(error.message);
    setForm(empty);
    toast.success("เพิ่มสินค้าแล้ว");
    load();
  }
  async function del(id: string) {
    if (!confirm("ลบสินค้านี้?")) return;
    await supabase.from("products").delete().eq("id", id);
    load();
  }

  return (
    <Card>
      <CardHeader><CardTitle>สินค้า/อะไหล่</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label>ชื่อสินค้า</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Part Number</Label>
            <Input value={form.part_number} onChange={(e) => setForm({ ...form, part_number: e.target.value })} />
          </div>
          <div>
            <Label>หมวดอะไหล่</Label>
            <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <SelectTrigger><SelectValue placeholder="เลือกหมวด" /></SelectTrigger>
              <SelectContent>
                {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>ยี่ห้อ</Label>
            <Select value={form.brand_id} onValueChange={(v) => setForm({ ...form, brand_id: v })}>
              <SelectTrigger><SelectValue placeholder="เลือกยี่ห้อ" /></SelectTrigger>
              <SelectContent>
                {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>ราคา (บาท)</Label>
            <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div>
            <Label>คงเหลือ</Label>
            <Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
          </div>
          <div>
            <Label>ตำแหน่งจัดเก็บ (เช่น A1)</Label>
            <Input value={form.storage_location} onChange={(e) => setForm({ ...form, storage_location: e.target.value })} />
          </div>
          <div>
            <Label>รอบเปลี่ยน (ชม.)</Label>
            <Input type="number" value={form.service_interval_hours} onChange={(e) => setForm({ ...form, service_interval_hours: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>รูปสินค้า</Label>
            <div className="flex items-center gap-2">
              <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.image_url && <img src={form.image_url} alt="" className="h-10 w-10 rounded object-cover" />}
            </div>
          </div>
        </div>
        <Button onClick={add}><Plus className="h-4 w-4 mr-1" />เพิ่มสินค้า</Button>

        <ul className="divide-y rounded border">
          {items.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="flex items-center gap-3">
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded bg-muted" />
                )}
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.part_number} {p.categories?.name && `• ${p.categories.name}`} {p.brands?.name && `• ${p.brands.name}`}
                  </div>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
          {items.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">ยังไม่มีข้อมูล</li>}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---------- Machines (S/N + parts list) ----------
function MachinesTab() {
  const [units, setUnits] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const empty = { serial_number: "", model_id: "", customer_id: "", install_date: "", daily_hours: "", note: "" };
  const [form, setForm] = useState(empty);
  const [selected, setSelected] = useState<string | null>(null);

  async function load() {
    const [u, c, m] = await Promise.all([
      supabase.from("machine_units").select("*, customers(name), compressor_models(name, brands(name))").order("serial_number"),
      supabase.from("customers").select("*").order("name"),
      supabase.from("compressor_models").select("*, brands(name)").order("name"),
    ]);
    setUnits(u.data ?? []);
    setCustomers(c.data ?? []);
    setModels(m.data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.serial_number.trim()) return toast.error("กรอก S/N");
    const { error } = await supabase.from("machine_units").insert({
      serial_number: form.serial_number.trim(),
      model_id: form.model_id || null,
      customer_id: form.customer_id || null,
      install_date: form.install_date || null,
      daily_hours: form.daily_hours ? Number(form.daily_hours) : null,
      note: form.note || null,
    });
    if (error) return toast.error(error.message);
    setForm(empty);
    toast.success("เพิ่มเครื่องแล้ว");
    load();
  }
  async function del(id: string) {
    if (!confirm("ลบเครื่องนี้?")) return;
    await supabase.from("machine_units").delete().eq("id", id);
    if (selected === id) setSelected(null);
    load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>เพิ่มเครื่อง (S/N)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>S/N เครื่อง</Label>
              <Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
            </div>
            <div>
              <Label>รุ่น</Label>
              <Select value={form.model_id} onValueChange={(v) => setForm({ ...form, model_id: v })}>
                <SelectTrigger><SelectValue placeholder="เลือกรุ่น" /></SelectTrigger>
                <SelectContent>
                  {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.brands?.name} - {m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ลูกค้า</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                <SelectTrigger><SelectValue placeholder="เลือกลูกค้า" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>วันที่ติดตั้ง</Label>
              <Input type="date" value={form.install_date} onChange={(e) => setForm({ ...form, install_date: e.target.value })} />
            </div>
            <div>
              <Label>ชม.ทำงาน/วัน</Label>
              <Input type="number" step="0.1" value={form.daily_hours} onChange={(e) => setForm({ ...form, daily_hours: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>หมายเหตุ</Label>
              <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" />เพิ่มเครื่อง</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>รายการเครื่อง</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y rounded border">
            {units.map((u) => (
              <li key={u.id} className="px-3 py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{u.serial_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {u.compressor_models ? `${u.compressor_models.brands?.name ?? ""} ${u.compressor_models.name}` : "-"} • {u.customers?.name ?? "-"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSelected(selected === u.id ? null : u.id)}>
                      {selected === u.id ? "ปิด" : "จัดการอะไหล่"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => del(u.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {selected === u.id && <MachinePartsEditor machineId={u.id} />}
              </li>
            ))}
            {units.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">ยังไม่มีข้อมูล</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function MachinePartsEditor({ machineId }: { machineId: string }) {
  const [parts, setParts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");

  async function load() {
    const [mp, p] = await Promise.all([
      supabase
        .from("machine_parts")
        .select("*, products(name, part_number, categories(name, sort_order))")
        .eq("machine_unit_id", machineId),
      supabase.from("products").select("id, name, part_number, categories(name)").order("part_number"),
    ]);
    setParts(mp.data ?? []);
    setProducts(p.data ?? []);
  }
  useEffect(() => { load(); }, [machineId]);

  async function add() {
    if (!productId) return toast.error("เลือกสินค้า");
    const { error } = await supabase.from("machine_parts").insert({
      machine_unit_id: machineId,
      product_id: productId,
      quantity: Number(qty) || 1,
    });
    if (error) return toast.error(error.message);
    setProductId(""); setQty("1");
    load();
  }
  async function del(id: string) {
    await supabase.from("machine_parts").delete().eq("id", id);
    load();
  }
  async function updatePart(id: string, patch: { quantity?: number; hours_used?: number | null; last_changed_at?: string | null }) {
    await supabase.from("machine_parts").update(patch).eq("id", id);
    load();
  }

  return (
    <div className="mt-3 space-y-3 rounded border bg-muted/30 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_100px_auto]">
        <Select value={productId} onValueChange={setProductId}>
          <SelectTrigger><SelectValue placeholder="เลือกอะไหล่" /></SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                [{p.categories?.name ?? "-"}] {p.part_number} - {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="จำนวน" />
        <Button onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      <ul className="divide-y rounded border bg-card">
        {parts.map((mp) => (
          <li key={mp.id} className="flex items-center justify-between px-3 py-2">
            <div>
              <Badge variant="outline" className="mr-2">{mp.products?.categories?.name ?? "-"}</Badge>
              <span className="font-medium">{mp.products?.part_number}</span>
              <span className="ml-2 text-sm text-muted-foreground">{mp.products?.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                value={mp.quantity}
                onChange={(e) => updateQty(mp.id, Number(e.target.value) || 1)}
                className="h-8 w-20"
              />
              <Button size="sm" variant="ghost" onClick={() => del(mp.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </li>
        ))}
        {parts.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">ยังไม่มีอะไหล่ในเครื่องนี้</li>}
      </ul>
    </div>
  );
}

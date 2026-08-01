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
import { Plus, Trash2, Loader2, Pencil, Search, AlertTriangle } from "lucide-react";
import { ImportExportTab } from "@/components/admin/ImportExportTab";
import { THAI_PROVINCES, computeUsage, formatDate } from "@/lib/report";

const PUMP_TYPE_PRESETS = ["ปั๊มลมสกรู", "ปั๊มลมสกอร์", "ปั๊มลมลูกสูบ", "อื่นๆ"];

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "จัดการข้อมูล - อะไหล่ปั๊มลม" }] }),
  component: AdminPage,
});

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-9" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function AdminPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">จัดการข้อมูล</h1>
      <Tabs defaultValue="machines">
        <TabsList className="flex-wrap">
          <TabsTrigger value="machines">S/N (หมายเลขเครื่อง)</TabsTrigger>
          <TabsTrigger value="customers">ลูกค้า</TabsTrigger>
          <TabsTrigger value="products">สินค้า/อะไหล่</TabsTrigger>
          <TabsTrigger value="brands">ยี่ห้อ</TabsTrigger>
          <TabsTrigger value="models">รุ่นเครื่อง</TabsTrigger>
          <TabsTrigger value="io">นำเข้า / ส่งออก</TabsTrigger>
        </TabsList>
        <TabsContent value="machines"><MachinesTab /></TabsContent>
        <TabsContent value="customers"><CustomersTab /></TabsContent>
        <TabsContent value="products"><ProductsTab /></TabsContent>
        <TabsContent value="brands"><BrandsTab /></TabsContent>
        <TabsContent value="models"><ModelsTab /></TabsContent>
        <TabsContent value="io"><ImportExportTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Brands ----------
function BrandsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  async function load() {
    const { data } = await supabase.from("brands").select("*").order("name");
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, []);

  const dup = items.some(
    (b) => b.name.trim().toLowerCase() === name.trim().toLowerCase() && b.id !== editId,
  ) && name.trim() !== "";

  async function save() {
    if (!name.trim()) return;
    if (dup) return toast.error("ชื่อยี่ห้อนี้มีอยู่แล้ว");
    const payload = { name: name.trim() };
    const { error } = editId
      ? await supabase.from("brands").update(payload).eq("id", editId)
      : await supabase.from("brands").insert(payload);
    if (error) return toast.error(error.message);
    setName(""); setEditId(null);
    toast.success(editId ? "บันทึกแล้ว" : "เพิ่มยี่ห้อแล้ว");
    load();
  }
  async function del(id: string) {
    if (!confirm("ลบยี่ห้อนี้?")) return;
    const { error } = await supabase.from("brands").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (editId === id) { setEditId(null); setName(""); }
    load();
  }

  const filtered = items.filter((b) => b.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Card>
      <CardHeader><CardTitle>ยี่ห้อปั๊มลม</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder="ชื่อยี่ห้อ เช่น Atlas Copco" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={save}>{editId ? "บันทึก" : <Plus className="h-4 w-4" />}</Button>
          {editId && <Button variant="outline" onClick={() => { setEditId(null); setName(""); }}>ยกเลิก</Button>}
        </div>
        {dup && (
          <p className="flex items-center gap-1 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> ชื่อยี่ห้อนี้มีอยู่แล้ว
          </p>
        )}
        <SearchBox value={q} onChange={setQ} placeholder="ค้นหายี่ห้อ" />
        <ul className="divide-y rounded border">
          {filtered.map((b) => (
            <li key={b.id} className="flex items-center justify-between px-3 py-2">
              <span>{b.name}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setEditId(b.id); setName(b.name); }}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => del(b.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </li>
          ))}
          {filtered.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">ยังไม่มีข้อมูล</li>}
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
  const [pumpType, setPumpType] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  async function load() {
    const [m, b] = await Promise.all([
      supabase.from("compressor_models").select("*, brands(name)").order("name"),
      supabase.from("brands").select("*").order("name"),
    ]);
    setItems(m.data ?? []);
    setBrands(b.data ?? []);
  }
  useEffect(() => { load(); }, []);

  function reset() { setEditId(null); setName(""); setBrandId(""); setPumpType(""); }

  async function save() {
    if (!name.trim() || !brandId) return toast.error("กรอกชื่อรุ่นและเลือกยี่ห้อ");
    const payload: any = { name: name.trim(), brand_id: brandId, pump_type: pumpType.trim() || null };
    const { error } = editId
      ? await supabase.from("compressor_models").update(payload).eq("id", editId)
      : await supabase.from("compressor_models").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editId ? "บันทึกแล้ว" : "เพิ่มรุ่นแล้ว");
    reset();
    load();
  }
  function startEdit(m: any) {
    setEditId(m.id); setName(m.name); setBrandId(m.brand_id); setPumpType(m.pump_type ?? "");
  }
  async function del(id: string) {
    if (!confirm("ลบรุ่นนี้?")) return;
    await supabase.from("compressor_models").delete().eq("id", id);
    if (editId === id) reset();
    load();
  }

  return (
    <Card>
      <CardHeader><CardTitle>รุ่นเครื่อง</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Select value={brandId} onValueChange={setBrandId}>
            <SelectTrigger><SelectValue placeholder="เลือกยี่ห้อ" /></SelectTrigger>
            <SelectContent>
              {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="ชื่อรุ่น เช่น GA37" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            list="pump-type-options"
            placeholder="ประเภทปั๊มลม"
            value={pumpType}
            onChange={(e) => setPumpType(e.target.value)}
          />
          <datalist id="pump-type-options">
            {PUMP_TYPE_PRESETS.map((t) => <option key={t} value={t} />)}
          </datalist>
          <div className="flex gap-1">
            <Button onClick={save}>{editId ? "บันทึก" : <Plus className="h-4 w-4" />}</Button>
            {editId && <Button variant="outline" onClick={reset}>ยกเลิก</Button>}
          </div>
        </div>
        <ul className="divide-y rounded border">
          {items.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-3 py-2">
              <div>
                <div>{m.brands?.name} - {m.name}</div>
                {m.pump_type && <div className="text-xs text-muted-foreground">{m.pump_type}</div>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => startEdit(m)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => del(m.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
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
  const [machinesByCust, setMachinesByCust] = useState<Record<string, any[]>>({});
  const [form, setForm] = useState({ name: "", phone: "", address: "" });

  async function load() {
    const [c, u] = await Promise.all([
      supabase.from("customers").select("*").order("name"),
      supabase.from("machine_units").select("id, serial_number, customer_id, compressor_models(name, brands(name))"),
    ]);
    setItems(c.data ?? []);
    const map: Record<string, any[]> = {};
    (u.data ?? []).forEach((m: any) => {
      if (!m.customer_id) return;
      (map[m.customer_id] ||= []).push(m);
    });
    setMachinesByCust(map);
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
          {items.map((c) => {
            const machines = machinesByCust[c.id] ?? [];
            return (
              <li key={c.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.phone} {c.address && `• ${c.address}`}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => del(c.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                {machines.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="text-xs text-muted-foreground">เครื่อง ({machines.length}):</span>
                    {machines.map((m: any) => (
                      <Badge key={m.id} variant="secondary" className="font-mono text-xs">
                        {m.serial_number}
                        {m.compressor_models && ` · ${m.compressor_models.brands?.name ?? ""} ${m.compressor_models.name}`}
                      </Badge>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
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
  const [machinesByProduct, setMachinesByProduct] = useState<Record<string, any[]>>({});
  const [uploading, setUploading] = useState(false);
  const empty = { id: "", name: "", part_number: "", price: "", stock_quantity: "0", brand_id: "", category_id: "", image_url: "", storage_location: "", service_interval_hours: "" };
  const [form, setForm] = useState(empty);

  async function load() {
    const [p, b, c, mp] = await Promise.all([
      supabase.from("products").select("*, brands(name), categories(name)").order("part_number"),
      supabase.from("brands").select("*").order("name"),
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("machine_parts").select("product_id, machine_units(id, serial_number, customers(name))"),
    ]);
    setItems(p.data ?? []);
    setBrands(b.data ?? []);
    setCats(c.data ?? []);
    const map: Record<string, any[]> = {};
    (mp.data ?? []).forEach((r: any) => {
      if (!r.product_id || !r.machine_units) return;
      (map[r.product_id] ||= []).push(r.machine_units);
    });
    setMachinesByProduct(map);
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

  async function save() {
    if (!form.name.trim() || !form.part_number.trim()) return toast.error("กรอกชื่อและ Part Number");
    const payload = {
      name: form.name.trim(),
      part_number: form.part_number.trim(),
      price: form.price ? Number(form.price) : null,
      stock_quantity: Number(form.stock_quantity) || 0,
      brand_id: form.brand_id || null,
      category_id: form.category_id || null,
      image_url: form.image_url || null,
      storage_location: form.storage_location.trim() || null,
      service_interval_hours: form.service_interval_hours ? Number(form.service_interval_hours) : null,
    };
    const { error } = form.id
      ? await supabase.from("products").update(payload).eq("id", form.id)
      : await supabase.from("products").insert(payload);
    if (error) return toast.error(error.message);
    setForm(empty);
    toast.success(form.id ? "บันทึกแล้ว" : "เพิ่มสินค้าแล้ว");
    load();
  }
  function startEdit(p: any) {
    setForm({
      id: p.id, name: p.name ?? "", part_number: p.part_number ?? "",
      price: p.price != null ? String(p.price) : "",
      stock_quantity: p.stock_quantity != null ? String(p.stock_quantity) : "0",
      brand_id: p.brand_id ?? "", category_id: p.category_id ?? "",
      image_url: p.image_url ?? "", storage_location: p.storage_location ?? "",
      service_interval_hours: p.service_interval_hours != null ? String(p.service_interval_hours) : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function del(id: string) {
    if (!confirm("ลบสินค้านี้?")) return;
    await supabase.from("products").delete().eq("id", id);
    if (form.id === id) setForm(empty);
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
        <Button onClick={save}><Plus className="h-4 w-4 mr-1" />{form.id ? "บันทึก" : "เพิ่มสินค้า"}</Button>
        {form.id && <Button variant="outline" onClick={() => setForm(empty)}>ยกเลิก</Button>}

        <ul className="divide-y rounded border">
          {items.map((p) => {
            const machines = machinesByProduct[p.id] ?? [];
            return (
              <li key={p.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
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
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {machines.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="text-xs text-muted-foreground">ใช้ในเครื่อง ({machines.length}):</span>
                    {machines.map((m: any) => (
                      <Badge key={m.id} variant="secondary" className="font-mono text-xs">
                        {m.serial_number}{m.customers && ` · ${m.customers.name}`}
                      </Badge>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
          {items.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">ยังไม่มีข้อมูล</li>}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---------- Machines (S/N + parts list) ----------
const SERVICE_HOUR_PRESETS = [500, 1500, 2000, 3000, 4500, 6000, 7500, 8000];

function MachinesTab() {
  const [units, setUnits] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const empty = {
    id: "" as string,
    serial_number: "",
    customer_name: "",
    brand_name: "",
    model_name: "",
    pump_type: "",
    install_date: "",
    daily_hours: "",
    note: "",
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  async function load() {
    const [u, c, b, m] = await Promise.all([
      supabase.from("machine_units").select("*, customers(id,name), compressor_models(id,name,brand_id,pump_type, brands(id,name))").order("serial_number"),
      supabase.from("customers").select("*").order("name"),
      supabase.from("brands").select("*").order("name"),
      supabase.from("compressor_models").select("*, brands(name)").order("name"),
    ]);
    setUnits(u.data ?? []);
    setCustomers(c.data ?? []);
    setBrands(b.data ?? []);
    setModels(m.data ?? []);
  }
  useEffect(() => { load(); }, []);

  function resetForm() { setForm(empty); }

  function startEdit(u: any) {
    setForm({
      id: u.id,
      serial_number: u.serial_number ?? "",
      customer_name: u.customers?.name ?? "",
      brand_name: u.compressor_models?.brands?.name ?? "",
      model_name: u.compressor_models?.name ?? "",
      pump_type: u.compressor_models?.pump_type ?? "",
      install_date: u.install_date ?? "",
      daily_hours: u.daily_hours != null ? String(u.daily_hours) : "",
      note: u.note ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Get-or-create helper for customer/brand/model by name (case-insensitive)
  async function resolveCustomerId(name: string): Promise<string | null> {
    const n = name.trim();
    if (!n) return null;
    const existing = customers.find((c) => c.name.toLowerCase() === n.toLowerCase());
    if (existing) return existing.id;
    const { data, error } = await supabase.from("customers").insert({ name: n }).select("id").single();
    if (error) { toast.error("เพิ่มลูกค้าไม่สำเร็จ: " + error.message); return null; }
    return data.id;
  }
  async function resolveBrandId(name: string): Promise<string | null> {
    const n = name.trim();
    if (!n) return null;
    const existing = brands.find((b) => b.name.toLowerCase() === n.toLowerCase());
    if (existing) return existing.id;
    const { data, error } = await supabase.from("brands").insert({ name: n }).select("id").single();
    if (error) { toast.error("เพิ่มยี่ห้อไม่สำเร็จ: " + error.message); return null; }
    return data.id;
  }
  async function resolveModelId(name: string, brandId: string | null, pumpType: string): Promise<string | null> {
    const n = name.trim();
    if (!n || !brandId) return null;
    const existing = models.find(
      (m) => m.name.toLowerCase() === n.toLowerCase() && m.brand_id === brandId,
    );
    const pt = pumpType.trim() || null;
    if (existing) {
      if ((existing.pump_type ?? null) !== pt) {
        await supabase.from("compressor_models").update({ pump_type: pt } as any).eq("id", existing.id);
      }
      return existing.id;
    }
    const { data, error } = await supabase.from("compressor_models").insert({ name: n, brand_id: brandId, pump_type: pt } as any).select("id").single();
    if (error) { toast.error("เพิ่มรุ่นไม่สำเร็จ: " + error.message); return null; }
    return data.id;
  }

  async function save() {
    if (!form.serial_number.trim()) return toast.error("กรอก S/N");
    setSaving(true);
    try {
      const customer_id = await resolveCustomerId(form.customer_name);
      const brand_id = await resolveBrandId(form.brand_name);
      const model_id = form.model_name ? await resolveModelId(form.model_name, brand_id, form.pump_type) : null;

      const payload = {
        serial_number: form.serial_number.trim(),
        model_id,
        customer_id,
        install_date: form.install_date || null,
        daily_hours: form.daily_hours ? Number(form.daily_hours) : null,
        note: form.note || null,
      };

      if (form.id) {
        const { error } = await supabase.from("machine_units").update(payload).eq("id", form.id);
        if (error) return toast.error(error.message);
        toast.success("บันทึกเรียบร้อย");
      } else {
        const { data, error } = await supabase.from("machine_units").insert(payload).select("id").single();
        if (error) return toast.error(error.message);
        toast.success("เพิ่มเครื่องแล้ว — เพิ่มอะไหล่ได้เลย");
        // keep form open in edit mode so user can add parts inline
        setForm((f) => ({ ...f, id: data.id }));
      }
      load();
    } finally {
      setSaving(false);
    }
  }
  async function del(id: string) {
    if (!confirm("ลบเครื่องนี้?")) return;
    await supabase.from("machine_units").delete().eq("id", id);
    if (selected === id) setSelected(null);
    if (form.id === id) resetForm();
    load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{form.id ? "แก้ไขเครื่อง" : "เพิ่มเครื่อง (S/N)"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>S/N เครื่อง</Label>
              <Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
            </div>
            <div>
              <Label>ลูกค้า (พิมพ์เพิ่มหรือเลือก)</Label>
              <Input
                list="customer-options"
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                placeholder="เช่น บริษัท ABC"
              />
              <datalist id="customer-options">
                {customers.map((c) => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
            <div>
              <Label>ยี่ห้อ (พิมพ์เพิ่มหรือเลือก)</Label>
              <Input
                list="brand-options"
                value={form.brand_name}
                onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
                placeholder="เช่น Atlas Copco"
              />
              <datalist id="brand-options">
                {brands.map((b) => <option key={b.id} value={b.name} />)}
              </datalist>
            </div>
            <div>
              <Label>รุ่น (พิมพ์เพิ่มหรือเลือก)</Label>
              <Input
                list="model-options"
                value={form.model_name}
                onChange={(e) => setForm({ ...form, model_name: e.target.value })}
                placeholder="เช่น GA37"
              />
              <datalist id="model-options">
                {models
                  .filter((m) => !form.brand_name || m.brands?.name?.toLowerCase() === form.brand_name.toLowerCase())
                  .map((m) => <option key={m.id} value={m.name}>{m.brands?.name}</option>)}
              </datalist>
            </div>
            <div>
              <Label>ประเภทปั๊มลม (พิมพ์เพิ่มหรือเลือก)</Label>
              <Input
                list="pump-type-options"
                value={form.pump_type}
                onChange={(e) => setForm({ ...form, pump_type: e.target.value })}
                placeholder="เช่น ปั๊มลมสกรู"
              />
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
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              {form.id ? "บันทึก" : "เพิ่มเครื่อง"}
            </Button>
            {form.id && (
              <Button variant="outline" onClick={resetForm}>ล้างฟอร์ม / เพิ่มเครื่องใหม่</Button>
            )}
          </div>
          {form.id && (
            <div className="mt-2">
              <Label className="text-sm font-semibold">รายการอะไหล่ของเครื่องนี้</Label>
              <MachinePartsEditor machineId={form.id} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>รายการเครื่อง</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y rounded border">
            {units.map((u) => (
              <li key={u.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{u.serial_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {u.compressor_models ? `${u.compressor_models.brands?.name ?? ""} ${u.compressor_models.name}` : "-"} • {u.customers?.name ?? "-"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(u)}>แก้ไข</Button>
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
  const [cats, setCats] = useState<any[]>([]);
  const [catId, setCatId] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partName, setPartName] = useState("");
  const [qty, setQty] = useState("1");
  const [interval, setInterval] = useState("");

  async function load() {
    const [mp, p, c] = await Promise.all([
      supabase
        .from("machine_parts")
        .select("*, products(id, name, part_number, service_interval_hours, category_id, categories(name, sort_order))")
        .eq("machine_unit_id", machineId),
      supabase.from("products").select("id, name, part_number, category_id, service_interval_hours, categories(name)").order("part_number"),
      supabase.from("categories").select("*").order("sort_order"),
    ]);
    setParts(mp.data ?? []);
    setProducts(p.data ?? []);
    setCats(c.data ?? []);
  }
  useEffect(() => { load(); }, [machineId]);

  const filteredProducts = catId ? products.filter((p) => p.category_id === catId) : products;

  function pickPart(text: string) {
    setPartNumber(text);
    const match = products.find((p) => p.part_number.toLowerCase() === text.toLowerCase());
    if (match) {
      setPartName(match.name);
      if (!catId && match.category_id) setCatId(match.category_id);
    }
  }

  async function add() {
    if (!partNumber.trim()) return toast.error("กรอก Part Number");
    let product = products.find((p) => p.part_number.toLowerCase() === partNumber.trim().toLowerCase());
    if (!product) {
      // quick-create
      if (!partName.trim()) return toast.error("กรอกชื่ออะไหล่ (Part Description) สำหรับสินค้าใหม่");
      const { data, error } = await supabase.from("products").insert({
        part_number: partNumber.trim(),
        name: partName.trim(),
        category_id: catId || null,
        service_interval_hours: interval ? Number(interval) : null,
      }).select("id, name, part_number, category_id, service_interval_hours").single();
      if (error) return toast.error("เพิ่มสินค้าไม่สำเร็จ: " + error.message);
      product = data;
      toast.success("เพิ่มสินค้าใหม่ในคลังแล้ว");
    }
    const { error } = await supabase.from("machine_parts").insert({
      machine_unit_id: machineId,
      product_id: product!.id,
      quantity: Number(qty) || 1,
      service_interval_hours: interval ? Number(interval) : null,
    });
    if (error) return toast.error(error.message);
    setPartNumber(""); setPartName(""); setQty("1"); setInterval("");
    load();
  }
  async function del(id: string) {
    await supabase.from("machine_parts").delete().eq("id", id);
    load();
  }
  async function updatePart(id: string, patch: any) {
    await supabase.from("machine_parts").update(patch).eq("id", id);
    load();
  }
  async function updateProduct(productId: string, patch: { name?: string; part_number?: string }) {
    const { error } = await supabase.from("products").update(patch).eq("id", productId);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <div className="mt-3 space-y-3 rounded border bg-muted/30 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-xs">หมวดอะไหล่</Label>
          <Select value={catId} onValueChange={setCatId}>
            <SelectTrigger><SelectValue placeholder="เลือกหมวด (เช่น กรองอากาศ)" /></SelectTrigger>
            <SelectContent>
              {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Part Number (พิมพ์เพิ่มใหม่ หรือเลือก)</Label>
          <Input
            list={`part-num-${machineId}`}
            value={partNumber}
            onChange={(e) => pickPart(e.target.value)}
            placeholder="รหัสอะไหล่"
          />
          <datalist id={`part-num-${machineId}`}>
            {filteredProducts.map((p) => (
              <option key={p.id} value={p.part_number}>{p.name}</option>
            ))}
          </datalist>
        </div>
        <div>
          <Label className="text-xs">ชื่ออะไหล่ (Part Description)</Label>
          <Input value={partName} onChange={(e) => setPartName(e.target.value)} placeholder="ชื่อสินค้า" />
        </div>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <div>
            <Label className="text-xs">จำนวน</Label>
            <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">รอบ (ชม.)</Label>
            <Input
              list="service-hour-presets"
              type="number"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            />
            <datalist id="service-hour-presets">
              {SERVICE_HOUR_PRESETS.map((h) => <option key={h} value={h} />)}
            </datalist>
          </div>
          <div className="self-end">
            <Button onClick={add}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      <ul className="divide-y rounded border bg-card">
        {parts.map((mp) => (
          <li key={mp.id} className="space-y-2 px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Badge variant="outline" className="mb-1">{mp.products?.categories?.name ?? "-"}</Badge>
                <div className="grid gap-1 sm:grid-cols-2">
                  <Input
                    defaultValue={mp.products?.part_number ?? ""}
                    onBlur={(e) => e.target.value !== mp.products?.part_number && updateProduct(mp.products.id, { part_number: e.target.value })}
                    className="h-8 font-mono text-sm"
                    placeholder="Part Number"
                  />
                  <Input
                    defaultValue={mp.products?.name ?? ""}
                    onBlur={(e) => e.target.value !== mp.products?.name && updateProduct(mp.products.id, { name: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="Part Description"
                  />
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => del(mp.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <div>
                <Label className="text-xs">จำนวน</Label>
                <Input
                  type="number" min="1" defaultValue={mp.quantity}
                  onBlur={(e) => updatePart(mp.id, { quantity: Number(e.target.value) || 1 })}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">ชม.ที่ใช้</Label>
                <Input
                  type="number" step="0.1" defaultValue={mp.hours_used ?? ""}
                  onBlur={(e) => updatePart(mp.id, { hours_used: e.target.value ? Number(e.target.value) : null })}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">รอบเปลี่ยน (ชม.)</Label>
                <Input
                  list="service-hour-presets"
                  type="number"
                  defaultValue={mp.service_interval_hours ?? ""}
                  onBlur={(e) => updatePart(mp.id, { service_interval_hours: e.target.value ? Number(e.target.value) : null })}
                  className="h-8"
                  placeholder={mp.products?.service_interval_hours ? `ค่ามาตรฐาน ${mp.products.service_interval_hours}` : ""}
                />
              </div>
              <div>
                <Label className="text-xs">เปลี่ยนล่าสุด</Label>
                <Input
                  type="date" defaultValue={mp.last_changed_at ?? ""}
                  onBlur={(e) => updatePart(mp.id, { last_changed_at: e.target.value || null })}
                  className="h-8"
                />
              </div>
            </div>
          </li>
        ))}
        {parts.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">ยังไม่มีอะไหล่ในเครื่องนี้</li>}
      </ul>
    </div>
  );
}

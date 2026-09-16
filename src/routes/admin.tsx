import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { Plus, Trash2, Loader2, Pencil, Search, AlertTriangle, Undo2, Redo2, Lock } from "lucide-react";
import { ImportExportTab } from "@/components/admin/ImportExportTab";
import { OptionListManager } from "@/components/admin/OptionListManager";
import { StaffVehiclesTab } from "@/components/admin/StaffVehiclesTab";
import { SellerTransfer } from "@/components/admin/SellerTransfer";
import { refreshDirectory } from "@/lib/directory";

import { PasscodeSettings } from "@/components/admin/PasscodeSettings";
import { BackupRestore } from "@/components/admin/BackupRestore";
import { AlertSettings } from "@/components/admin/AlertSettings";
import { AdminLockButton } from "@/components/AccessGate";
import { deleteAsAdmin, useAccess } from "@/lib/access";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useUndoable } from "@/hooks/use-undoable";
import { loadOptionList } from "@/lib/option-lists";
import { THAI_PROVINCES, MACHINE_STATUSES, computeUsage, formatDate, isMachineComplete } from "@/lib/report";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { SmartSearchBox } from "@/components/SmartSearchBox";
import { PartsAlertPanel } from "@/components/PartsAlertPanel";
import { TroubleshootTab } from "@/components/admin/TroubleshootTab";
import { StatsPanel } from "@/components/admin/StatsPanel";
import { AuditLogTab } from "@/components/admin/AuditLogTab";
import { logAudit } from "@/lib/audit";
import { BundlesTab } from "@/components/admin/BundlesTab";
import { DateInput } from "@/components/ui/date-input";


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
  const { isAdmin } = useAccess();

  if (!isAdmin) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" /> ต้องปลดล็อกโหมดแอดมิน
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            กดไอคอนกุญแจที่มุมขวาบนของหน้าจอ แล้วกรอกรหัสแอดมินเพื่อเข้าจัดการข้อมูล
          </p>
          <AdminLockButton />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">จัดการข้อมูล</h1>
      <Tabs defaultValue="machines">
        <TabsList className="w-full flex overflow-x-auto whitespace-nowrap scrollbar-none">
          <TabsTrigger value="machines" className="shrink-0">S/N (หมายเลขเครื่อง)</TabsTrigger>
          <TabsTrigger value="customers" className="shrink-0">ลูกค้า</TabsTrigger>
          <TabsTrigger value="products" className="shrink-0">สินค้า/อะไหล่</TabsTrigger>
          <TabsTrigger value="brands" className="shrink-0">ยี่ห้อ</TabsTrigger>
          <TabsTrigger value="models" className="shrink-0">รุ่นเครื่อง</TabsTrigger>
          <TabsTrigger value="staff" className="shrink-0">ช่าง / รถ</TabsTrigger>
          <TabsTrigger value="lists" className="shrink-0">ผู้ขาย / สถานะ</TabsTrigger>
          <TabsTrigger value="bundles" className="shrink-0">ชุดอะไหล่</TabsTrigger>
          <TabsTrigger value="issues" className="shrink-0">คลังอาการเสีย (AI)</TabsTrigger>
          <TabsTrigger value="io" className="shrink-0">นำเข้า / ส่งออก</TabsTrigger>
          <TabsTrigger value="audit" className="shrink-0">ประวัติการแก้ไข</TabsTrigger>
          <TabsTrigger value="security" className="shrink-0">ความปลอดภัย</TabsTrigger>
        </TabsList>
        <TabsContent value="machines"><MachinesTab /></TabsContent>
        <TabsContent value="customers"><CustomersTab /></TabsContent>
        <TabsContent value="products"><ProductsTab /></TabsContent>
        <TabsContent value="brands"><BrandsTab /></TabsContent>
        <TabsContent value="models"><ModelsTab /></TabsContent>
        <TabsContent value="staff"><StaffVehiclesTab /></TabsContent>
        <TabsContent value="lists">
          <div className="space-y-4">
            <SellerTransfer />
            <div className="grid gap-4 md:grid-cols-2">
              <OptionListManager listKey="sellers" column="seller" title="ผู้ขาย" />
              <OptionListManager listKey="statuses" column="status" title="สถานะเครื่อง" presets={MACHINE_STATUSES} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="bundles"><BundlesTab /></TabsContent>
        <TabsContent value="issues"><TroubleshootTab /></TabsContent>
        <TabsContent value="io"><ImportExportTab /></TabsContent>
        <TabsContent value="audit"><AuditLogTab /></TabsContent>
        <TabsContent value="security">
          <div className="grid gap-4 md:grid-cols-2">
            <AlertSettings />
            <PasscodeSettings />
            <BackupRestore />
          </div>
        </TabsContent>
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
    
    const { error } = await deleteAsAdmin("brands", { id });
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
        <SmartSearchBox
          value={q}
          onChange={setQ}
          placeholder="ค้นหายี่ห้อ"
          suggestions={items.map((b) => ({
            id: b.id,
            label: b.name,
            onSelect: () => { setEditId(b.id); setName(b.name); setQ(""); },
          }))}
          onCreate={(t) => { setEditId(null); setName(t); setQ(""); }}
          createLabel="เพิ่มยี่ห้อใหม่"
        />
        <CollapsibleSection title="กลุ่มข้อมูลยี่ห้อ" subtitle={`ทั้งหมด ${filtered.length} ยี่ห้อ`}>
        <ul className="divide-y rounded border">
          {filtered.map((b) => (
            <li key={b.id} className="flex items-center justify-between px-3 py-2">
              <span>{b.name}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setEditId(b.id); setName(b.name); }}><Pencil className="h-4 w-4" /></Button>
                <ConfirmButton title={`ลบยี่ห้อ "${b.name}"?`} onConfirm={() => del(b.id)}><Trash2 className="h-4 w-4" /></ConfirmButton>
              </div>
            </li>
          ))}
          {filtered.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">ยังไม่มีข้อมูล</li>}
        </ul>
        </CollapsibleSection>
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
    
    await deleteAsAdmin("compressor_models", { id });
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
        <CollapsibleSection title="กลุ่มข้อมูลรุ่นเครื่องจักร" subtitle={`ทั้งหมด ${items.length} รุ่น`}>
        <ul className="divide-y rounded border">
          {items.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-3 py-2">
              <div>
                <div>{m.brands?.name} - {m.name}</div>
                {m.pump_type && <div className="text-xs text-muted-foreground">{m.pump_type}</div>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => startEdit(m)}><Pencil className="h-4 w-4" /></Button>
                <ConfirmButton title={`ลบรุ่น "${m.name}"?`} onConfirm={() => del(m.id)}><Trash2 className="h-4 w-4" /></ConfirmButton>
              </div>
            </li>
          ))}
          {items.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">ยังไม่มีข้อมูล</li>}
        </ul>
        </CollapsibleSection>
      </CardContent>
    </Card>
  );
}

// ---------- Customers ----------
function CustomersTab() {
  const [items, setItems] = useState<any[]>([]);
  const [machinesByCust, setMachinesByCust] = useState<Record<string, any[]>>({});
  const emptyForm = { id: "", name: "", phone: "", address: "", note: "" };
  const [form, setForm] = useState(emptyForm);
  const [q, setQ] = useState("");

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

  const dup =
    form.name.trim() !== "" &&
    items.some((c) => c.name.trim().toLowerCase() === form.name.trim().toLowerCase() && c.id !== form.id);

  async function save() {
    if (!form.name.trim()) return toast.error("กรอกชื่อลูกค้า");
    if (dup) return toast.error("ชื่อลูกค้านี้มีอยู่แล้ว");
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      note: form.note.trim() || null,
    };
    const { error } = form.id
      ? await supabase.from("customers").update(payload).eq("id", form.id)
      : await supabase.from("customers").insert(payload);
    if (error) return toast.error(error.message);
    setForm(emptyForm);
    toast.success(form.id ? "บันทึกแล้ว" : "เพิ่มลูกค้าแล้ว");
    load();
    refreshDirectory();

  }
  function startEdit(c: any) {
    setForm({
      id: c.id, name: c.name ?? "", phone: c.phone ?? "",
      address: c.address ?? "", note: c.note ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function del(id: string) {
    
    await deleteAsAdmin("customers", { id });
    if (form.id === id) setForm(emptyForm);
    load();
  }

  const kw = q.trim().toLowerCase();
  const filtered = kw
    ? items.filter((c) =>
        `${c.name ?? ""} ${c.phone ?? ""} ${c.address ?? ""} ${c.note ?? ""}`.toLowerCase().includes(kw),
      )
    : items;

  return (
    <Card>
      <CardHeader><CardTitle>{form.id ? "แก้ไขลูกค้า" : "ลูกค้า"}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label>ชื่อลูกค้า</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>เบอร์โทร</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>ที่อยู่</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <Label>หมายเหตุ</Label>
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
        </div>
        {dup && (
          <p className="flex items-center gap-1 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> ชื่อลูกค้านี้มีอยู่แล้ว
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={save}><Plus className="h-4 w-4 mr-1" />{form.id ? "บันทึก" : "เพิ่มลูกค้า"}</Button>
          {form.id && <Button variant="outline" onClick={() => setForm(emptyForm)}>ยกเลิก</Button>}
        </div>
        <SmartSearchBox
          value={q}
          onChange={setQ}
          placeholder="ค้นหาชื่อลูกค้า / เบอร์ / ที่อยู่"
          suggestions={items.map((c) => ({
            id: c.id,
            label: c.name,
            sub: [c.phone, c.address].filter(Boolean).join(" • "),
            onSelect: () => { startEdit(c); setQ(""); },
          }))}
          onCreate={(t) => {
            setForm({ ...emptyForm, name: t });
            setQ("");
            window.scrollTo({ top: 0, behavior: "smooth" });
            toast.success(`ส่งคำว่า "${t}" ไปฟอร์มเพิ่มลูกค้าใหม่แล้ว`);
          }}
          createLabel="เพิ่มลูกค้าใหม่"
        />
        <CollapsibleSection title="กลุ่มข้อมูลลูกค้า" subtitle={`ทั้งหมด ${filtered.length} ราย`}>
        <ul className="divide-y rounded border">
          {filtered.map((c) => {
            const machines = machinesByCust[c.id] ?? [];
            return (
              <li key={c.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.phone} {c.address && `• ${c.address}`}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <ConfirmButton title={`ลบลูกค้า "${c.name}"?`} onConfirm={() => del(c.id)}><Trash2 className="h-4 w-4" /></ConfirmButton>
                  </div>
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
          {filtered.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">ยังไม่มีข้อมูล</li>}
        </ul>
        </CollapsibleSection>
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
  const [q, setQ] = useState("");

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
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const maxBytes = 5 * 1024 * 1024;
    if (!allowedTypes.has(file.type)) return toast.error("รองรับเฉพาะรูป JPG, PNG หรือ WebP");
    if (file.size > maxBytes) return toast.error("รูปต้องมีขนาดไม่เกิน 5 MB");
    setUploading(true);
    const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const path = `products/${crypto.randomUUID()}.${extension}`;
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
    
    await deleteAsAdmin("products", { id });
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
        {form.part_number.trim() !== "" &&
          items.some((p) => p.part_number?.trim().toLowerCase() === form.part_number.trim().toLowerCase() && p.id !== form.id) && (
          <p className="flex items-center gap-1 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> Part Number นี้มีอยู่แล้วในคลัง
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={save}><Plus className="h-4 w-4 mr-1" />{form.id ? "บันทึก" : "เพิ่มสินค้า"}</Button>
          {form.id && <Button variant="outline" onClick={() => setForm(empty)}>ยกเลิก</Button>}
        </div>

        <SmartSearchBox
          value={q}
          onChange={setQ}
          placeholder="ค้นหารหัสอะไหล่ / ชื่อ / หมวด / ตำแหน่งจัดเก็บ"
          suggestions={items.map((p) => ({
            id: p.id,
            label: `${p.name} (${p.part_number})`,
            sub: [p.categories?.name, p.brands?.name, p.storage_location].filter(Boolean).join(" • "),
            onSelect: () => { startEdit(p); setQ(""); },
          }))}
          onCreate={(t) => {
            setForm({ ...empty, name: t, part_number: t });
            setQ("");
            window.scrollTo({ top: 0, behavior: "smooth" });
            toast.success(`ส่งคำว่า "${t}" ไปฟอร์มเพิ่มสินค้าใหม่แล้ว`);
          }}
          createLabel="เพิ่มอะไหล่ใหม่"
        />
        <CollapsibleSection title="กลุ่มข้อมูลสินค้า/อะไหล่" subtitle={`ทั้งหมด ${items.length} รายการ`}>
        <ul className="divide-y rounded border">
          {items
            .filter((p) => {
              const kw = q.trim().toLowerCase();
              if (!kw) return true;
              return `${p.part_number ?? ""} ${p.name ?? ""} ${p.categories?.name ?? ""} ${p.brands?.name ?? ""} ${p.storage_location ?? ""}`
                .toLowerCase().includes(kw);
            })
            .map((p) => {
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
                    <ConfirmButton title={`ลบสินค้า "${p.name}"?`} onConfirm={() => del(p.id)}><Trash2 className="h-4 w-4" /></ConfirmButton>
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
        </CollapsibleSection>
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
    customer_sn: "",
    customer_name: "",
    brand_name: "",
    model_name: "",
    pump_type: "",
    install_date: "",
    daily_hours: "",
    site_name: "",
    address_line: "",
    district: "",
    province: "",
    seller: "",
    status: "",
    warranty_end: "",
    contract_service: false,
    data_complete: false,
    note: "",

  };
  const formHistory = useUndoable(empty);
  const form = formHistory.value;
  const setForm = formHistory.set;
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sellerFilter, setSellerFilter] = useState<string | null>(null);
  const [sellerQ, setSellerQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [customSellers, setCustomSellers] = useState<string[]>([]);
  const [customStatuses, setCustomStatuses] = useState<string[]>([]);
  const [completeFilter, setCompleteFilter] = useState<"all" | "yes" | "no">("all");
  useEffect(() => {
    loadOptionList("sellers").then(setCustomSellers);
    loadOptionList("statuses").then(setCustomStatuses);
  }, []);

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of units) {
      const s = (u.status ?? "").trim() || "ไม่ระบุสถานะ";
      map.set(s, (map.get(s) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [units]);

  const dupUnit = units.find(
    (u) =>
      form.serial_number.trim() !== "" &&
      u.serial_number?.trim().toLowerCase() === form.serial_number.trim().toLowerCase() &&
      u.id !== form.id,
  );

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

  function resetForm() { formHistory.reset(empty); }

  function startEdit(u: any) {
    formHistory.reset({
      id: u.id,
      serial_number: u.serial_number ?? "",
      customer_sn: u.customer_sn ?? "",
      customer_name: u.customers?.name ?? "",
      brand_name: u.compressor_models?.brands?.name ?? "",
      model_name: u.compressor_models?.name ?? "",
      pump_type: u.compressor_models?.pump_type ?? "",
      install_date: u.install_date ?? "",
      daily_hours: u.daily_hours != null ? String(u.daily_hours) : "",
      site_name: u.site_name ?? "",
      address_line: u.address_line ?? "",
      district: u.district ?? "",
      province: u.province ?? "",
      seller: u.seller ?? "",
      status: u.status ?? "",
      warranty_end: u.warranty_end ?? "",
      contract_service: !!u.contract_service,
      data_complete: !!u.data_complete,
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

  async function save(addAnother = false) {
    if (!form.serial_number.trim()) return toast.error("กรอก S/N");
    if (dupUnit) return toast.error(`S/N นี้มีอยู่แล้ว (${dupUnit.customers?.name ?? "ไม่ระบุลูกค้า"})`);
    setSaving(true);
    try {
      const customer_id = await resolveCustomerId(form.customer_name);
      const brand_id = await resolveBrandId(form.brand_name);
      const model_id = form.model_name ? await resolveModelId(form.model_name, brand_id, form.pump_type) : null;

      const payload = {
        serial_number: form.serial_number.trim(),
        customer_sn: form.customer_sn.trim() || null,
        model_id,
        customer_id,
        install_date: form.install_date || null,
        daily_hours: form.daily_hours ? Number(form.daily_hours) : null,
        site_name: form.site_name.trim() || null,
        address_line: form.address_line.trim() || null,
        district: form.district.trim() || null,
        province: form.province.trim() || null,
        seller: form.seller.trim() || null,
        status: form.status.trim() || null,
        warranty_end: form.warranty_end || null,
        contract_service: !!form.contract_service,
        data_complete: !!form.data_complete,
        note: form.note || null,

      };

      if (form.id) {
        const { error } = await supabase.from("machine_units").update(payload).eq("id", form.id);
        if (error) return toast.error(error.message);
        await logAudit({ table: "machine_units", recordId: form.id, action: "update", summary: `แก้ไขเครื่อง S/N ${payload.serial_number}`, changes: payload });
        toast.success("บันทึกเรียบร้อย");
      } else {
        const { data, error } = await supabase.from("machine_units").insert(payload).select("id").single();
        if (error) return toast.error(error.message);
        await logAudit({ table: "machine_units", recordId: data.id, action: "create", summary: `เพิ่มเครื่อง S/N ${payload.serial_number}`, changes: payload });
        if (addAnother) {
          toast.success("บันทึกแล้ว — กรอกเครื่องถัดไปได้เลย");
          setForm((f) => ({ ...f, id: "", serial_number: "", customer_sn: "", note: "", site_name: "" }));
        } else {
          toast.success("เพิ่มเครื่องแล้ว — เพิ่มอะไหล่ได้เลย");
          // keep form open in edit mode so user can add parts inline
          setForm((f) => ({ ...f, id: data.id }));
        }
      }
      load();
      refreshDirectory();

    } finally {
      setSaving(false);
    }
  }
  async function duplicateUnit(u: any) {
    const serial = window.prompt(`คัดลอกเครื่อง ${u.serial_number} — กรอก S/N ใหม่`, `${u.serial_number}-copy`);
    if (!serial?.trim()) return;
    if (units.some((x) => x.serial_number?.trim().toLowerCase() === serial.trim().toLowerCase())) {
      return toast.error("S/N นี้มีอยู่แล้ว");
    }
    const { data: created, error } = await supabase
      .from("machine_units")
      .insert({
        serial_number: serial.trim(),
        model_id: u.model_id,
        customer_id: u.customer_id,
        install_date: u.install_date,
        daily_hours: u.daily_hours,
        site_name: u.site_name,
        address_line: u.address_line,
        district: u.district,
        province: u.province,
        seller: u.seller,
        status: u.status,
        note: u.note,
      })
      .select("id")
      .single();
    if (error || !created) return toast.error(error?.message ?? "คัดลอกไม่สำเร็จ");
    const { data: parts } = await supabase
      .from("machine_parts")
      .select("product_id, quantity, note, service_interval_hours")
      .eq("machine_unit_id", u.id);
    if (parts?.length) {
      await supabase
        .from("machine_parts")
        .insert(parts.map((p) => ({ ...p, machine_unit_id: created.id, hours_used: 0, last_changed_at: null })));
    }
    toast.success(`คัดลอกเป็น ${serial.trim()} พร้อมอะไหล่ ${parts?.length ?? 0} รายการ`);
    load();
  }

  async function del(id: string) {
    
    await deleteAsAdmin("machine_units", { id });
    if (selected === id) setSelected(null);
    if (form.id === id) resetForm();
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="order-0 hidden md:block">
        <StatsPanel refreshKey={units.length} />
      </div>
      {/* แถวที่ 1 — ช่องค้นหาเต็มความกว้าง */}

      <div className="order-1 w-full rounded-xl border bg-card p-3 shadow-sm">
        <SmartSearchBox
          value={q}
          onChange={setQ}
          placeholder="ค้นหา S/N / ลูกค้า / รุ่น / จังหวัด / ผู้ขาย"
          suggestions={units.map((u) => ({
            id: u.id,
            label: u.serial_number ?? "",
            sub: [
              u.customers?.name,
              u.compressor_models ? `${u.compressor_models.brands?.name ?? ""} ${u.compressor_models.name}` : "",
              u.province,
              u.seller,
            ].filter(Boolean).join(" • "),
            onSelect: () => { startEdit(u); setQ(""); },
          }))}
          onCreate={(t) => {
            formHistory.reset({ ...empty, serial_number: t });
            setQ("");
            window.scrollTo({ top: 0, behavior: "smooth" });
            toast.success(`ส่งคำว่า "${t}" ไปช่อง S/N ในฟอร์มเพิ่มเครื่องใหม่แล้ว`);
          }}
          createLabel="เพิ่มเครื่องจักรใหม่"
        />
      </div>

      {/* แถวที่ 3 — แจ้งเตือนอายุอะไหล่ 30 วัน */}
      <CollapsibleSection
        className="order-3"
        title="🔔 แจ้งเตือนอะไหล่ครบกำหนดเปลี่ยนใน 30 วัน"
        subtitle="พร้อมปุ่มลัดแก้ไขอะไหล่ / ดึงเข้าตารางแพลนเนอร์"
      >
        <PartsAlertPanel withActions />
      </CollapsibleSection>

      {/* แถวสุดท้าย — ตารางข้อมูลเครื่องจักรทั้งหมด */}
      <Card className="order-4">
        <CardHeader><CardTitle>ข้อมูลเครื่องจักรทั้งหมด</CardTitle></CardHeader>
        <CardContent className="space-y-3">

          {(() => {
            const sellers = Array.from(
              new Set(units.map((u) => (u.seller ?? "").trim()).filter(Boolean)),
            ).sort((a: any, b: any) => a.localeCompare(b, "th"));
            const visibleSellers = sellerQ.trim()
              ? sellers.filter((s: any) => s.toLowerCase().includes(sellerQ.trim().toLowerCase()))
              : sellers;
            if (!sellers.length) return null;
            return (
              <CollapsibleSection
                title="กลุ่มข้อมูลเซลผู้ขาย"
                subtitle={sellerFilter ? `กำลังกรอง: ${sellerFilter}` : `ทั้งหมด ${sellers.length} ราย`}
              >
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="ค้นหาด้วยชื่อผู้ขาย"
                      value={sellerQ}
                      onChange={(e) => setSellerQ(e.target.value)}
                      className="h-10 pl-10 text-base"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="shrink-0 text-xs text-muted-foreground">ผู้ขาย:</span>
                    <Button
                      size="sm"
                      variant={sellerFilter === null ? "default" : "outline"}
                      onClick={() => setSellerFilter(null)}
                    >
                      ทั้งหมด
                    </Button>
                    {visibleSellers.map((s: any) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={sellerFilter === s ? "default" : "outline"}
                        onClick={() => setSellerFilter(s)}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              </CollapsibleSection>
            );
          })()}
          <CollapsibleSection
            title="กลุ่มข้อมูลป้ายสถานะและความครบถ้วน"
            subtitle={`ทั้งหมด ${units.length} เครื่อง`}
          >
            <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
              <div>
                <div className="mb-2 text-sm font-semibold">สรุปจำนวนเครื่องตามสถานะ (ทั้งหมด {units.length} เครื่อง)</div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={statusFilter === null ? "default" : "outline"}
                    onClick={() => setStatusFilter(null)}
                  >
                    ทั้งหมด ({units.length})
                  </Button>
                  {statusCounts.map(([s, n]) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={statusFilter === s ? "default" : "outline"}
                      onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                    >
                      {s} ({n})
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold">
                  <span className="shrink-0 text-xs text-muted-foreground">ความครบถ้วนข้อมูล:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={completeFilter === "all" ? "default" : "outline"} onClick={() => setCompleteFilter("all")}>
                    ทั้งหมด
                  </Button>
                  <Button size="sm" variant={completeFilter === "yes" ? "default" : "outline"} onClick={() => setCompleteFilter("yes")}>
                    ครบถ้วน ({units.filter((u) => isMachineComplete(u)).length})
                  </Button>
                  <Button size="sm" variant={completeFilter === "no" ? "default" : "outline"} onClick={() => setCompleteFilter("no")}>
                    ยังไม่ครบ ({units.filter((u) => !isMachineComplete(u)).length})
                  </Button>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="กลุ่มข้อมูลเครื่องจักรทั้งหมด"
            subtitle={`${units.length} เครื่อง — กดเพื่อกาง/พับรายการ`}
          >
          <ul className="divide-y rounded border">

            {units
              .filter((u) => {
                const unitSeller = (u.seller ?? "").trim();
                if (sellerFilter && unitSeller !== sellerFilter) return false;
                const sellerKw = sellerQ.trim().toLowerCase();
                if (sellerKw && !unitSeller.toLowerCase().includes(sellerKw)) return false;
                if (statusFilter && ((u.status ?? "").trim() || "ไม่ระบุสถานะ") !== statusFilter) return false;
                if (completeFilter !== "all" && isMachineComplete(u) !== (completeFilter === "yes")) return false;
                const kw = q.trim().toLowerCase();
                if (!kw) return true;
                return `${u.serial_number ?? ""} ${u.customer_sn ?? ""} ${u.customers?.name ?? ""} ${u.compressor_models?.name ?? ""} ${u.compressor_models?.brands?.name ?? ""} ${u.site_name ?? ""} ${u.district ?? ""} ${u.province ?? ""} ${unitSeller} ${u.status ?? ""}`
                  .toLowerCase().includes(kw);
              })
              .map((u) => (
              <li key={u.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{u.serial_number}</span>
                      {u.customer_sn && (
                        <span className="ml-1 text-xs text-muted-foreground">(S/N ลูกค้า: {u.customer_sn})</span>
                      )}
                      {u.status && (
                        <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                          {u.status}
                        </span>
                      )}
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[11px] " +
                          (isMachineComplete(u)
                            ? "bg-emerald-500/15 text-emerald-700"
                            : "bg-orange-500/15 text-orange-700")
                        }
                      >
                        {isMachineComplete(u) ? "ลงข้อมูลครบถ้วน" : "ยังลงข้อมูลไม่ครบ"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {u.compressor_models ? `${u.compressor_models.brands?.name ?? ""} ${u.compressor_models.name}` : "-"} • {u.customers?.name ?? "-"}
                    </div>
                    {(u.site_name || u.district || u.province) && (
                      <div className="text-xs text-muted-foreground">
                        📍 {[u.site_name, u.address_line, u.district, u.province].filter(Boolean).join(" • ")}
                      </div>
                    )}
                    {u.seller && (
                      <div className="text-xs text-muted-foreground">ผู้ขาย: {u.seller}</div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(u)}>แก้ไข</Button>
                    <Button size="sm" variant="outline" onClick={() => duplicateUnit(u)}>คัดลอก</Button>
                    <Button size="sm" variant="outline" onClick={() => setSelected(selected === u.id ? null : u.id)}>
                      {selected === u.id ? "ปิด" : "จัดการอะไหล่"}
                    </Button>
                    <ConfirmButton title={`ลบเครื่อง S/N "${u.serial_number}"?`} description="ข้อมูลอะไหล่ของเครื่องนี้จะถูกลบด้วย" onConfirm={() => del(u.id)}><Trash2 className="h-4 w-4" /></ConfirmButton>
                  </div>
                </div>
                {selected === u.id && (
                  <MachinePartsEditor
                    machineId={u.id}
                    dailyHours={u.daily_hours ?? null}
                    installDate={u.install_date ?? null}
                  />
                )}
              </li>
            ))}
            {units.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">ยังไม่มีข้อมูล</li>}
          </ul>
          </CollapsibleSection>

        </CardContent>
      </Card>

      <Card className="order-2">
        <CardHeader>
          <CardTitle>{form.id ? "แก้ไขเครื่อง" : "➕ เพิ่มเครื่องจักรใหม่ / ลูกค้าใหม่ (S/N)"}</CardTitle>

        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>S/N เครื่อง</Label>
              <Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
            </div>
            <div>
              <Label>S/N ลูกค้า (Customer S/N)</Label>
              <Input
                value={form.customer_sn}
                onChange={(e) => setForm({ ...form, customer_sn: e.target.value })}
                placeholder="หมายเลขที่ลูกค้าใช้เรียกเครื่อง (แก้ไขได้ตลอด)"
              />
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
              <DateInput value={form.install_date} onChange={(v) => setForm({ ...form, install_date: v })} />
            </div>
            <div>
              <Label>ชม.ทำงาน/วัน</Label>
              <Input type="number" step="0.1" value={form.daily_hours} onChange={(e) => setForm({ ...form, daily_hours: e.target.value })} />
            </div>
            <div>
              <Label>สถานที่ติดตั้ง (ชื่อโรงงาน/ไซต์)</Label>
              <Input value={form.site_name} onChange={(e) => setForm({ ...form, site_name: e.target.value })} placeholder="เช่น โรงงาน 2 อาคาร B" />
            </div>
            <div>
              <Label>ที่อยู่ / แถว / โซน</Label>
              <Input value={form.address_line} onChange={(e) => setForm({ ...form, address_line: e.target.value })} placeholder="เช่น แถว A นิคมฯ บางปู" />
            </div>
            <div>
              <Label>อำเภอ / เขต</Label>
              <Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} placeholder="เช่น เมือง" />
            </div>
            <div>
              <Label>จังหวัด</Label>
              <Input
                list="province-options"
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
                placeholder="เช่น สมุทรปราการ"
              />
              <datalist id="province-options">
                {THAI_PROVINCES.map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div>
              <Label>ผู้ขาย</Label>
              <Input
                list="seller-options"
                value={form.seller}
                onChange={(e) => setForm({ ...form, seller: e.target.value })}
                placeholder="ชื่อพนักงาน/ร้านที่ขายเครื่องนี้"
              />
              <datalist id="seller-options">
                {Array.from(
                  new Set([...customSellers, ...units.map((u) => u.seller).filter(Boolean)]),
                ).map((s: any) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <Label>สถานะเครื่อง (เลือกหรือพิมพ์เพิ่ม)</Label>
              <Input
                list="status-options"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                placeholder="เช่น อยู่ในประกัน / คอนแทรค"
              />
              <datalist id="status-options">
                {Array.from(
                  new Set([
                    ...MACHINE_STATUSES,
                    ...customStatuses,
                    ...units.map((u) => (u.status ?? "").trim()).filter(Boolean),
                  ]),
                ).map((s: any) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <div className="mt-1 flex flex-wrap gap-1">
                {MACHINE_STATUSES.map((s: string) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={form.status === s ? "default" : "outline"}
                    className="h-7 px-2 text-xs"
                    onClick={() => setForm({ ...form, status: s })}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label>วันสิ้นสุดการรับประกัน</Label>
              <DateInput
                value={form.warranty_end}
                onChange={(v) => setForm({ ...form, warranty_end: v })}
              />
            </div>
            <div className="flex items-end">
              <label className="flex w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={form.contract_service}
                  onChange={(e) => setForm({ ...form, contract_service: e.target.checked })}
                />
                ติดสัญญาบริการ (Contract Maintenance)
              </label>
            </div>
            <div className="sm:col-span-2">
              <label
                className={
                  "flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-colors " +
                  (form.data_complete
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                    : "border-orange-400 bg-orange-500/10 text-orange-700")
                }
              >
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={form.data_complete}
                  onChange={(e) => setForm({ ...form, data_complete: e.target.checked })}
                />
                ✅ ตรวจสอบและลงข้อมูลครบถ้วนแล้ว (Data Completed)
                <span className="ml-auto text-xs font-normal">
                  {form.data_complete ? "การ์ดจะขึ้นป้ายสีเขียว" : "การ์ดจะขึ้นป้ายสีส้ม/แดง"}
                </span>
              </label>
            </div>
            <div className="sm:col-span-2">
              <Label>หมายเหตุ</Label>
              <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>

          </div>
          {dupUnit && (
            <div className="flex flex-wrap items-center gap-2 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>S/N นี้มีอยู่แล้ว ({dupUnit.customers?.name ?? "ไม่ระบุลูกค้า"})</span>
              <Button size="sm" variant="outline" onClick={() => startEdit(dupUnit)}>ไปแก้ไขรายการเดิม</Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={formHistory.undo}
              disabled={!formHistory.canUndo}
              title="ย้อนกลับการแก้ไข"
            >
              <Undo2 className="mr-1 h-4 w-4" /> ย้อนกลับ
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={formHistory.redo}
              disabled={!formHistory.canRedo}
              title="ทำซ้ำการแก้ไข"
            >
              <Redo2 className="mr-1 h-4 w-4" /> ต่อไป
            </Button>
            <Button onClick={() => save()} disabled={saving || !!dupUnit}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              {form.id ? "บันทึก" : "เพิ่มเครื่อง"}
            </Button>
            {!form.id && (
              <Button variant="secondary" onClick={() => save(true)} disabled={saving || !!dupUnit}>
                บันทึกและเพิ่มต่อ
              </Button>
            )}
            {form.id && (
              <Button variant="outline" onClick={resetForm}>ล้างฟอร์ม / เพิ่มเครื่องใหม่</Button>
            )}
          </div>
          {form.id && (
            <div className="mt-2">
              <Label className="text-sm font-semibold">รายการอะไหล่ของเครื่องนี้</Label>
              <MachinePartsEditor
                machineId={form.id}
                dailyHours={form.daily_hours ? Number(form.daily_hours) : null}
                installDate={form.install_date || null}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MachinePartsEditor({
  machineId,
  dailyHours = null,
  installDate = null,
}: {
  machineId: string;
  dailyHours?: number | null;
  installDate?: string | null;
}) {
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
    await deleteAsAdmin("machine_parts", { id });
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
        {parts.map((mp) => {
          const usage = computeUsage({
            lastChanged: mp.last_changed_at,
            installDate,
            intervalHours: mp.service_interval_hours ?? mp.products?.service_interval_hours ?? null,
            dailyHours,
            manualHours: mp.hours_used,
          });
          return (
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
              <ConfirmButton title={`ลบอะไหล่ "${mp.products?.name ?? ""}" ออกจากเครื่องนี้?`} onConfirm={() => del(mp.id)}><Trash2 className="h-4 w-4" /></ConfirmButton>
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
                <DateInput
                  value={mp.last_changed_at ?? ""}
                  onChange={(v) => updatePart(mp.id, { last_changed_at: v || null })}
                  size="sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">ชม.สะสม: {usage.used != null ? usage.used.toLocaleString() : "-"}</Badge>
              <Badge variant={usage.overdue ? "destructive" : "outline"}>
                คงเหลือ: {usage.remaining != null ? `${usage.remaining.toLocaleString()} ชม.` : "-"}
              </Badge>
              <Badge variant={usage.overdue ? "destructive" : "outline"}>
                ครั้งถัดไป: {usage.nextDate ? formatDate(usage.nextDate) : "-"}
              </Badge>
              {usage.overdue && <Badge variant="destructive">ถึงกำหนดเปลี่ยน</Badge>}
            </div>
          </li>
          );
        })}
        {parts.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">ยังไม่มีอะไหล่ในเครื่องนี้</li>}
      </ul>
    </div>
  );
}

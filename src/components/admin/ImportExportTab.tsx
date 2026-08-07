import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { downloadBlob, formatBytes, shareOrDownload, tableToPdfBlob } from "@/lib/report";

const LABELS: Record<string, string> = {
  serial_number: "S/N",
  customer: "ลูกค้า",
  brand: "ยี่ห้อ",
  model: "รุ่น",
  pump_type: "ประเภทปั๊ม",
  install_date: "วันติดตั้ง",
  daily_hours: "ชม./วัน",
  site_name: "สถานที่",
  address_line: "ที่อยู่",
  district: "อำเภอ/เขต",
  province: "จังหวัด",
  seller: "ผู้ขาย",
  status: "สถานะเครื่อง",
  note: "หมายเหตุ",
  name: "ชื่อ",
  phone: "เบอร์โทร",
  address: "ที่อยู่",
  part_number: "รหัสพาร์ท",
  part_name: "ชื่ออะไหล่",
  category: "หมวดหมู่",
  price: "ราคา",
  stock_quantity: "สต็อก",
  storage_location: "ที่จัดเก็บ",
  service_interval_hours: "รอบเปลี่ยน (ชม.)",
  hours_used: "ชม.ใช้งาน",
  last_changed_at: "เปลี่ยนล่าสุด",
  quantity: "จำนวน",
  description: "รายละเอียด",
};

type Row = Record<string, any>;

type Dataset = {
  key: string;
  label: string;
  columns: string[];
  load: () => Promise<Row[]>;
  matchKey?: string;
  importRow?: (row: Row, mode: "insert" | "upsert") => Promise<"inserted" | "updated" | "skipped">;
};

const num = (v: any) => (v === "" || v == null ? null : Number(v));
const str = (v: any) => (v == null ? "" : String(v).trim());

async function getOrCreate(table: "brands" | "customers", name: string): Promise<string | null> {
  const n = name.trim();
  if (!n) return null;
  const { data } = await supabase.from(table).select("id").ilike("name", n).limit(1);
  if (data && data.length) return data[0].id;
  const { data: ins, error } = await supabase.from(table).insert({ name: n }).select("id").single();
  if (error) throw new Error(error.message);
  return ins.id;
}

async function getOrCreateModel(brandName: string, modelName: string, pumpType: string) {
  const n = modelName.trim();
  if (!n) return null;
  const brandId = await getOrCreate("brands", brandName);
  if (!brandId) return null;
  const { data } = await supabase
    .from("compressor_models")
    .select("id")
    .eq("brand_id", brandId)
    .ilike("name", n)
    .limit(1);
  if (data && data.length) return data[0].id;
  const { data: ins, error } = await supabase
    .from("compressor_models")
    .insert({ name: n, brand_id: brandId, pump_type: pumpType || null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return ins.id;
}

async function getCategoryId(name: string) {
  const n = name.trim();
  if (!n) return null;
  const { data } = await supabase.from("categories").select("id").ilike("name", n).limit(1);
  return data && data.length ? data[0].id : null;
}

const DATASETS: Dataset[] = [
  {
    key: "machines",
    label: "เครื่อง (S/N)",
    columns: [
      "serial_number", "customer", "brand", "model", "pump_type",
      "install_date", "daily_hours", "site_name", "address_line", "district", "province", "seller", "status", "note",
    ],
    matchKey: "serial_number",
    load: async () => {
      const { data } = await supabase
        .from("machine_units")
        .select("*, customers(name), compressor_models(name, pump_type, brands(name))")
        .order("serial_number");
      return (data ?? []).map((u: any) => ({
        serial_number: u.serial_number,
        customer: u.customers?.name ?? "",
        brand: u.compressor_models?.brands?.name ?? "",
        model: u.compressor_models?.name ?? "",
        pump_type: u.compressor_models?.pump_type ?? "",
        install_date: u.install_date ?? "",
        daily_hours: u.daily_hours ?? "",
        site_name: u.site_name ?? "",
        address_line: u.address_line ?? "",
        district: u.district ?? "",
        province: u.province ?? "",
        seller: u.seller ?? "",
        status: u.status ?? "",
        note: u.note ?? "",
      }));
    },
    importRow: async (row, mode) => {
      const sn = str(row.serial_number);
      if (!sn) return "skipped";
      const payload: Row = {
        serial_number: sn,
        customer_id: await getOrCreate("customers", str(row.customer)),
        model_id: await getOrCreateModel(str(row.brand), str(row.model), str(row.pump_type)),
        install_date: str(row.install_date) || null,
        daily_hours: num(row.daily_hours),
        site_name: str(row.site_name) || null,
        address_line: str(row.address_line) || null,
        district: str(row.district) || null,
        province: str(row.province) || null,
        seller: str(row.seller) || null,
        note: str(row.note) || null,
      };
      const { data: exist } = await supabase
        .from("machine_units").select("id").eq("serial_number", sn).limit(1);
      if (exist && exist.length) {
        if (mode === "insert") return "skipped";
        const { error } = await supabase.from("machine_units").update(payload as any).eq("id", exist[0].id);
        if (error) throw new Error(error.message);
        return "updated";
      }
      const { error } = await supabase.from("machine_units").insert(payload as any);
      if (error) throw new Error(error.message);
      return "inserted";
    },
  },
  {
    key: "customers",
    label: "ลูกค้า",
    columns: ["name", "phone", "address", "note"],
    matchKey: "name",
    load: async () => {
      const { data } = await supabase.from("customers").select("name, phone, address, note").order("name");
      return data ?? [];
    },
    importRow: async (row, mode) => {
      const name = str(row.name);
      if (!name) return "skipped";
      const payload = {
        name,
        phone: str(row.phone) || null,
        address: str(row.address) || null,
        note: str(row.note) || null,
      };
      const { data: exist } = await supabase.from("customers").select("id").ilike("name", name).limit(1);
      if (exist && exist.length) {
        if (mode === "insert") return "skipped";
        const { error } = await supabase.from("customers").update(payload as any).eq("id", exist[0].id);
        if (error) throw new Error(error.message);
        return "updated";
      }
      const { error } = await supabase.from("customers").insert(payload as any);
      if (error) throw new Error(error.message);
      return "inserted";
    },
  },
  {
    key: "products",
    label: "สินค้า/อะไหล่",
    columns: [
      "part_number", "name", "category", "brand", "price",
      "stock_quantity", "storage_location", "service_interval_hours", "description",
    ],
    matchKey: "part_number",
    load: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, brands(name), categories(name)")
        .order("part_number");
      return (data ?? []).map((p: any) => ({
        part_number: p.part_number,
        name: p.name,
        category: p.categories?.name ?? "",
        brand: p.brands?.name ?? "",
        price: p.price ?? "",
        stock_quantity: p.stock_quantity ?? 0,
        storage_location: p.storage_location ?? "",
        service_interval_hours: p.service_interval_hours ?? "",
        description: p.description ?? "",
      }));
    },
    importRow: async (row, mode) => {
      const pn = str(row.part_number);
      if (!pn) return "skipped";
      const payload: Row = {
        part_number: pn,
        name: str(row.name) || pn,
        category_id: await getCategoryId(str(row.category)),
        brand_id: await getOrCreate("brands", str(row.brand)),
        price: num(row.price),
        stock_quantity: num(row.stock_quantity) ?? 0,
        storage_location: str(row.storage_location) || null,
        service_interval_hours: num(row.service_interval_hours),
        description: str(row.description) || null,
      };
      const { data: exist } = await supabase.from("products").select("id").eq("part_number", pn).limit(1);
      if (exist && exist.length) {
        if (mode === "insert") return "skipped";
        const { error } = await supabase.from("products").update(payload as any).eq("id", exist[0].id);
        if (error) throw new Error(error.message);
        return "updated";
      }
      const { error } = await supabase.from("products").insert(payload as any);
      if (error) throw new Error(error.message);
      return "inserted";
    },
  },
  {
    key: "machine_parts",
    label: "อะไหล่ในเครื่อง",
    columns: [
      "serial_number", "part_number", "part_name", "category",
      "quantity", "hours_used", "service_interval_hours", "last_changed_at", "note",
    ],
    load: async () => {
      const { data } = await supabase
        .from("machine_parts")
        .select("*, machine_units(serial_number), products(part_number, name, categories(name))");
      return (data ?? []).map((mp: any) => ({
        serial_number: mp.machine_units?.serial_number ?? "",
        part_number: mp.products?.part_number ?? "",
        part_name: mp.products?.name ?? "",
        category: mp.products?.categories?.name ?? "",
        quantity: mp.quantity,
        hours_used: mp.hours_used ?? "",
        service_interval_hours: mp.service_interval_hours ?? "",
        last_changed_at: mp.last_changed_at ?? "",
        note: mp.note ?? "",
      }));
    },
    importRow: async (row, mode) => {
      const sn = str(row.serial_number);
      const pn = str(row.part_number);
      if (!sn || !pn) return "skipped";
      const { data: units } = await supabase
        .from("machine_units").select("id").eq("serial_number", sn).limit(1);
      if (!units || !units.length) return "skipped";
      let productId: string;
      const { data: prods } = await supabase.from("products").select("id").eq("part_number", pn).limit(1);
      if (prods && prods.length) productId = prods[0].id;
      else {
        const { data: ins, error } = await supabase
          .from("products")
          .insert({
            part_number: pn,
            name: str(row.part_name) || pn,
            category_id: await getCategoryId(str(row.category)),
            service_interval_hours: num(row.service_interval_hours),
          })
          .select("id").single();
        if (error) throw new Error(error.message);
        productId = ins.id;
      }
      const payload: Row = {
        machine_unit_id: units[0].id,
        product_id: productId,
        quantity: num(row.quantity) ?? 1,
        hours_used: num(row.hours_used),
        service_interval_hours: num(row.service_interval_hours),
        last_changed_at: str(row.last_changed_at) || null,
        note: str(row.note) || null,
      };
      const { data: exist } = await supabase
        .from("machine_parts").select("id")
        .eq("machine_unit_id", units[0].id).eq("product_id", productId).limit(1);
      if (exist && exist.length) {
        if (mode === "insert") return "skipped";
        const { error } = await supabase.from("machine_parts").update(payload as any).eq("id", exist[0].id);
        if (error) throw new Error(error.message);
        return "updated";
      }
      const { error } = await supabase.from("machine_parts").insert(payload as any);
      if (error) throw new Error(error.message);
      return "inserted";
    },
  },
  {
    key: "brands",
    label: "ยี่ห้อ",
    columns: ["name"],
    matchKey: "name",
    load: async () => {
      const { data } = await supabase.from("brands").select("name").order("name");
      return data ?? [];
    },
    importRow: async (row) => {
      const name = str(row.name);
      if (!name) return "skipped";
      const { data: exist } = await supabase.from("brands").select("id").ilike("name", name).limit(1);
      if (exist && exist.length) return "skipped";
      const { error } = await supabase.from("brands").insert({ name });
      if (error) throw new Error(error.message);
      return "inserted";
    },
  },
  {
    key: "models",
    label: "รุ่นเครื่อง",
    columns: ["brand", "name", "pump_type", "description"],
    load: async () => {
      const { data } = await supabase
        .from("compressor_models").select("*, brands(name)").order("name");
      return (data ?? []).map((m: any) => ({
        brand: m.brands?.name ?? "",
        name: m.name,
        pump_type: m.pump_type ?? "",
        description: m.description ?? "",
      }));
    },
    importRow: async (row) => {
      const name = str(row.name);
      if (!name) return "skipped";
      const id = await getOrCreateModel(str(row.brand), name, str(row.pump_type));
      return id ? "inserted" : "skipped";
    },
  },
];

export function ImportExportTab() {
  const [dsKey, setDsKey] = useState("machines");
  const ds = DATASETS.find((d) => d.key === dsKey)!;
  const [cols, setCols] = useState<string[]>(ds.columns);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Row[] | null>(null);
  const [mode, setMode] = useState<"insert" | "upsert">("upsert");
  const [lastSize, setLastSize] = useState<string | null>(null);
  const [allRows, setAllRows] = useState<Row[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [rowQ, setRowQ] = useState("");

  function changeDataset(k: string) {
    setDsKey(k);
    setCols(DATASETS.find((d) => d.key === k)!.columns);
    setPreview(null);
    setAllRows(null);
    setPicked(new Set());
    setRowQ("");
  }

  async function loadRows() {
    setBusy(true);
    try {
      const rows = await ds.load();
      setAllRows(rows);
      setPicked(new Set(rows.map((_, i) => i)));
      toast.success(`โหลดข้อมูล ${rows.length} รายการ — เลือกรายการที่ต้องการส่งออกได้`);
    } catch (e: any) {
      toast.error("โหลดข้อมูลไม่สำเร็จ: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  function togglePick(i: number) {
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i); else n.add(i);
      return n;
    });
  }
  function toggleCol(c: string) {
    setCols((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]));
  }

  async function rowsForExport() {
    const all = allRows ?? (await ds.load());
    const chosen = allRows ? all.filter((_, i) => picked.has(i)) : all;
    if (!chosen.length) throw new Error("ยังไม่ได้เลือกรายการ");
    return chosen.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? ""])));
  }

  async function exportFile(kind: "xlsx" | "csv") {
    if (cols.length === 0) return toast.error("เลือกคอลัมน์อย่างน้อย 1 ช่อง");
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const rows = await rowsForExport();
      const ws = XLSX.utils.json_to_sheet(rows, { header: cols });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, ds.label.slice(0, 30));
      const out =
        kind === "xlsx"
          ? XLSX.write(wb, { bookType: "xlsx", type: "array" })
          : new TextEncoder().encode("\uFEFF" + XLSX.utils.sheet_to_csv(ws));
      const blob = new Blob([out], {
        type: kind === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv;charset=utf-8",
      });
      setLastSize(formatBytes(blob.size));
      downloadBlob(blob, `${ds.key}-${new Date().toISOString().slice(0, 10)}.${kind}`);
      toast.success(`ส่งออก ${kind.toUpperCase()} แล้ว (${formatBytes(blob.size)})`);
    } catch (e: any) {
      toast.error("ส่งออกไม่สำเร็จ: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function exportPdf() {
    if (cols.length === 0) return toast.error("เลือกคอลัมน์อย่างน้อย 1 ช่อง");
    setBusy(true);
    try {
      const rows = await rowsForExport();
      const blob = await tableToPdfBlob(ds.label, cols, rows, LABELS);
      setLastSize(formatBytes(blob.size));
      await shareOrDownload(blob, `${ds.key}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(`ส่งออก PDF แล้ว (${formatBytes(blob.size)})`);
    } catch (e: any) {
      toast.error("ส่งออก PDF ไม่สำเร็จ: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet([Object.fromEntries(ds.columns.map((c) => [c, ""]))], {
      header: ds.columns,
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "template");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(
      new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `template-${ds.key}.xlsx`,
    );
  }

  async function pickFile(file: File) {
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "", raw: false });
      if (!rows.length) return toast.error("ไม่พบข้อมูลในไฟล์");
      setPreview(rows);
      toast.success(`อ่านไฟล์แล้ว ${rows.length} แถว — ตรวจสอบแล้วกดนำเข้า`);
    } catch (e: any) {
      toast.error("อ่านไฟล์ไม่สำเร็จ: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!preview || !ds.importRow) return;
    setBusy(true);
    let inserted = 0, updated = 0, skipped = 0, failed = 0;
    for (const row of preview) {
      try {
        const r = await ds.importRow(row, mode);
        if (r === "inserted") inserted++;
        else if (r === "updated") updated++;
        else skipped++;
      } catch {
        failed++;
      }
    }
    setBusy(false);
    setPreview(null);
    toast.success(`นำเข้าเสร็จ: เพิ่ม ${inserted} • อัปเดต ${updated} • ข้าม ${skipped} • ผิดพลาด ${failed}`, {
      duration: 8000,
    });
  }

  const previewCols = preview && preview.length ? Object.keys(preview[0]) : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />เลือกข้อมูล</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-xs">
            <Label>ตารางข้อมูล</Label>
            <Select value={dsKey} onValueChange={changeDataset}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DATASETS.map((d) => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>คอลัมน์ที่ต้องการส่งออก</Label>
            <div className="mb-1 flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setCols(ds.columns)}>เลือกทั้งหมด</Button>
              <Button size="sm" variant="ghost" onClick={() => setCols([])}>ล้าง</Button>
            </div>
            <div className="mt-1 flex flex-wrap gap-3 rounded border p-3">
              {ds.columns.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={cols.includes(c)} onCheckedChange={() => toggleCol(c)} />
                  {LABELS[c] ?? c}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={loadRows} disabled={busy}>
                โหลดรายการเพื่อเลือกข้อมูล
              </Button>
              {allRows && (
                <>
                  <Input
                    className="h-8 max-w-52"
                    placeholder="ค้นหาในรายการ…"
                    value={rowQ}
                    onChange={(e) => setRowQ(e.target.value)}
                  />
                  <Button size="sm" variant="ghost" onClick={() => setPicked(new Set(allRows.map((_, i) => i)))}>เลือกทั้งหมด</Button>
                  <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>ล้าง</Button>
                  <Badge variant="secondary">เลือกแล้ว {picked.size}/{allRows.length}</Badge>
                </>
              )}
            </div>
            {allRows && (
              <div className="max-h-64 overflow-auto rounded border">
                {allRows.map((r, i) => {
                  const text = ds.columns.map((c) => String(r[c] ?? "")).join(" ").toLowerCase();
                  if (rowQ && !text.includes(rowQ.toLowerCase())) return null;
                  return (
                    <label key={i} className="flex items-center gap-2 border-b px-2 py-1 text-xs last:border-b-0">
                      <Checkbox checked={picked.has(i)} onCheckedChange={() => togglePick(i)} />
                      <span className="truncate">
                        {ds.columns.slice(0, 4).map((c) => String(r[c] ?? "")).filter(Boolean).join(" • ")}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" />ส่งออกข้อมูล</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button onClick={() => exportFile("xlsx")} disabled={busy}>Excel (.xlsx)</Button>
          <Button variant="outline" onClick={() => exportFile("csv")} disabled={busy}>CSV / Google Sheets</Button>
          <Button variant="outline" onClick={exportPdf} disabled={busy}>PDF</Button>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {lastSize && <Badge variant="secondary">ขนาดไฟล์ล่าสุด {lastSize}</Badge>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />นำเข้าข้อมูล</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!ds.importRow ? (
            <p className="text-sm text-muted-foreground">ตารางนี้ยังไม่รองรับการนำเข้า</p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-52">
                  <Label>ไฟล์ Excel / CSV</Label>
                  <Input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
                  />
                </div>
                <div className="min-w-48">
                  <Label>วิธีนำเข้า</Label>
                  <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upsert">อัปเดตทับของเดิม + เพิ่มใหม่</SelectItem>
                      <SelectItem value="insert">เพิ่มใหม่เท่านั้น (ข้ามของซ้ำ)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={downloadTemplate}>ดาวน์โหลดไฟล์ตัวอย่าง</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                หัวคอลัมน์ที่รองรับ: {ds.columns.join(", ")}
              </p>

              {preview && (
                <div className="space-y-2">
                  <div className="max-h-72 overflow-auto rounded border">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted">
                        <tr>{previewCols.map((c) => <th key={c} className="px-2 py-1 text-left">{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {preview.slice(0, 50).map((r, i) => (
                          <tr key={i} className="border-t">
                            {previewCols.map((c) => <td key={c} className="px-2 py-1">{String(r[c] ?? "")}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={runImport} disabled={busy}>
                      {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                      นำเข้า {preview.length} แถว
                    </Button>
                    <Button variant="outline" onClick={() => setPreview(null)}>ยกเลิก</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Search,
  Loader2,
  Package,
  MapPin,
  Clock,
  CalendarClock,
  MessageCircle,
  Phone,
  Wrench,
  Printer,
  Share2,
} from "lucide-react";
import { toast } from "sonner";

function formatDate(d: string | null | undefined): string {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ค้นหาอะไหล่ปั๊มลม" },
      {
        name: "description",
        content: "ค้นหาอะไหล่ปั๊มลมด้วยรหัส ชื่อ หรือรุ่น พร้อมกรองตามหมวดหมู่และเช็กสต็อก",
      },
    ],
  }),
  component: HomePage,
});

type Category = { id: string; name: string; sort_order: number | null };
type Product = {
  id: string;
  name: string;
  part_number: string;
  price: number | null;
  image_url: string | null;
  description: string | null;
  stock_quantity: number | null;
  storage_location: string | null;
  service_interval_hours: number | null;
  category_id: string | null;
  categories: { id: string; name: string } | null;
  compressor_models: { id: string; name: string; brands: { name: string } | null } | null;
};

function HomePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          ระบบค้นหาอะไหล่ปั๊มลม
        </h1>
        <p className="text-sm text-muted-foreground">
          ค้นหาอะไหล่ด้วยรหัส ชื่อ หรือรุ่น พร้อมกรองตามหมวดหมู่และเช็กสต็อกคงเหลือ
        </p>
      </header>

      <Tabs defaultValue="sn" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-flex">
          <TabsTrigger value="sn">ค้นด้วย S/N เครื่อง</TabsTrigger>
          <TabsTrigger value="catalog">คลังอะไหล่</TabsTrigger>
        </TabsList>
        <TabsContent value="sn" className="mt-4">
          <SnView />
        </TabsContent>
        <TabsContent value="catalog" className="mt-4">
          <CatalogView />
        </TabsContent>
      </Tabs>

    </div>
  );
}

/* ---------------- Catalog ---------------- */

function CatalogView() {
  const [q, setQ] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [lineUrl, setLineUrl] = useState("https://line.me/");
  const [contact, setContact] = useState("");

  useEffect(() => {
    (async () => {
      const [cats, prods, settings] = await Promise.all([
        supabase.from("categories").select("id, name, sort_order").order("sort_order"),
        supabase
          .from("products")
          .select(
            `id, name, part_number, price, image_url, description, stock_quantity,
             storage_location, service_interval_hours, category_id,
             categories ( id, name ),
             compressor_models ( id, name, brands ( name ) )`
          )
          .order("name"),
        supabase.from("app_settings").select("key, value"),
      ]);
      if (cats.data) setCategories(cats.data as Category[]);
      if (prods.data) setProducts(prods.data as unknown as Product[]);
      if (settings.data) {
        const m = new Map(settings.data.map((s) => [s.key, s.value]));
        setLineUrl(m.get("line_url") || "https://line.me/");
        setContact(m.get("purchase_contact") || "");
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCat && p.category_id !== selectedCat) return false;
      if (!kw) return true;
      const model = p.compressor_models
        ? `${p.compressor_models.brands?.name ?? ""} ${p.compressor_models.name}`
        : "";
      return (
        p.name.toLowerCase().includes(kw) ||
        p.part_number.toLowerCase().includes(kw) ||
        model.toLowerCase().includes(kw)
      );
    });
  }, [products, q, selectedCat]);

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาด้วยรหัสอะไหล่ ชื่อ หรือรุ่นปั๊มลม"
          className="h-12 pl-10 text-base"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={selectedCat === null} onClick={() => setSelectedCat(null)}>
          ทั้งหมด
        </FilterChip>
        {categories.map((c) => (
          <FilterChip
            key={c.id}
            active={selectedCat === c.id}
            onClick={() => setSelectedCat(c.id)}
          >
            {c.name}
          </FilterChip>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            ไม่พบอะไหล่ที่ตรงกับเงื่อนไข
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} onOpen={() => setSelected(p)} />
          ))}
        </div>
      )}

      <ProductModal
        product={selected}
        onClose={() => setSelected(null)}
        lineUrl={lineUrl}
        contact={contact}
      />
    </div>
  );
}

function FilterChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1.5 text-sm transition-colors " +
        (active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-accent")
      }
    >
      {children}
    </button>
  );
}

function ProductCard({ product, onOpen }: { product: Product; onOpen: () => void }) {
  const stock = product.stock_quantity ?? 0;
  const inStock = stock > 0;
  const model = product.compressor_models
    ? `${product.compressor_models.brands?.name ?? ""} ${product.compressor_models.name}`.trim()
    : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden bg-muted">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-10 w-10 text-muted-foreground/50" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold">{product.name}</h3>
            <p className="truncate text-xs text-muted-foreground">
              Part# {product.part_number}
            </p>
          </div>
          <Badge variant={inStock ? "default" : "secondary"} className="shrink-0">
            {inStock ? `มี ${stock}` : "หมด"}
          </Badge>
        </div>
        {product.categories && (
          <div className="text-xs text-muted-foreground">{product.categories.name}</div>
        )}
        {model && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Wrench className="h-3 w-3" /> {model}
          </div>
        )}
        {product.storage_location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" /> ชั้น {product.storage_location}
          </div>
        )}
      </div>
    </button>
  );
}

function ProductModal({
  product,
  onClose,
  lineUrl,
  contact,
}: {
  product: Product | null;
  onClose: () => void;
  lineUrl: string;
  contact: string;
}) {
  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {product && (
          <>
            <DialogHeader>
              <DialogTitle>{product.name}</DialogTitle>
              <DialogDescription>Part# {product.part_number}</DialogDescription>
            </DialogHeader>
            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full rounded-lg object-cover"
              />
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info
                label="สถานะ"
                value={(product.stock_quantity ?? 0) > 0 ? `มีสินค้า (${product.stock_quantity})` : "สินค้าหมด"}
              />
              <Info label="หมวดหมู่" value={product.categories?.name ?? "-"} />
              <Info
                label="ตำแหน่งจัดเก็บ"
                value={product.storage_location ? `ชั้น ${product.storage_location}` : "-"}
              />
              <Info
                label="ราคา"
                value={product.price != null ? `฿${Number(product.price).toLocaleString()}` : "-"}
              />
              <Info
                label="รุ่นที่รองรับ"
                value={
                  product.compressor_models
                    ? `${product.compressor_models.brands?.name ?? ""} ${product.compressor_models.name}`.trim()
                    : "-"
                }
              />
              <Info
                label="รอบเปลี่ยน (ชม.)"
                value={
                  product.service_interval_hours ? `${product.service_interval_hours} ชม.` : "-"
                }
              />
            </div>
            {product.description && (
              <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                {product.description}
              </div>
            )}
            <DialogFooter className="gap-2 sm:justify-start">
              <Button asChild>
                <a href={lineUrl} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" /> ส่งข้อมูลเข้า LINE
                </a>
              </Button>
              {contact && (
                <Button variant="outline" asChild>
                  <a href={`tel:${contact}`}>
                    <Phone className="mr-2 h-4 w-4" /> ติดต่อฝ่ายจัดซื้อ
                  </a>
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card/50 p-2.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

/* ---------------- S/N View ---------------- */

type MachinePart = {
  id: string;
  quantity: number;
  note: string | null;
  hours_used: number | null;
  last_changed_at: string | null;
  service_interval_hours: number | null;
  products: {
    id: string;
    name: string;
    part_number: string;
    price: number | null;
    image_url: string | null;
    storage_location: string | null;
    service_interval_hours: number | null;
    stock_quantity: number | null;
    categories: { id: string; name: string; sort_order: number | null } | null;
  } | null;
};

type MachineResult = {
  id: string;
  serial_number: string;
  install_date: string | null;
  daily_hours: number | null;
  note: string | null;
  customers: { id: string; name: string; phone: string | null } | null;
  compressor_models:
    | { id: string; name: string; brands: { id: string; name: string } | null }
    | null;
  machine_parts: MachinePart[];
};

function SnView() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<MachineResult[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("machine_units")
      .select(
        `id, serial_number, install_date, daily_hours, note,
         customers ( id, name, phone ),
         compressor_models ( id, name, brands ( id, name ) ),
         machine_parts (
           id, quantity, note, hours_used, last_changed_at, service_interval_hours,
           products (
             id, name, part_number, price, image_url, storage_location,
             service_interval_hours, stock_quantity,
             categories ( id, name, sort_order )
           )
         )`
      )
      .order("serial_number");
    setLoading(false);
    if (error) return toast.error("โหลดข้อมูลผิดพลาด: " + error.message);
    setUnits((data as unknown as MachineResult[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return units;
    return units.filter((u) => {
      const brand = u.compressor_models?.brands?.name ?? "";
      const model = u.compressor_models?.name ?? "";
      const cust = u.customers?.name ?? "";
      const phone = u.customers?.phone ?? "";
      const parts = (u.machine_parts ?? [])
        .map((mp) =>
          `${mp.products?.name ?? ""} ${mp.products?.part_number ?? ""} ${mp.products?.categories?.name ?? ""}`
        )
        .join(" ");
      return `${u.serial_number} ${brand} ${model} ${cust} ${phone} ${parts}`
        .toLowerCase()
        .includes(kw);
    }).sort((a, b) => a.serial_number.localeCompare(b.serial_number, "th"));
  }, [units, q]);


  useEffect(() => {
    if (filtered.length === 1) setOpenId(filtered[0].id);
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          list="sn-search-options"
          placeholder="ค้นหาด้วย S/N, รุ่น, ยี่ห้อ, ชื่อลูกค้า หรือชื่ออะไหล่"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-12 pl-10 text-base"
        />
        <datalist id="sn-search-options">
          {units.map((u) => {
            const label = [
              u.serial_number,
              u.compressor_models?.brands?.name,
              u.compressor_models?.name,
              u.customers?.name,
            ].filter(Boolean).join(" • ");
            return <option key={u.id} value={u.serial_number}>{label}</option>;
          })}
        </datalist>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            ไม่พบเครื่องที่ตรงกับคำค้นหา
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">พบ {filtered.length} เครื่อง</p>
          {filtered.map((u) => (
            <MachineCard
              key={u.id}
              unit={u}
              open={openId === u.id}
              onToggle={() => setOpenId(openId === u.id ? null : u.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MachineCard({
  unit,
  open,
  onToggle,
}: {
  unit: MachineResult;
  open: boolean;
  onToggle: () => void;
}) {
  const grouped = groupByCategory(unit.machine_parts ?? []);
  const model = unit.compressor_models
    ? `${unit.compressor_models.brands?.name ?? ""} ${unit.compressor_models.name}`.trim()
    : "-";
  return (
    <Card>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <div className="font-semibold">{unit.serial_number}</div>
          <div className="truncate text-xs text-muted-foreground">
            {model} • {unit.customers?.name ?? "-"} • อะไหล่ {unit.machine_parts?.length ?? 0} รายการ
          </div>
        </div>
        <Badge variant="outline">{open ? "ซ่อน" : "ดูข้อมูล"}</Badge>
      </button>
      {open && (
        <CardContent id={`print-${unit.id}`} className="space-y-4 border-t pt-4">
          <div className="no-print flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => printMachine(unit.id, unit.serial_number)}>
              <Printer className="mr-1 h-4 w-4" /> พรีวิว / พิมพ์ PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => shareMachine(unit)}>
              <Share2 className="mr-1 h-4 w-4" /> ส่งออก / แชร์
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="S/N" value={unit.serial_number} />
            <Info label="รุ่นเครื่อง" value={model} />
            <Info label="ลูกค้า" value={unit.customers?.name ?? "-"} />
            <Info label="เบอร์โทร" value={unit.customers?.phone ?? "-"} />
            <Info
              label="ชม.ทำงาน/วัน"
              value={unit.daily_hours != null ? `${unit.daily_hours} ชม.` : "-"}
            />
            {unit.install_date && <Info label="วันที่ติดตั้ง" value={formatDate(unit.install_date)} />}
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Package className="h-4 w-4" /> รายการอะไหล่
            </div>
            {grouped.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                ยังไม่มีรายการอะไหล่สำหรับเครื่องนี้
              </p>
            ) : (
              <div className="space-y-4">
                {grouped.map((g) => (
                  <div key={g.name}>
                    <h3 className="mb-2 text-sm font-semibold text-primary">{g.name}</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {g.items.map((mp) => (
                        <PartRow key={mp.id} mp={mp} dailyHours={unit.daily_hours ?? null} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function PartRow({ mp, dailyHours }: { mp: MachinePart; dailyHours: number | null }) {
  const interval = mp.service_interval_hours ?? mp.products?.service_interval_hours ?? null;
  const nextChange = computeNextChange(mp.last_changed_at, interval, dailyHours);
  return (
    <div className="flex gap-3 rounded-lg border bg-card p-3">
      {mp.products?.image_url ? (
        <img
          src={mp.products.image_url}
          alt={mp.products.name}
          className="h-20 w-20 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded bg-muted">
          <Package className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="truncate font-medium">{mp.products?.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          Part# {mp.products?.part_number}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">จำนวน {mp.quantity}</Badge>
          {mp.hours_used != null && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" /> {mp.hours_used} ชม.
            </Badge>
          )}
          {mp.products?.storage_location && (
            <Badge variant="outline" className="gap-1">
              <MapPin className="h-3 w-3" /> {mp.products.storage_location}
            </Badge>
          )}
        </div>
        <div className="mt-1 grid gap-1 text-xs sm:grid-cols-2">
          <div className="flex items-center gap-1 rounded bg-muted/50 px-2 py-1">
            <CalendarClock className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">เปลี่ยนล่าสุด:</span>
            <span className="font-medium">{formatDate(mp.last_changed_at)}</span>
          </div>
          <div className="flex items-center gap-1 rounded bg-primary/10 px-2 py-1">
            <CalendarClock className="h-3 w-3 text-primary" />
            <span className="text-muted-foreground">ครั้งถัดไป:</span>
            <span className="font-medium text-primary">{formatDate(nextChange)}</span>

          </div>
        </div>
      </div>
    </div>
  );
}

function computeNextChange(
  lastChanged: string | null,
  interval: number | null,
  dailyHours: number | null,
): string | null {
  if (!lastChanged || !interval || !dailyHours || dailyHours <= 0) return null;
  const last = new Date(lastChanged);
  const days = Math.round(interval / dailyHours);
  const next = new Date(last);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
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

async function printMachine(unitId: string, serial: string) {
  const el = document.getElementById(`print-${unitId}`);
  if (!el) return;
  toast.loading("กำลังสร้างไฟล์ PDF...", { id: "pdf" });
  try {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const imgW = pageW - margin * 2;
    const imgH = (canvas.height * imgW) / canvas.width;
    let heightLeft = imgH;
    let position = margin;
    pdf.addImage(imgData, "JPEG", margin, position, imgW, imgH);
    heightLeft -= pageH - margin * 2;
    while (heightLeft > 0) {
      position = margin - (imgH - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", margin, position, imgW, imgH);
      heightLeft -= pageH - margin * 2;
    }
    const filename = `machine-${serial}.pdf`;
    const blob = pdf.output("blob");
    // Try native share with file (works in LINE in-app browser on iOS/Android with share support)
    const file = new File([blob], filename, { type: "application/pdf" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: filename });
        toast.success("ส่งออก PDF แล้ว", { id: "pdf" });
        return;
      } catch {
        /* fall through to download */
      }
    }
    // Fallback: trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("ดาวน์โหลด PDF แล้ว", { id: "pdf" });
  } catch (err) {
    console.error(err);
    toast.error("สร้าง PDF ไม่สำเร็จ", { id: "pdf" });
  }
}


async function shareMachine(unit: MachineResult) {
  const model = unit.compressor_models
    ? `${unit.compressor_models.brands?.name ?? ""} ${unit.compressor_models.name}`.trim()
    : "-";
  const lines: string[] = [
    `S/N: ${unit.serial_number}`,
    `รุ่น: ${model}`,
    `ลูกค้า: ${unit.customers?.name ?? "-"}`,
    `เบอร์: ${unit.customers?.phone ?? "-"}`,
    `ติดตั้ง: ${formatDate(unit.install_date)}`,
    `ชม./วัน: ${unit.daily_hours ?? "-"}`,
    "",
    "รายการอะไหล่:",
  ];
  for (const mp of unit.machine_parts ?? []) {
    const interval = mp.service_interval_hours ?? mp.products?.service_interval_hours ?? null;
    const next = (() => {
      if (!mp.last_changed_at || !interval || !unit.daily_hours || unit.daily_hours <= 0) return null;
      const d = new Date(mp.last_changed_at);
      d.setDate(d.getDate() + Math.round(interval / unit.daily_hours));
      return d.toISOString().slice(0, 10);
    })();
    lines.push(
      `- [${mp.products?.categories?.name ?? "-"}] ${mp.products?.name ?? ""} (${mp.products?.part_number ?? ""}) x${mp.quantity} | เปลี่ยนล่าสุด ${formatDate(mp.last_changed_at)} | ครั้งถัดไป ${formatDate(next)}`,
    );
  }
  const shareUrl = `${window.location.origin}/?sn=${encodeURIComponent(unit.serial_number)}`;
  const text = lines.join("\n") + `\n\nเปิดค้นหา: ${shareUrl}`;
  const title = `ข้อมูลเครื่อง ${unit.serial_number}`;
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url: shareUrl });
      return;
    }
  } catch {
    /* user cancelled */
  }
  // Fallback: open LINE share
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
  window.open(lineUrl, "_blank");
}



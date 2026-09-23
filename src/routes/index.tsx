import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { loadOffline, offlineSavedAt, saveOffline } from "@/lib/offline";
import { useBundles } from "@/lib/bundles";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CollapsibleSection } from "@/components/CollapsibleSection";
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
import { WorkOrderDialog } from "@/components/WorkOrderDialog";
import { PartsAlertPanel } from "@/components/PartsAlertPanel";
import { SmartSearchDialog } from "@/components/SmartSearchDialog";
import { AdminLockButton } from "@/components/AccessGate";
import { deleteAsAdmin, useAccess } from "@/lib/access";
import { AlertToggles } from "@/lib/prefs";
import { ConfirmButton } from "@/components/ConfirmButton";
import { isMachineComplete } from "@/lib/report";
import {
  CalendarDays,
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
  QrCode,
  Download,
  Smartphone,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { DateInput } from "@/components/ui/date-input";

function formatDate(d: string | null | undefined): string {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear() + 543; // พ.ศ.
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
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("sn");
  const [searchOpen, setSearchOpen] = useState(false);
  const [seller, setSeller] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [focusToken, setFocusToken] = useState(0);

  return (
    <div className="space-y-5 pb-24">
      {/* ===== แถวที่ 1: ปุ่มค้นหาทางลัดอัจฉริยะ ===== */}
      <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:bg-card sm:px-4 sm:shadow-sm">
        <Button
          className="h-14 w-full justify-start rounded-xl text-base"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="mr-3 h-6 w-6" /> 🔍 ค้นหาทางลัดอัจฉริยะ (Smart Search Popup)
        </Button>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/planner">
              <CalendarDays className="mr-1 h-4 w-4" /> ปฏิทินแพลนเนอร์
            </Link>
          </Button>
          <ThemePicker />
          <ShareAppButton />
          <AdminLockButton />
        </div>
        <div className="mt-2">
          <AlertToggles />
        </div>
      </div>

      {/* ===== แถวที่ 2: ปุ่มด่วนเพิ่มเครื่องใหม่ ===== */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <Button asChild size="sm">
          <Link to="/admin">
            <Wrench className="mr-1 h-4 w-4" /> ➕ เพิ่มเครื่องจักรใหม่ / ลูกค้าใหม่
          </Link>
        </Button>
        <span className="text-xs text-muted-foreground">เปิดหน้าจัดการข้อมูลเพื่อบันทึกเครื่องใหม่</span>
      </div>

      {/* ===== แถวที่ 3: แจ้งเตือนอายุอะไหล่ 30 วัน ===== */}
      <CollapsibleSection
        title="อะไหล่ครบกำหนดเปลี่ยนใน 30 วัน"
        subtitle="เปิดดูรายการอะไหล่ที่ใกล้ครบกำหนด"
      >
        <PartsAlertPanel />
      </CollapsibleSection>

      {/* ===== แถวที่ 4: ตารางข้อมูลทั้งหมด (ยุบแถว) ===== */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid h-12 w-full grid-cols-2 sm:w-auto sm:inline-flex">
          <TabsTrigger value="sn" className="text-sm">ข้อมูลเครื่องจักรทั้งหมด</TabsTrigger>
          <TabsTrigger value="catalog" className="text-sm">คลังอะไหล่</TabsTrigger>
        </TabsList>
        <TabsContent value="sn" className="mt-4">
          <SnView
            q={q}
            setQ={setQ}
            seller={seller}
            setSeller={setSeller}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            focusToken={focusToken}
          />
        </TabsContent>
        <TabsContent value="catalog" className="mt-4">
          <CatalogView />
        </TabsContent>
      </Tabs>

      <InstallPromptCard />

      <SmartSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onConfirm={({ text, seller: s, status }) => {
          setSeller(s);
          setStatusFilter(status);
          setQ(text);
          setTab("sn");
          setFocusToken((n) => n + 1);
        }}
      />

      {/* ปุ่มเขียนใบสั่งงานใหม่ — ขอบล่างสุดของหน้าจอ */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-5xl justify-center">
          <WorkOrderDialog />
        </div>
      </div>
    </div>
  );
}



function InstallPromptCard() {
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches || (window as any).standalone === true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("install_card_dismissed");
    if (saved) setDismissed(true);
  }, []);

  const installApp = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    const { outcome } = await installEvt.userChoice;
    if (outcome === "accepted") toast.success("ติดตั้งแอปแล้ว");
    setInstallEvt(null);
  };

  const dismiss = () => {
    localStorage.setItem("install_card_dismissed", "1");
    setDismissed(true);
  };

  if (dismissed || isStandalone) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Download className="h-5 w-5" />
            ใช้งานเหมือนแอปบนมือถือ
          </div>
          <p className="text-sm text-muted-foreground">
            ติดตั้งลงหน้าจอโฮมเพื่อเปิดค้นหาได้ทันที ไม่ต้องเปิดเว็บไซต์ทุกครั้ง
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {installEvt ? (
            <Button size="sm" onClick={installApp}>
              <Download className="mr-1 h-4 w-4" /> ติดตั้งแอป
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => toast.info("iOS: กดแชร์ → เพิ่มลงหน้าจอโฮม\nAndroid: เมนู ⋮ → เพิ่มลงหน้าจอโฮม")}>
              <Smartphone className="mr-1 h-4 w-4" /> วิธีติดตั้ง
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={dismiss}>
            ซ่อน
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ShareAppButton() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setUrl(`${window.location.origin}/`);
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches || (window as any).standalone === true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const shareToLine = () => {
    const text = `ระบบค้นหาอะไหล่ปั๊มลม — ค้นหาอะไหล่ด้วย S/N หรือรุ่นเครื่อง\n${url}`;
    // Try native LINE app first, fallback to web
    const lineApp = `line://msg/text/${encodeURIComponent(text)}`;
    const lineWeb = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
    const now = Date.now();
    window.location.href = lineApp;
    setTimeout(() => {
      if (Date.now() - now < 1500) {
        window.open(lineWeb, "_blank");
      }
    }, 800);
  };

  const nativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "ระบบค้นหาอะไหล่ปั๊มลม",
          text: "ค้นหาอะไหล่ปั๊มลมด้วย S/N หรือรุ่นเครื่อง",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("คัดลอกลิงก์แล้ว");
      }
    } catch {
      /* user cancelled */
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("คัดลอกลิงก์แล้ว");
    } catch {
      toast.error("คัดลอกไม่สำเร็จ");
    }
  };

  const saveQr = () => {
    const canvas = document.querySelector<HTMLCanvasElement>("#share-app-qr canvas");
    if (!canvas) return toast.error("ยังสร้าง QR ไม่สำเร็จ");
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "qr-ระบบค้นหาอะไหล่.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast.success("บันทึกรูป QR แล้ว");
    }, "image/png");
  };

  const installApp = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    const { outcome } = await installEvt.userChoice;
    if (outcome === "accepted") toast.success("ติดตั้งแอปแล้ว");
    setInstallEvt(null);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <QrCode className="mr-1 h-4 w-4" /> แชร์แอป
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แชร์แอปให้ผู้อื่นใช้งาน</DialogTitle>
            <DialogDescription>
              ผู้รับสามารถกดเปิดแล้วค้นหาข้อมูลได้ทันที ไม่ต้องพิมพ์ URL
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {url && (
              <div id="share-app-qr" className="rounded-xl border-4 border-white bg-white p-3 shadow-sm">
                <QRCodeCanvas value={url} size={240} includeMargin />
              </div>
            )}
            <div className="w-full rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">วิธีใช้งาน</p>
              <ol className="mt-1 list-inside list-decimal space-y-0.5">
                <li>สแกน QR ด้วยกล้องในแอป LINE หรือกล้องมือถือ</li>
                <li>กดเปิดลิงก์ที่ขึ้นมา</li>
                <li>กด “เพิ่มลงหน้าจอโฮม” เพื่อใช้เหมือนแอป</li>
              </ol>
            </div>
            <div className="flex w-full flex-wrap justify-center gap-2">
              <Button variant="outline" size="sm" onClick={saveQr}>
                บันทึกรูป QR
              </Button>
              {installEvt && !isStandalone && (
                <Button variant="default" size="sm" onClick={installApp}>
                  ติดตั้งลงเครื่อง
                </Button>
              )}
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={copyLink} className="w-full sm:w-auto">
              คัดลอกลิงก์
            </Button>
            <Button variant="outline" onClick={nativeShare} className="w-full sm:w-auto">
              <Share2 className="mr-1 h-4 w-4" /> แชร์
            </Button>
            <Button onClick={shareToLine} className="w-full sm:w-auto">
              <MessageCircle className="mr-1 h-4 w-4" /> ส่งเข้า LINE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const THEME_PRESETS: { name: string; primary: string; ring: string; swatch: string }[] = [
  { name: "น้ำเงินเข้ม (ค่าเริ่มต้น)", primary: "oklch(0.42 0.06 220)", ring: "oklch(0.42 0.06 220)", swatch: "#264a6b" },
  { name: "ฟ้า", primary: "oklch(0.55 0.18 240)", ring: "oklch(0.55 0.18 240)", swatch: "#2563eb" },
  { name: "เขียว", primary: "oklch(0.55 0.15 150)", ring: "oklch(0.55 0.15 150)", swatch: "#16a34a" },
  { name: "ส้ม", primary: "oklch(0.65 0.18 45)", ring: "oklch(0.65 0.18 45)", swatch: "#ea580c" },
  { name: "แดง", primary: "oklch(0.55 0.2 25)", ring: "oklch(0.55 0.2 25)", swatch: "#dc2626" },
  { name: "ม่วง", primary: "oklch(0.5 0.2 300)", ring: "oklch(0.5 0.2 300)", swatch: "#7c3aed" },
  { name: "ชมพู", primary: "oklch(0.65 0.2 350)", ring: "oklch(0.65 0.2 350)", swatch: "#ec4899" },
  { name: "เทา", primary: "oklch(0.35 0.02 260)", ring: "oklch(0.35 0.02 260)", swatch: "#334155" },
];

function applyTheme(primary: string, ring: string) {
  const root = document.documentElement;
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--ring", ring);
}

function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string>(THEME_PRESETS[0].swatch);

  useEffect(() => {
    const saved = localStorage.getItem("app_theme");
    if (saved) {
      const preset = THEME_PRESETS.find((t) => t.swatch === saved);
      if (preset) {
        applyTheme(preset.primary, preset.ring);
        setCurrent(preset.swatch);
      }
    }
  }, []);

  const pick = (p: (typeof THEME_PRESETS)[number]) => {
    applyTheme(p.primary, p.ring);
    localStorage.setItem("app_theme", p.swatch);
    setCurrent(p.swatch);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <span
          className="mr-2 inline-block h-4 w-4 rounded-full border"
          style={{ background: current }}
        />
        ธีมสี
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เลือกธีมสี</DialogTitle>
            <DialogDescription>เลือกสีหลักของแอป จะบันทึกไว้ในเครื่องนี้อัตโนมัติ</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 py-2 sm:grid-cols-4">
            {THEME_PRESETS.map((p) => {
              const active = current === p.swatch;
              return (
                <button
                  key={p.swatch}
                  type="button"
                  onClick={() => pick(p)}
                  className={
                    "flex flex-col items-center gap-2 rounded-lg border p-3 text-xs transition-colors " +
                    (active ? "border-primary ring-2 ring-primary" : "hover:bg-accent")
                  }
                >
                  <span
                    className="h-10 w-10 rounded-full border"
                    style={{ background: p.swatch }}
                  />
                  <span className="text-center leading-tight">{p.name}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
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

  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    setPage(1);
  }, [q, selectedCat]);
  const pageItems = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาด้วยรหัสอะไหล่ ชื่อ หรือรุ่นปั๊มลม"
            className="h-12 pl-10 text-base"
          />
        </div>
        <Button className="h-12 px-5" onClick={() => setQ((v) => v.trim())}>
          <Search className="mr-1 h-4 w-4" /> ค้นหา
        </Button>
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
        <>
          <p className="text-xs text-muted-foreground">
            พบ {filtered.length} รายการ · แสดงหน้า {page} จาก {totalPages} (หน้าละ {PAGE_SIZE} รายการ)
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((p) => (
              <ProductCard key={p.id} product={p} onOpen={() => setSelected(p)} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
                ก่อนหน้า
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((n) => n + 1)}
              >
                ถัดไป
              </Button>
            </div>
          )}
        </>
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
  customer_sn?: string | null;
  install_date: string | null;
  daily_hours: number | null;
  note: string | null;
  customers: { id: string; name: string; phone: string | null } | null;
  compressor_models:
    | { id: string; name: string; brands: { id: string; name: string } | null }
    | null;
  data_complete?: boolean | null;
  machine_parts: MachinePart[];
};

function SnView({
  q,
  setQ,
  seller,
  setSeller,
  statusFilter,
  setStatusFilter,
  focusToken,
}: {
  q: string;
  setQ: (v: string) => void;
  seller: string | null;
  setSeller: (v: string | null) => void;
  statusFilter: string | null;
  setStatusFilter: (v: string | null) => void;
  focusToken: number;
}) {
  const [sellerQ, setSellerQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<MachineResult[]>([]);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());


  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("machine_units")
      .select(
        `id, serial_number, customer_sn, install_date, daily_hours, note,
         site_name, address_line, district, province, seller, status, data_complete,
         warranty_end, contract_service,
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
    if (error || !data) {
      const cached = loadOffline<MachineResult[]>("machine_units");
      if (cached?.length) {
        setUnits(cached);
        const at = offlineSavedAt("machine_units");
        toast.warning(
          "ออฟไลน์อยู่ — แสดงข้อมูลที่บันทึกไว้ในเครื่อง" +
            (at ? ` (ล่าสุด ${at.toLocaleString("th-TH-u-ca-buddhist")})` : ""),
        );
        return;
      }
      return toast.error("โหลดข้อมูลผิดพลาด: " + (error?.message ?? "ไม่ทราบสาเหตุ"));
    }
    const rows = data as unknown as MachineResult[];
    setUnits(rows);
    saveOffline("machine_units", rows);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const sn = sp.get("sn");
    if (sn) setQ(sn);
  }, []);


  const sellers = useMemo(
    () =>
      Array.from(
        new Set(units.map((u) => ((u as any).seller ?? "").trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, "th")),
    [units],
  );

  const visibleSellers = useMemo(() => {
    const kw = sellerQ.trim().toLowerCase();
    if (!kw) return sellers;
    return sellers.filter((s) => s.toLowerCase().includes(kw));
  }, [sellers, sellerQ]);

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of units) {
      const s = ((u as any).status ?? "").trim() || "ไม่ระบุสถานะ";
      map.set(s, (map.get(s) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [units]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const sellerKw = sellerQ.trim().toLowerCase();
    return units.filter((u) => {
      const unitSeller = ((u as any).seller ?? "").trim();
      const unitStatus = ((u as any).status ?? "").trim() || "ไม่ระบุสถานะ";
      if (seller && unitSeller !== seller) return false;
      if (statusFilter && unitStatus !== statusFilter) return false;
      if (sellerKw && !unitSeller.toLowerCase().includes(sellerKw)) return false;
      if (!kw) return true;
      const brand = u.compressor_models?.brands?.name ?? "";
      const model = u.compressor_models?.name ?? "";
      const cust = u.customers?.name ?? "";
      const phone = u.customers?.phone ?? "";
      const parts = (u.machine_parts ?? [])
        .map((mp) =>
          `${mp.products?.name ?? ""} ${mp.products?.part_number ?? ""} ${mp.products?.categories?.name ?? ""}`
        )
        .join(" ");
      const loc = `${(u as any).site_name ?? ""} ${(u as any).district ?? ""} ${(u as any).province ?? ""} ${unitSeller} ${unitStatus}`;
      return `${u.serial_number} ${u.customer_sn ?? ""} ${brand} ${model} ${cust} ${phone} ${parts} ${loc}`
        .toLowerCase()
        .includes(kw);
    }).sort((a, b) => a.serial_number.localeCompare(b.serial_number, "th"));
  }, [units, q, seller, sellerQ, statusFilter]);


  // ค่าเริ่มต้น: พับปิดทุกเครื่อง
  useEffect(() => {
    setOpenIds(new Set());
  }, [q, seller, statusFilter]);

  // กด "ตกลง" ในป๊อปอัป → กางแถวที่ตรงและเลื่อนหน้าจอไปหา
  useEffect(() => {
    if (!focusToken) return;
    const first = filtered[0];
    if (!first) return;
    setOpenIds(new Set([first.id]));
    setTimeout(() => {
      document.getElementById(`machine-${first.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  }, [focusToken, filtered.length]);


  return (
    <div className="space-y-5">
      <datalist id="sn-search-options">
        {units.map((u) => {
          const label = [
            u.serial_number,
            u.customer_sn ? `S/N ลูกค้า ${u.customer_sn}` : null,
            u.compressor_models?.brands?.name,
            u.compressor_models?.name,
            u.customers?.name,
          ].filter(Boolean).join(" • ");
          return <option key={u.id} value={u.serial_number}>{label}</option>;
        })}
      </datalist>


      {sellers.length > 0 && (
        <div className="space-y-2">
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
            <span className="text-xs text-muted-foreground">ผู้ขาย:</span>
            <FilterChip active={seller === null} onClick={() => setSeller(null)}>
              ทั้งหมด
            </FilterChip>
            {visibleSellers.map((s) => (
              <FilterChip key={s} active={seller === s} onClick={() => setSeller(s)}>
                {s}
              </FilterChip>
            ))}
          </div>
        </div>
      )}

      {units.length > 0 && (
        <CollapsibleSection
          title={`สถานะเครื่อง (ทั้งหมด ${units.length} เครื่อง)`}
          subtitle="กรองรายการตามสถานะเครื่อง"
        >
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip active={statusFilter === null} onClick={() => setStatusFilter(null)}>
              ทั้งหมด ({units.length})
            </FilterChip>
            {statusCounts.map(([s, n]) => (
              <FilterChip
                key={s}
                active={statusFilter === s}
                onClick={() => setStatusFilter(statusFilter === s ? null : s)}
              >
                {s} ({n})
              </FilterChip>
            ))}
          </div>
        </CollapsibleSection>
      )}


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
        <CollapsibleSection
          title={`ข้อมูลเครื่องจักรทั้งหมด (พบ ${filtered.length} เครื่อง)`}
          subtitle="แสดงชื่อลูกค้าและ S/N — กด 👁️ ดูเพิ่มเติม เพื่อกางอะไหล่"
        >
          <div className="space-y-2">
            {filtered.map((u) => (
              <MachineCard
                key={u.id}
                unit={u}
                open={openIds.has(u.id)}
                onDeleted={load}
                onToggle={() =>
                  setOpenIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(u.id)) next.delete(u.id);
                    else next.add(u.id);
                    return next;
                  })
                }
              />
            ))}
          </div>
        </CollapsibleSection>
      )}


    </div>
  );
}

/** เลือก "ชุดอะไหล่" สำเร็จรูป แล้วเพิ่มอะไหล่ทั้งชุดลงเครื่องในคลิกเดียว */
function BundleApply({ unitId, onApplied }: { unitId: string; onApplied: () => void }) {
  const { bundles } = useBundles();
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  if (bundles.length === 0) return null;

  const apply = async () => {
    const b = bundles.find((x) => x.id === pick);
    if (!b) return toast.error("เลือกชุดอะไหล่ก่อน");
    if (b.items.length === 0) return toast.error("ชุดนี้ยังไม่มีรายการอะไหล่");
    setBusy(true);
    const { data: exist } = await supabase
      .from("machine_parts")
      .select("product_id")
      .eq("machine_unit_id", unitId);
    const has = new Set((exist ?? []).map((r: any) => r.product_id));
    const rows = b.items
      .filter((it) => !has.has(it.product_id))
      .map((it) => ({ machine_unit_id: unitId, product_id: it.product_id, quantity: it.quantity }));
    if (rows.length === 0) {
      setBusy(false);
      return toast.info("อะไหล่ในชุดนี้อยู่ในเครื่องครบแล้ว");
    }
    const { error } = await supabase.from("machine_parts").insert(rows);
    setBusy(false);
    if (error) return toast.error("เพิ่มชุดอะไหล่ไม่สำเร็จ: " + error.message);
    toast.success(`เพิ่ม "${b.name}" (${rows.length} รายการ) ลงเครื่องแล้ว`);
    onApplied();
  };

  return (
    <div className="no-print mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-2">
      <span className="text-xs text-muted-foreground">📦 ใส่ชุดอะไหล่สำเร็จรูป:</span>
      <select
        className="h-9 min-w-[12rem] rounded-md border bg-background px-2 text-sm"
        value={pick}
        onChange={(e) => setPick(e.target.value)}
      >
        <option value="">— เลือกชุด —</option>
        {bundles.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} ({b.items.length} รายการ)
          </option>
        ))}
      </select>
      <Button size="sm" onClick={apply} disabled={busy || !pick}>
        {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}เพิ่มทั้งชุด
      </Button>
    </div>
  );
}

function MachineCard({
  unit,
  open,
  onToggle,
  onDeleted,
}: {
  unit: MachineResult;
  open: boolean;
  onToggle: () => void;
  onDeleted?: () => void;
}) {
  const { isAdmin } = useAccess();
  const grouped = groupByCategory(unit.machine_parts ?? []);
  const [logs, setLogs] = useState<any[]>([]);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (!open) return;
    supabase
      .from("maintenance_logs")
      .select("id, done_date, service_type, job_detail, result, note")
      .eq("machine_unit_id", unit.id)
      .order("done_date", { ascending: false })
      .then(({ data }) => setLogs(data ?? []));
  }, [open, unit.id]);
  const model = unit.compressor_models
    ? `${unit.compressor_models.brands?.name ?? ""} ${unit.compressor_models.name}`.trim()
    : "-";
  const complete = isMachineComplete(unit as any);

  async function deleteUnit() {
    setDeleting(true);
    await deleteAsAdmin("machine_parts", { machine_unit_id: unit.id });
    const { error } = await deleteAsAdmin("machine_units", { id: unit.id });
    setDeleting(false);
    if (error) return toast.error("ลบไม่สำเร็จ: " + error.message);
    toast.success(`ลบเครื่อง S/N ${unit.serial_number} แล้ว`);
    onDeleted?.();
  }

  return (
    <Card id={`machine-${unit.id}`} className="overflow-hidden">
      <div className="flex items-center gap-1 pr-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/40"
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold">{unit.customers?.name ?? "-"}</span>
          <Badge variant="outline" className="shrink-0 font-mono text-xs">
            {unit.serial_number}
          </Badge>
          {unit.customer_sn && (
            <Badge variant="secondary" className="shrink-0 font-mono text-xs">
              S/N ลูกค้า: {unit.customer_sn}
            </Badge>
          )}
          <span
            className={
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] " +
              (complete
                ? "bg-emerald-500/15 text-emerald-700"
                : "bg-orange-500/15 text-orange-700")
            }
          >
            {complete ? "✅ ข้อมูลครบถ้วน" : "⚠️ ข้อมูลยังไม่ครบ"}
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
          {open ? "👁️ ซ่อนข้อมูล" : "👁️ ดูเพิ่มเติม"}
          <ChevronDown className={"h-4 w-4 transition-transform " + (open ? "rotate-180" : "")} />
        </span>
      </button>
      {isAdmin && (
        <ConfirmButton
          variant="ghost"
          size="icon"
          className="shrink-0 text-destructive hover:bg-destructive/10"
          title={`ลบข้อมูลเครื่องจักรนี้ (S/N ${unit.serial_number})?`}
          description="ระบบจะลบหมายเลขเครื่องนี้และรายการอะไหล่ทั้งหมดออกจากฐานข้อมูลถาวร ย้อนกลับไม่ได้"
          confirmText="ยืนยันลบถาวร"
          onConfirm={deleteUnit}
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </ConfirmButton>
      )}
      </div>


      {open && (
        <CardContent id={`print-${unit.id}`} className="space-y-4 border-t pt-4">
          <div className="no-print flex flex-wrap gap-2">
            <PdfPreviewButton unitId={unit.id} serial={unit.serial_number} />
            <Button size="sm" variant="outline" onClick={() => shareMachine(unit)}>
              <Share2 className="mr-1 h-4 w-4" /> ส่งออก / แชร์
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="S/N" value={unit.serial_number} />
            <Info label="S/N ลูกค้า" value={unit.customer_sn || "-"} />
            <Info label="สถานะเครื่อง" value={(unit as any).status ?? "-"} />
            <Info label="รุ่นเครื่อง" value={model} />
            <Info label="ลูกค้า" value={unit.customers?.name ?? "-"} />
            <Info label="เบอร์โทร" value={unit.customers?.phone ?? "-"} />
            <Info
              label="ชม.ทำงาน/วัน"
              value={unit.daily_hours != null ? `${unit.daily_hours} ชม.` : "-"}
            />
            {unit.install_date && <Info label="วันที่ติดตั้ง" value={formatDate(unit.install_date)} />}
            {(unit as any).site_name && <Info label="สถานที่ติดตั้ง" value={(unit as any).site_name} />}
            {((unit as any).address_line || (unit as any).district || (unit as any).province) && (
              <Info
                label="ที่อยู่"
                value={[(unit as any).address_line, (unit as any).district, (unit as any).province].filter(Boolean).join(" • ")}
              />
            )}
            {(unit as any).seller && <Info label="ผู้ขาย" value={(unit as any).seller} />}
          </div>

          {logs.length > 0 && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-semibold">ประวัติซ่อมบำรุงย้อนหลัง ({logs.length})</p>
              {logs.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {formatDate(l.done_date)} · {l.service_type ?? "-"} · {l.job_detail ?? ""}
                    {l.note ? ` (${l.note})` : ""}
                  </span>
                  <Badge variant={l.result === "not_ok" ? "destructive" : "secondary"}>
                    {l.result === "not_ok" ? "ไม่เรียบร้อย" : "เรียบร้อย"}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Package className="h-4 w-4" /> รายการอะไหล่
            </div>
            <div className="no-print">
              <BundleApply unitId={unit.id} onApplied={() => onDeleted?.()} />
            </div>
            {grouped.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                ยังไม่มีรายการอะไหล่สำหรับเครื่องนี้
              </p>
            ) : (
              <div className="space-y-3">
                {grouped.map((g) => (
                  <CollapsibleSection
                    key={g.name}
                    title={g.name}
                    subtitle={`${g.items.length} รายการ`}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      {g.items.map((mp) => (
                        <PartRow key={mp.id} mp={mp} dailyHours={unit.daily_hours ?? null} />
                      ))}
                    </div>
                  </CollapsibleSection>
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
  const [lastChanged, setLastChanged] = useState<string | null>(mp.last_changed_at);
  const [savingDate, setSavingDate] = useState(false);

  async function saveDate(value: string | null) {
    setSavingDate(true);
    const prev = lastChanged;
    setLastChanged(value);
    const { error } = await supabase
      .from("machine_parts")
      .update({ last_changed_at: value })
      .eq("id", mp.id);
    setSavingDate(false);
    if (error) {
      setLastChanged(prev);
      return toast.error("บันทึกวันที่ไม่สำเร็จ: " + error.message);
    }
    toast.success("อัปเดตวันที่เปลี่ยนอะไหล่แล้ว");
  }

  const interval = mp.service_interval_hours ?? mp.products?.service_interval_hours ?? null;
  const nextChange = computeNextChange(lastChanged, interval, dailyHours);
  const usedHours =
    mp.hours_used != null && mp.hours_used > 0
      ? mp.hours_used
      : lastChanged && dailyHours && dailyHours > 0
        ? Math.round(
            Math.max(0, Math.floor((Date.now() - new Date(lastChanged).getTime()) / 86400000)) * dailyHours,
          )
        : null;
  const remaining = usedHours != null && interval ? interval - usedHours : null;
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
          {usedHours != null && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" /> ใช้แล้ว {usedHours.toLocaleString()} ชม.
            </Badge>
          )}
          {remaining != null && (
            <Badge variant={remaining <= 0 ? "destructive" : "outline"}>
              {remaining <= 0 ? "ถึงกำหนดเปลี่ยน" : `เหลือ ${remaining.toLocaleString()} ชม.`}
            </Badge>
          )}
          {mp.products?.storage_location && (
            <Badge variant="outline" className="gap-1">
              <MapPin className="h-3 w-3" /> {mp.products.storage_location}
            </Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-xs">
          <div className="no-print flex flex-1 min-w-[10rem] flex-wrap items-center gap-1 rounded bg-muted/50 px-2 py-1">
            <CalendarClock className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="shrink-0 text-muted-foreground">เปลี่ยนล่าสุด:</span>
            <DateInput
              value={lastChanged ?? ""}
              onChange={(v) => saveDate(v || null)}
              disabled={savingDate}
              size="sm"
              className="min-w-[8rem] flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 shrink-0 px-2 text-xs"
              disabled={savingDate}
              onClick={() => saveDate(new Date().toISOString().slice(0, 10))}
            >
              วันนี้
            </Button>
          </div>
          <div className="hidden flex-1 min-w-[10rem] flex-wrap items-center gap-1 rounded bg-muted/50 px-2 py-1 print:flex">
            <span className="shrink-0 text-muted-foreground">เปลี่ยนล่าสุด:</span>
            <span className="flex-1 font-medium">{formatDate(lastChanged)}</span>
          </div>
          <div className="flex flex-1 min-w-[10rem] flex-wrap items-center gap-1 rounded bg-primary/10 px-2 py-1">
            <CalendarClock className="h-3 w-3 shrink-0 text-primary" />
            <span className="shrink-0 text-muted-foreground">ครั้งถัดไป:</span>
            <span className="flex-1 font-medium text-primary">{formatDate(nextChange)}</span>
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

function PdfPreviewButton({ unitId, serial }: { unitId: string; serial: string }) {
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState(0); // 0 = อัตโนมัติ (ไม่ย่อ แบ่งหน้าตามความยาวจริง)
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [size, setSize] = useState<string>("");

  async function build(p = pages, o = orientation) {
    const el = document.getElementById(`print-${unitId}`);
    if (!el) return;
    setBusy(true);
    // โหมดส่งออก A4: บังคับความกว้างตามแนวกระดาษ + ตัวหนังสือใหญ่ขึ้น แล้วคืนค่าเดิมเมื่อจบ
    el.classList.add("export-a4");
    if (o === "landscape") el.style.width = "1123px";
    try {
      // รอให้เบราว์เซอร์จัดเลย์เอาต์/โหลดรูปตามขนาดใหม่ก่อนจับภาพ
      await new Promise((r) => setTimeout(r, 120));
      const { elementToPdfBlobPaged, formatBytes } = await import("@/lib/report");
      const b = await elementToPdfBlobPaged(el, p, { orientation: o });
      setBlob(b);
      setSize(formatBytes(b.size));
      setUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(b);
      });
    } catch (err) {
      console.error(err);
      toast.error("สร้าง PDF ไม่สำเร็จ");
    } finally {
      el.classList.remove("export-a4");
      el.style.width = "";
      setBusy(false);
    }
  }

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true);
          setTimeout(() => build(), 150);
        }}
      >
        <Printer className="mr-1 h-4 w-4" /> พรีวิว / พิมพ์ PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>พรีวิว PDF — {serial}</DialogTitle>
            <DialogDescription>
              กำหนดจำนวนหน้ากระดาษที่ต้องการ ระบบจะย่อเนื้อหาให้พอดีตามจำนวนหน้า
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">จำนวนหน้ากระดาษ (0 = อัตโนมัติ)</label>
              <Input
                type="number"
                min={0}
                max={20}
                value={pages}
                onChange={(e) => setPages(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
                className="h-9 w-24"
              />
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={pages === 0 ? "default" : "outline"}
                onClick={() => { setPages(0); build(0, orientation); }}
              >
                อัตโนมัติ
              </Button>
              {[1, 2, 3, 4].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={pages === n ? "default" : "outline"}
                  onClick={() => { setPages(n); build(n, orientation); }}
                >
                  {n} หน้า
                </Button>
              ))}
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={orientation === "portrait" ? "default" : "outline"}
                onClick={() => { setOrientation("portrait"); build(pages, "portrait"); }}
              >
                แนวตั้ง
              </Button>
              <Button
                size="sm"
                variant={orientation === "landscape" ? "default" : "outline"}
                onClick={() => { setOrientation("landscape"); build(pages, "landscape"); }}
              >
                แนวนอน
              </Button>
            </div>
            <Button size="sm" onClick={() => build()} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              อัปเดตพรีวิว
            </Button>
          </div>

          <div className="h-[55vh] overflow-hidden rounded border bg-muted">
            {busy ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : url ? (
              <iframe src={url} title="pdf-preview" className="h-full w-full" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                ยังไม่มีพรีวิว
              </div>
            )}
          </div>

          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {size ? `ขนาดไฟล์: ${size} • ${pages} หน้า` : ""}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!blob}
                onClick={async () => {
                  if (!blob) return;
                  const { downloadBlob } = await import("@/lib/report");
                  downloadBlob(blob, `machine-${serial}.pdf`);
                }}
              >
                <Download className="mr-1 h-4 w-4" /> ดาวน์โหลด
              </Button>
              <Button
                disabled={!blob}
                onClick={async () => {
                  if (!blob) return;
                  const { shareOrDownload } = await import("@/lib/report");
                  await shareOrDownload(blob, `machine-${serial}.pdf`, `ข้อมูลเครื่อง ${serial}`);
                }}
              >
                <Share2 className="mr-1 h-4 w-4" /> แชร์
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


async function shareMachine(unit: MachineResult) {
  const model = unit.compressor_models
    ? `${unit.compressor_models.brands?.name ?? ""} ${unit.compressor_models.name}`.trim()
    : "-";
  const lines: string[] = [
    `S/N: ${unit.serial_number}`,
    `S/N ลูกค้า: ${unit.customer_sn || "-"}`,
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



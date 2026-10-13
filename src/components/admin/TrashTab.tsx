import { useEffect, useMemo, useState } from "react";
import { storedAdminCode } from "@/lib/access";
import { listDeletedItems, purgeDeletedItem, restoreDeletedItem } from "@/lib/admin-write.functions";
import { refreshDirectory } from "@/lib/directory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/ConfirmButton";
import { toast } from "sonner";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";

const TABLE_LABELS: Record<string, string> = {
  customers: "ลูกค้า",
  machine_units: "เครื่อง (S/N)",
  products: "อะไหล่",
  brands: "ยี่ห้อ",
  compressor_models: "รุ่นเครื่อง",
  categories: "หมวดหมู่",
  service_staff: "ช่าง",
  vehicles: "ทะเบียนรถ",
  sales_contacts: "ผู้ขาย/เซลล์",
  work_orders: "ใบงาน",
  appointments: "นัดหมาย",
  machine_parts: "อะไหล่ในเครื่อง",
  maintenance_logs: "ประวัติซ่อม",
  part_bundles: "ชุดอะไหล่",
  part_bundle_items: "รายการในชุดอะไหล่",
  checklist_templates: "เทมเพลต Checklist",
  troubleshooting_issues: "อาการเสีย",
  notifications: "การแจ้งเตือน",
  app_settings: "ตั้งค่า",
};

type Item = { id: string; table_name: string; label: string | null; deleted_at: string };

export function TrashTab() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await listDeletedItems({ data: { code: storedAdminCode() } });
    if (!res.ok) toast.error(res.error);
    setItems((res.items ?? []) as Item[]);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((i) =>
      `${i.label ?? ""} ${TABLE_LABELS[i.table_name] ?? i.table_name}`.toLowerCase().includes(t),
    );
  }, [items, q]);

  const restore = async (id: string) => {
    setBusy(id);
    const res = await restoreDeletedItem({ data: { code: storedAdminCode(), id } });
    setBusy(null);
    if (!res.ok) return toast.error(`กู้คืนไม่สำเร็จ: ${res.error}`);
    toast.success("กู้คืนแล้ว");
    setItems((l) => l.filter((i) => i.id !== id));
    if (res.table === "sales_contacts") window.dispatchEvent(new Event("sales-contacts-changed"));
    refreshDirectory();
  };

  const purge = async (id: string) => {
    const res = await purgeDeletedItem({ data: { code: storedAdminCode(), id } });
    if (!res.ok) return toast.error(res.error);
    setItems((l) => l.filter((i) => i.id !== id));
    toast.success("ลบถาวรแล้ว");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trash2 className="h-4 w-4" /> ถังขยะ / รายการที่ถูกลบ ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input placeholder="ค้นหาชื่อหรือประเภท" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button variant="outline" onClick={load}>รีเฟรช</Button>
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">ไม่มีรายการที่ถูกลบ</p>
        ) : (
          <div className="space-y-2">
            {shown.map((i) => (
              <div key={i.id} className="flex flex-col gap-2 rounded-md border p-2 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="break-words font-medium">{i.label || "(ไม่มีชื่อ)"}</div>
                  <div className="text-xs text-muted-foreground">
                    {TABLE_LABELS[i.table_name] ?? i.table_name} · ลบเมื่อ{" "}
                    {new Date(i.deleted_at).toLocaleString("th-TH")}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => restore(i.id)} disabled={busy === i.id}>
                    <RotateCcw className="mr-1 h-4 w-4" /> กู้คืน
                  </Button>
                  <ConfirmButton
                    onConfirm={() => purge(i.id)}
                    title="ลบถาวร?"
                    description="รายการนี้จะกู้คืนไม่ได้อีก"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </ConfirmButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

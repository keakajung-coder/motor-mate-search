import { useEffect, useMemo, useState } from "react";
import { storedAdminCode } from "@/lib/access";
import {
  listDeletedItems,
  purgeDeletedItem,
  restoreDeletedItem,
} from "@/lib/admin-write.functions";
import { refreshDirectory } from "@/lib/directory";
import { supabase } from "@/lib/data-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ConfirmButton";
import { toast } from "sonner";
import { Loader2, RotateCcw, Trash2, UserCog, History } from "lucide-react";

const TABLE_LABELS: Record<string, string> = {
  customers: "ลูกค้า",
  machine_units: "เครื่อง (S/N)",
  products: "อะไหล่",
  brands: "ยี่ห้อ",
  compressor_models: "รุ่นเครื่อง",
  categories: "หมวดหมู่",
  service_staff: "พนักงาน/ช่าง",
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

export type TrashItem = {
  id: string;
  table_name: string;
  label: string | null;
  deleted_at: string;
  isSoftDelete?: boolean;
  extra?: string | null;
};

export function TrashTab() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState<"all" | "staff" | "other">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [res, staffRes] = await Promise.all([
        listDeletedItems({ data: { code: storedAdminCode() } }),
        supabase
          .from("service_staff")
          .select("id, name, phone, line_contact, updated_at")
          .eq("active", false)
          .order("updated_at", { ascending: false }),
      ]);

      if (!res.ok) toast.error(res.error);

      const snapshotItems: TrashItem[] = ((res.items ?? []) as TrashItem[]).map((i) => ({
        ...i,
        isSoftDelete: false,
      }));

      const softDeletedStaff: TrashItem[] = (staffRes.data ?? []).map((s: any) => ({
        id: s.id,
        table_name: "service_staff",
        label: s.name,
        deleted_at: s.updated_at || new Date().toISOString(),
        isSoftDelete: true,
        extra: [s.phone && `โทร: ${s.phone}`, s.line_contact && `LINE: ${s.line_contact}`]
          .filter(Boolean)
          .join(" · "),
      }));

      // รวมรายการถังขยะ: นำพนักงาน soft-deleted มารวมไว้ด้วยกัน
      const combined = [...softDeletedStaff, ...snapshotItems].sort(
        (a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime(),
      );

      setItems(combined);
    } catch (e) {
      console.error(e);
      toast.error("โหลดรายการถังขยะไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const onStaffChanged = () => load();
    window.addEventListener("service-staff-changed", onStaffChanged);
    return () => window.removeEventListener("service-staff-changed", onStaffChanged);
  }, []);

  const shown = useMemo(() => {
    let list = items;
    if (filterType === "staff")
      list = list.filter((i) => i.isSoftDelete || i.table_name === "service_staff");
    else if (filterType === "other")
      list = list.filter((i) => !i.isSoftDelete && i.table_name !== "service_staff");

    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((i) =>
      `${i.label ?? ""} ${i.extra ?? ""} ${TABLE_LABELS[i.table_name] ?? i.table_name}`
        .toLowerCase()
        .includes(t),
    );
  }, [items, q, filterType]);

  const staffCount = useMemo(
    () => items.filter((i) => i.isSoftDelete || i.table_name === "service_staff").length,
    [items],
  );
  const otherCount = useMemo(
    () => items.filter((i) => !i.isSoftDelete && i.table_name !== "service_staff").length,
    [items],
  );

  const restore = async (item: TrashItem) => {
    setBusy(item.id);
    if (item.isSoftDelete) {
      // กู้คืน Soft Delete พนักงาน: ตั้ง active = true
      const { error } = await supabase
        .from("service_staff")
        .update({ active: true })
        .eq("id", item.id);
      setBusy(null);
      if (error) return toast.error(`กู้คืนไม่สำเร็จ: ${error.message}`);

      const { logAudit } = await import("@/lib/audit");
      await logAudit({
        table: "service_staff",
        recordId: item.id,
        action: "restore",
        summary: `กู้คืนพนักงาน (Restore active=true): ${item.label}`,
        changes: { id: item.id, active: true },
      });

      toast.success(`กู้คืนพนักงาน "${item.label}" เรียบร้อยแล้ว`);
      setItems((l) => l.filter((i) => i.id !== item.id));
      window.dispatchEvent(new Event("service-staff-changed"));
      await refreshDirectory();
      return;
    }

    // กู้คืน Snapshot จาก deleted_items
    const res = await restoreDeletedItem({ data: { code: storedAdminCode(), id: item.id } });
    setBusy(null);
    if (!res.ok) return toast.error(`กู้คืนไม่สำเร็จ: ${res.error}`);
    toast.success("กู้คืนแล้ว");
    setItems((l) => l.filter((i) => i.id !== item.id));
    if (res.table === "sales_contacts") window.dispatchEvent(new Event("sales-contacts-changed"));
    if (res.table === "service_staff") window.dispatchEvent(new Event("service-staff-changed"));
    refreshDirectory();
  };

  const purge = async (item: TrashItem) => {
    setBusy(item.id);
    if (item.isSoftDelete) {
      // ลบถาวรพนักงานที่ปิดใช้งานออกจากตารางจริง
      const { deleteAsAdmin } = await import("@/lib/access");
      const { error } = await deleteAsAdmin("service_staff", { id: item.id });
      setBusy(null);
      if (error) return toast.error(error.message);
      setItems((l) => l.filter((i) => i.id !== item.id));
      window.dispatchEvent(new Event("service-staff-changed"));
      refreshDirectory();
      toast.success(`ลบพนักงาน "${item.label}" ถาวรแล้ว`);
      return;
    }

    const res = await purgeDeletedItem({ data: { code: storedAdminCode(), id: item.id } });
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    setItems((l) => l.filter((i) => i.id !== item.id));
    toast.success("ลบถาวรแล้ว");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trash2 className="h-4 w-4" /> ถังขยะและกู้คืนข้อมูล ({items.length})
          </CardTitle>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Button
              size="sm"
              variant={filterType === "all" ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setFilterType("all")}
            >
              ทั้งหมด ({items.length})
            </Button>
            <Button
              size="sm"
              variant={filterType === "staff" ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setFilterType("staff")}
            >
              <UserCog className="mr-1 h-3.5 w-3.5" />
              พนักงาน/ช่าง ({staffCount})
            </Button>
            <Button
              size="sm"
              variant={filterType === "other" ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setFilterType("other")}
            >
              <History className="mr-1 h-3.5 w-3.5" />
              รายการอื่นๆ ({otherCount})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="ค้นหาชื่อ, เบอร์โทร, หรือประเภทข้อมูล..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} รีเฟรช
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังโหลดรายการถังขยะ...
          </div>
        ) : shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีรายการในถังขยะ</p>
        ) : (
          <div className="space-y-2">
            {shown.map((i) => (
              <div
                key={`${i.table_name}-${i.id}`}
                className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words font-medium text-foreground">
                      {i.label || "(ไม่มีชื่อ)"}
                    </span>
                    {i.isSoftDelete ? (
                      <Badge
                        variant="secondary"
                        className="border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                      >
                        พนักงาน/ช่าง (Soft Delete)
                      </Badge>
                    ) : (
                      <Badge variant="outline">{TABLE_LABELS[i.table_name] ?? i.table_name}</Badge>
                    )}
                  </div>
                  {i.extra && <div className="text-xs text-muted-foreground">{i.extra}</div>}
                  <div className="text-xs text-muted-foreground">
                    ลบเมื่อ {new Date(i.deleted_at).toLocaleString("th-TH")}
                    {i.isSoftDelete && " · คงประวัติงานย้อนหลังไว้"}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 sm:pt-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                    onClick={() => restore(i)}
                    disabled={busy === i.id}
                  >
                    {busy === i.id ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-1 h-4 w-4" />
                    )}
                    กู้คืน
                  </Button>
                  <ConfirmButton
                    onConfirm={() => purge(i)}
                    title={i.isSoftDelete ? "ลบพนักงานนี้ถาวร?" : "ลบถาวร?"}
                    description={
                      i.isSoftDelete
                        ? `ลบพนักงาน ${i.label} ออกจากฐานข้อมูลถาวร รายการนี้จะไม่สามารถกู้คืนได้อีก`
                        : "รายการนี้จะถูกลบถาวรและกู้คืนไม่ได้อีก"
                    }
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

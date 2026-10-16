import { useEffect, useMemo, useState } from "react";
import { useAccess } from "@/lib/access";
import { refreshDirectory } from "@/lib/directory";
import {
  loadEngineers,
  addEngineer,
  updateEngineer,
  removeEngineer,
  restoreEngineer,
  type Engineer,
} from "@/lib/engineers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ConfirmButton";
import { toast } from "sonner";
import {
  HardHat,
  Loader2,
  Plus,
  Trash2,
  RotateCcw,
  Search,
  Phone,
  MessageCircle,
  AlertTriangle,
} from "lucide-react";
import { lineHref, telHref, visibleLineId } from "@/lib/contact";

export function EngineersTab() {
  return (
    <div className="space-y-4">
      <EngineersCard />
    </div>
  );
}

export function EngineersCard() {
  const { isAdmin } = useAccess();
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  // ฟอร์มเพิ่มวิศวกรใหม่
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [lineId, setLineId] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const list = await loadEngineers(true);
      setEngineers(list);
      await refreshDirectory().catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const onChanged = () => load();
    window.addEventListener("engineers-changed", onChanged);
    return () => window.removeEventListener("engineers-changed", onChanged);
  }, []);

  const activeList = useMemo(() => engineers.filter((e) => e.active), [engineers]);
  const inactiveList = useMemo(() => engineers.filter((e) => !e.active), [engineers]);

  const filtered = useMemo(() => {
    const list = showInactive ? inactiveList : activeList;
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(term) ||
        (e.phone && e.phone.toLowerCase().includes(term)) ||
        (e.line_contact && e.line_contact.toLowerCase().includes(term)),
    );
  }, [activeList, inactiveList, showInactive, q]);

  const isDuplicate = useMemo(() => {
    const n = name.trim().toLowerCase();
    if (!n) return false;
    return activeList.some((e) => e.name.toLowerCase() === n);
  }, [name, activeList]);

  const handleAdd = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("กรุณาระบุชื่อวิศวกร");
      return;
    }
    if (isDuplicate) {
      toast.error("มีชื่อวิศวกรนี้อยู่ในระบบแล้ว");
      return;
    }

    setSubmitting(true);
    try {
      const res = await addEngineer({
        name: trimmedName,
        phone: phone.trim() || null,
        line_contact: lineId.trim() || null,
      });

      if (!res.success) {
        toast.error(res.error || "เพิ่มวิศวกรไม่สำเร็จ");
        return;
      }

      setName("");
      setPhone("");
      setLineId("");
      toast.success(`เพิ่มวิศวกร "${trimmedName}" เรียบร้อยแล้ว`);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (
    id: string,
    patch: Partial<Pick<Engineer, "name" | "phone" | "line_contact">>,
  ) => {
    const res = await updateEngineer(id, patch);
    if (!res.success) {
      toast.error(res.error || "แก้ไขข้อมูลไม่สำเร็จ");
    } else {
      toast.success("บันทึกการแก้ไขแล้ว");
      await load();
    }
  };

  const handleRemove = async (id: string, engName: string) => {
    const res = await removeEngineer(id, false);
    if (!res.success) {
      toast.error(res.error || "ลบข้อมูลไม่สำเร็จ");
    } else {
      toast.success(`ลบวิศวกร "${engName}" แล้ว (กู้คืนได้)`);
      await load();
    }
  };

  const handleRestore = async (id: string, engName: string) => {
    const res = await restoreEngineer(id);
    if (!res.success) {
      toast.error(res.error || "กู้คืนข้อมูลไม่สำเร็จ");
    } else {
      toast.success(`กู้คืนวิศวกร "${engName}" แล้ว`);
      await load();
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2 font-semibold">
            <HardHat className="h-5 w-5 text-primary" />
            วิศวกรผู้ควบคุมงาน ({activeList.length})
          </span>
          {inactiveList.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowInactive(!showInactive)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showInactive ? (
                <>แสดงรายการที่ใช้งาน ({activeList.length})</>
              ) : (
                <>มีวิศวกรถูกลบ {inactiveList.length} คน (ดู/กู้คืน)</>
              )}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ฟอร์มเพิ่มวิศวกรใหม่ */}
        {!showInactive && (
          <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
            <p className="text-xs font-semibold text-muted-foreground">
              เพิ่มวิศวกรผู้ควบคุมงานคนใหม่ (ใช้สำหรับเลือกในใบส่งมอบงาน และเอกสารโครงการ)
            </p>
            <div className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
              <div>
                <Input
                  placeholder="ชื่อ-นามสกุล วิศวกร (เช่น วศ.ธีรเดช สุขสวัสดิ์)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
                {isDuplicate && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" /> มีชื่อวิศวกรนี้อยู่ในระบบแล้ว
                  </p>
                )}
              </div>
              <Input
                placeholder="เบอร์โทรศัพท์ (เช่น 081-234-5678)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Input
                placeholder="LINE ID (เช่น @engineer หรือ id)"
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Button onClick={handleAdd} disabled={submitting || !name.trim() || isDuplicate}>
                {submitting ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-4 w-4" />
                )}
                เพิ่มวิศวกร
              </Button>
            </div>
          </div>
        )}

        {/* แถบค้นหา */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 text-xs"
            placeholder="ค้นหาชื่อวิศวกร, เบอร์โทร หรือ LINE ID..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {/* รายการวิศวกร */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
            {showInactive
              ? "ไม่มีวิศวกรที่อยู่ในสถานะถูกลบ"
              : q
                ? "ไม่พบรายชื่อวิศวกรที่ค้นหา"
                : "ยังไม่มีรายชื่อวิศวกรผู้ควบคุมงาน เพิ่มชื่อวิศวกรในช่องด้านบนได้เลย"}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((eng) => (
              <div
                key={eng.id}
                className={`grid min-w-0 grid-cols-1 items-center gap-2 rounded-xl border p-2.5 transition-colors sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] ${
                  !eng.active ? "bg-muted/40 opacity-70" : "bg-card hover:bg-muted/10"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <HardHat className="h-4 w-4" />
                  </div>
                  <Input
                    defaultValue={eng.name}
                    disabled={!eng.active}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== eng.name) {
                        handleUpdate(eng.id, { name: v });
                      }
                    }}
                    placeholder="ชื่อวิศวกร"
                    className="h-8 font-medium text-xs sm:text-sm"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <Input
                    defaultValue={eng.phone ?? ""}
                    disabled={!eng.active}
                    placeholder="เบอร์โทร"
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== eng.phone) {
                        handleUpdate(eng.id, { phone: v });
                      }
                    }}
                    className="h-8 text-xs"
                  />
                  {eng.phone && telHref(eng.phone) && (
                    <a
                      href={telHref(eng.phone)!}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-primary hover:bg-primary/10"
                      title="โทรออก"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Input
                    defaultValue={eng.line_contact ?? ""}
                    disabled={!eng.active}
                    placeholder="LINE ID"
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== eng.line_contact) {
                        handleUpdate(eng.id, { line_contact: v });
                      }
                    }}
                    className="h-8 text-xs"
                  />
                  {eng.line_contact && lineHref(eng.line_contact) && (
                    <a
                      href={lineHref(eng.line_contact)!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                      title="เปิด LINE"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1">
                  {eng.active ? (
                    isAdmin && (
                      <ConfirmButton
                        onConfirm={() => handleRemove(eng.id, eng.name)}
                        title="ลบวิศวกรผู้ควบคุมงานนี้?"
                        description={`คุณแน่ใจหรือไม่ว่าต้องการลบ "${eng.name}" ออกจากระบบ? (สามารถกู้คืนได้)`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </ConfirmButton>
                    )
                  ) : (
                    isAdmin && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(eng.id, eng.name)}
                        className="h-8 text-xs text-primary"
                      >
                        <RotateCcw className="mr-1 h-3.5 w-3.5" /> กู้คืน
                      </Button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/data-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X, AlertTriangle, Settings, Loader2 } from "lucide-react";
import {
  loadPumpTypes,
  addPumpType,
  renamePumpType,
  deletePumpType,
  getPumpTypeUsage,
  type PumpTypeUsage,
} from "@/lib/pump-types";

// ==========================================
// 1. Popup ยืนยันการลบประเภทปั๊มลม (Delete Handling)
// ==========================================
export function DeletePumpTypeDialog({
  targetName,
  availableTypes,
  onClose,
  onSuccess,
}: {
  targetName: string | null;
  availableTypes: string[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [usage, setUsage] = useState<PumpTypeUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [action, setAction] = useState<"clear" | "migrate">("clear");
  const [migrateTo, setMigrateTo] = useState<string>("");
  const [deleting, setDeleting] = useState(false);

  const otherTypes = useMemo(
    () => availableTypes.filter((t) => t.toLowerCase() !== (targetName ?? "").toLowerCase()),
    [availableTypes, targetName]
  );

  useEffect(() => {
    if (!targetName) {
      setUsage(null);
      return;
    }
    let isMounted = true;
    setLoadingUsage(true);
    setAction("clear");
    setMigrateTo(otherTypes[0] ?? "");

    getPumpTypeUsage(targetName)
      .then((data) => {
        if (isMounted) setUsage(data);
      })
      .catch((err) => {
        console.error("Failed to get usage:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingUsage(false);
      });

    return () => {
      isMounted = false;
    };
  }, [targetName, otherTypes]);

  const hasUsage = (usage?.modelCount ?? 0) > 0 || (usage?.templateCount ?? 0) > 0;

  async function handleConfirmDelete() {
    if (!targetName) return;
    if (action === "migrate" && !migrateTo) {
      toast.error("กรุณาเลือกประเภทปลายทางที่ต้องการย้ายข้อมูลไป");
      return;
    }

    setDeleting(true);
    try {
      const dest = action === "migrate" ? migrateTo : null;
      const res = await deletePumpType(targetName, dest);
      if (dest) {
        toast.success(
          `ลบ "${targetName}" และย้าย ${res.affectedModels} รุ่นเครื่องไปยัง "${dest}" สำเร็จ`
        );
      } else {
        toast.success(
          `ลบ "${targetName}" สำเร็จ (ปรับ ${res.affectedModels} รุ่นเครื่องเป็นค่าว่าง)`
        );
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการลบ");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={!!targetName} onOpenChange={(open) => !open && !deleting && onClose()}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> ยืนยันการลบประเภทปั๊มลม
          </DialogTitle>
          <DialogDescription>
            คุณกำลังจะลบประเภทปั๊มลม <span className="font-semibold text-foreground">"{targetName}"</span> ออกจากระบบ
          </DialogDescription>
        </DialogHeader>

        {loadingUsage ? (
          <div className="flex flex-col items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mb-2 h-6 w-6 animate-spin text-primary" />
            กำลังตรวจสอบข้อมูลการใช้งานในระบบ...
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {hasUsage ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                <p className="font-semibold mb-1">⚠️ พบข้อมูลที่ผูกอยู่กับประเภทนี้:</p>
                <ul className="list-disc pl-5 space-y-0.5 text-xs sm:text-sm">
                  <li>
                    รุ่นเครื่องจักร: <span className="font-medium">{usage?.modelCount} รุ่น</span>
                    {usage?.unitCount ? ` (มีเครื่องจักรในระบบ ${usage.unitCount} เครื่อง)` : ""}
                  </li>
                  {usage?.modelNames && usage.modelNames.length > 0 && (
                    <li className="list-none text-xs text-muted-foreground pl-1">
                      ตัวอย่าง: {usage.modelNames.join(", ")}
                    </li>
                  )}
                  <li>
                    เทมเพลต Checklist: <span className="font-medium">{usage?.templateCount} เทมเพลต</span>
                  </li>
                </ul>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                ประเภทปั๊มนี้ยังไม่มีรุ่นเครื่องหรือเทมเพลตใดใช้งาน สามารถลบออกจากระบบได้อย่างปลอดภัย
              </div>
            )}

            {hasUsage && (
              <div className="space-y-3 pt-1">
                <Label className="text-sm font-semibold">การจัดการข้อมูลเครื่องจักรที่เคยผูกไว้:</Label>
                <RadioGroup value={action} onValueChange={(v) => setAction(v as "clear" | "migrate")} className="space-y-2">
                  <div className="flex items-start space-x-2 rounded-md border p-2.5 transition-colors hover:bg-muted/30">
                    <RadioGroupItem value="clear" id="radio-clear" className="mt-0.5" />
                    <Label htmlFor="radio-clear" className="cursor-pointer space-y-0.5">
                      <div className="text-sm font-medium">ปรับประเภทเป็นค่าว่าง (ล้างค่า)</div>
                      <div className="text-xs text-muted-foreground">
                        รุ่นเครื่องและเครื่องจักรจะยังอยู่ครบ แต่ช่องประเภทปั๊มลมจะเปลี่ยนเป็นค่าว่าง
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-start space-x-2 rounded-md border p-2.5 transition-colors hover:bg-muted/30">
                    <RadioGroupItem value="migrate" id="radio-migrate" className="mt-0.5" disabled={otherTypes.length === 0} />
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="radio-migrate" className="cursor-pointer space-y-0.5 block">
                        <div className="text-sm font-medium">ย้ายข้อมูลทั้งหมดไปยังประเภทอื่น</div>
                        <div className="text-xs text-muted-foreground">
                          เปลี่ยนรุ่นเครื่องและเทมเพลตที่เคยผูกไว้ให้เป็นประเภทที่เลือกใหม่ทันที
                        </div>
                      </Label>
                      {action === "migrate" && otherTypes.length > 0 && (
                        <Select value={migrateTo} onValueChange={setMigrateTo}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="เลือกประเภทปลายทางที่จะย้ายไป" />
                          </SelectTrigger>
                          <SelectContent>
                            {otherTypes.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </RadioGroup>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            ยกเลิก
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmDelete}
            disabled={deleting || loadingUsage}
          >
            {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {action === "migrate" ? "ย้ายข้อมูลและลบ" : "ยืนยันการลบ"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 2. ส่วนเนื้อหาจัดการประเภทปั๊มลม (Content List)
// ==========================================
export function PumpTypeManagerContent({
  onChanged,
}: {
  onChanged?: () => void;
}) {
  const [types, setTypes] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [usages, setUsages] = useState<Record<string, { models: number; units: number; templates: number }>>({});

  async function reload() {
    const list = await loadPumpTypes();
    setTypes(list);

    // โหลดจำนวนการใช้งานแบบสรุป
    const [modelsRes, unitsRes, tplsRes] = await Promise.all([
      supabase.from("compressor_models").select("id, pump_type"),
      supabase.from("machine_units").select("id, model_id"),
      supabase.from("checklist_templates" as never).select("id, pump_type, machine_types" as never),
    ]);

    const mList = (modelsRes.data ?? []) as { id: string; pump_type: string | null }[];
    const uList = (unitsRes.data ?? []) as { id: string; model_id: string | null }[];
    const tList = (tplsRes.data ?? []) as { id: string; pump_type: string | null; machine_types: string | null }[];

    const map: Record<string, { models: number; units: number; templates: number }> = {};
    for (const t of list) {
      const lower = t.toLowerCase();
      const matchModels = mList.filter((m) => (m.pump_type ?? "").trim().toLowerCase() === lower);
      const matchModelIds = new Set(matchModels.map((m) => m.id));
      const matchUnits = uList.filter((u) => u.model_id && matchModelIds.has(u.model_id));
      const matchTpls = tList.filter((tpl) => {
        if ((tpl.pump_type ?? "").trim().toLowerCase() === lower) return true;
        const parts = (tpl.machine_types ?? "").split(",").map((s: string) => s.trim().toLowerCase());
        return parts.includes(lower);
      });
      map[t] = {
        models: matchModels.length,
        units: matchUnits.length,
        templates: matchTpls.length,
      };
    }
    setUsages(map);
  }

  useEffect(() => {
    reload();
    const handleEvent = () => reload();
    window.addEventListener("pump-types-changed", handleEvent);
    window.addEventListener("option-list-changed", handleEvent);
    return () => {
      window.removeEventListener("pump-types-changed", handleEvent);
      window.removeEventListener("option-list-changed", handleEvent);
    };
  }, []);

  async function handleAdd() {
    const n = newName.trim();
    if (!n) return;
    if (types.some((t) => t.toLowerCase() === n.toLowerCase())) {
      toast.error("มีประเภทปั๊มนี้ในระบบแล้ว");
      return;
    }
    setBusy(true);
    try {
      await addPumpType(n);
      setNewName("");
      toast.success(`เพิ่มประเภท "${n}" แล้ว`);
      await reload();
      onChanged?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "ไม่สามารถเพิ่มได้");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(oldName: string) {
    const n = editValue.trim();
    if (!n || n === oldName) {
      setEditing(null);
      return;
    }
    if (types.some((t) => t.toLowerCase() === n.toLowerCase() && t !== oldName)) {
      toast.error("มีชื่อประเภทนี้อยู่แล้ว กรุณาใช้ชื่ออื่น");
      return;
    }

    setBusy(true);
    try {
      const res = await renamePumpType(oldName, n);
      setEditing(null);
      toast.success(
        `เปลี่ยนชื่อเป็น "${n}" แล้ว (อัปเดต ${res.updatedModels} รุ่นเครื่อง, ${res.updatedTemplates} เทมเพลตอัตโนมัติ)`
      );
      await reload();
      onChanged?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "ไม่สามารถแก้ไขชื่อได้");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="เพิ่มประเภทปั๊มลมใหม่ เช่น ปั๊มลมแรงดันสูง"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          disabled={busy}
        />
        <Button onClick={handleAdd} disabled={busy || !newName.trim()} className="shrink-0 gap-1">
          <Plus className="h-4 w-4" /> เพิ่ม
        </Button>
      </div>

      <div className="rounded-md border divide-y max-h-[380px] overflow-y-auto">
        {types.map((t) => {
          const u = usages[t] || { models: 0, units: 0, templates: 0 };
          const isEdit = editing === t;

          return (
            <div
              key={t}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/20"
            >
              {isEdit ? (
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(t);
                        if (e.key === "Escape") setEditing(null);
                      }}
                      autoFocus
                      className="h-8"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleRename(t)}
                      disabled={busy}
                      className="h-8 w-8 p-0"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(null)}
                      disabled={busy}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    ⚡ ระบบจะเปลี่ยนชื่อประเภทนี้ในรุ่นเครื่องและเครื่องจักรทั้งหมดให้อัตโนมัติทันที
                  </p>
                </div>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-sm">{t}</span>
                      {u.models > 0 ? (
                        <Badge variant="secondary" className="text-[11px] font-normal">
                          {u.models} รุ่น {u.units ? `(${u.units} เครื่อง)` : ""}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          ยังไม่ผูกรุ่น
                        </Badge>
                      )}
                      {u.templates > 0 && (
                        <Badge variant="outline" className="text-[11px] border-primary/30 text-primary">
                          {u.templates} เทมเพลต
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      title="แก้ไขชื่อ (Cascading Update)"
                      onClick={() => {
                        setEditing(t);
                        setEditValue(t);
                      }}
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                      title="ลบประเภทปั๊มลม"
                      onClick={() => setDeleteTarget(t)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {types.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            ยังไม่มีประเภทปั๊มลมในระบบ
          </div>
        )}
      </div>

      {/* Delete Handling Modal */}
      <DeletePumpTypeDialog
        targetName={deleteTarget}
        availableTypes={types}
        onClose={() => setDeleteTarget(null)}
        onSuccess={() => {
          reload();
          onChanged?.();
        }}
      />
    </div>
  );
}

// ==========================================
// 3. Modal Dialog สำหรับเปิดจากหน้าใดก็ได้
// ==========================================
export function PumpTypeManagerDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onChanged,
}: {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = controlledOnOpenChange ?? setInternalOpen;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" /> จัดการประเภทปั๊มลม
          </DialogTitle>
          <DialogDescription>
            แก้ไขชื่อ (เปลี่ยนทุกรุ่นเครื่องและเครื่องจักรอัตโนมัติ) และลบประเภทปั๊มลมในระบบ
          </DialogDescription>
        </DialogHeader>
        <PumpTypeManagerContent onChanged={onChanged} />
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 4. Card สำหรับใส่ในแท็บจัดการข้อมูล (Lists Tab)
// ==========================================
export function PumpTypeManagerCard({
  onChanged,
}: {
  onChanged?: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>ประเภทปั๊มลม</span>
        </CardTitle>
        <CardDescription>
          จัดการตัวเลือกประเภทปั๊มลม เมื่อแก้ไขชื่อระบบจะทำ Cascading Update เปลี่ยนชื่อในรุ่นเครื่องและเครื่องจักรทั้งหมดให้อัตโนมัติ
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PumpTypeManagerContent onChanged={onChanged} />
      </CardContent>
    </Card>
  );
}

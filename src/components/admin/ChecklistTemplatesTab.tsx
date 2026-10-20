import { useEffect, useState } from "react";
import { supabase } from "@/lib/data-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Settings } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useAccess, deleteAsAdmin } from "@/lib/access";
import { KIND_LABEL, loadTemplates, type ChecklistItem, type ChecklistKind, type ChecklistTemplate } from "@/lib/checklist";
import { MultiCombobox, splitNames, joinNames } from "@/components/ui/multi-combobox";
import { ensurePumpType, notifyPumpTypesChanged, usePumpTypes } from "@/lib/pump-types";
import { PumpTypeManagerDialog } from "@/components/admin/PumpTypeManager";

const uid = () => Math.random().toString(36).slice(2, 10);

export function ChecklistTemplatesTab() {
  const { isAdmin } = useAccess();
  const pumpTypes = usePumpTypes();
  const [list, setList] = useState<ChecklistTemplate[]>([]);
  const [sel, setSel] = useState<ChecklistTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPumpManager, setShowPumpManager] = useState(false);

  const reload = async (keepId?: string) => {
    let l: ChecklistTemplate[];
    try {
      l = await loadTemplates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "โหลดชุดเช็คลิสต์ไม่สำเร็จ");
      return;
    }
    setList(l);
    const pick = l.find((t) => t.id === (keepId ?? sel?.id)) ?? l[0] ?? null;
    setSel(pick ? structuredClone(pick) : null);
  };
  useEffect(() => {
    reload();
  }, []);

  const addTemplate = async () => {
    const { data, error } = await supabase
      .from("checklist_templates" as never)
      .insert({ name: "ชุดเช็คลิสต์ใหม่", machine_types: "", pump_type: null, items: [], sort_order: list.length } as never)
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    await reload((data as any).id);
  };

  const save = async () => {
    if (!sel) return;
    if (!sel.name.trim()) return toast.error("กรุณาใส่ชื่อชุด");
    setBusy(true);
    const items = sel.items
      .map((it) => ({ ...it, label: it.label.trim(), fields: it.kind === "status" ? [] : it.fields.map((f) => f.trim()) }))
      .filter((it) => it.label);

    const selectedTypes = splitNames(sel.machine_types || sel.pump_type);
    const pump_type = selectedTypes.length === 1 ? selectedTypes[0] : null;
    const machine_types = selectedTypes.length > 0 ? joinNames(selectedTypes) : null;

    const { error } = await supabase
      .from("checklist_templates" as never)
      .update({
        name: sel.name.trim(),
        pump_type,
        machine_types,
        items,
      } as never)
      .eq("id", sel.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("บันทึกเทมเพลตแล้ว");
    notifyPumpTypesChanged();
    reload(sel.id);
  };

  const remove = async () => {
    if (!sel) return;
    const { error } = await deleteAsAdmin("checklist_templates", { id: sel.id });
    if (error) return toast.error(error.message);
    toast.success("ลบแล้ว");
    setSel(null);
    reload("");
  };

  const setItem = (i: number, patch: Partial<ChecklistItem>) =>
    sel && setSel({ ...sel, items: sel.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });
  const move = (i: number, d: number) => {
    if (!sel) return;
    const items = [...sel.items];
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    setSel({ ...sel, items });
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">ชุดเช็คลิสต์</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-primary gap-1 px-1.5"
              onClick={() => setShowPumpManager(true)}
              title="จัดการประเภทปั๊มลม (แก้ไขชื่อ/ลบ)"
            >
              <Settings className="h-3.5 w-3.5" /> ประเภทปั๊ม
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {list.map((t) => {
            const types = splitNames(t.machine_types || t.pump_type);
            const isSel = sel?.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSel(structuredClone(t))}
                className={`w-full rounded-md border p-3 text-left text-sm transition-colors ${
                  isSel ? "border-primary bg-accent/70 shadow-xs" : "hover:bg-muted/40"
                }`}
              >
                <div className="font-semibold text-foreground break-words">{t.name}</div>
                <div className="flex flex-wrap gap-1 my-1.5">
                  {types.length > 0 ? (
                    types.map((ty) => (
                      <Badge key={ty} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {ty}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground font-normal">
                      ทุกประเภท (ทั่วไป)
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{t.items.length} หัวข้อการตรวจ</div>
              </button>
            );
          })}
          <Button variant="outline" className="w-full" onClick={addTemplate}>
            <Plus className="mr-1 h-4 w-4" /> เพิ่มชุด
          </Button>
        </CardContent>
      </Card>

      {sel ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                ชื่อชุดเช็คลิสต์
                <Input
                  className="mt-1"
                  value={sel.name}
                  onChange={(e) => setSel({ ...sel, name: e.target.value })}
                  placeholder="เช่น เช็คลิสต์ปั๊มลมสกรูประจำเดือน"
                />
              </label>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">ประเภทปั๊มลม (เลือกได้หลายประเภท)</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-primary gap-1 px-1.5"
                    onClick={() => setShowPumpManager(true)}
                  >
                    <Settings className="h-3 w-3" /> แก้ไข/ลบประเภท
                  </Button>
                </div>
                <MultiCombobox
                  values={splitNames(sel.machine_types || sel.pump_type)}
                  onChange={async (vals) => {
                    // Check if new types were typed in and ensure them
                    for (const v of vals) {
                      await ensurePumpType(v).catch(() => {});
                    }
                    setSel({
                      ...sel,
                      machine_types: joinNames(vals),
                      pump_type: vals.length === 1 ? vals[0] : null,
                    });
                  }}
                  options={pumpTypes}
                  placeholder="คลิกเพื่อเลือกประเภทปั๊มลม..."
                  searchPlaceholder="ค้นหาหรือพิมพ์ประเภทปั๊มใหม่..."
                  allowCustom={true}
                />
              </div>
            </div>

            <div className="rounded-md bg-muted/40 p-2.5 text-xs text-muted-foreground flex items-center justify-between">
              <span>
                {splitNames(sel.machine_types || sel.pump_type).length > 0
                  ? `💡 เทมเพลตนี้จะถูกเลือกอัตโนมัติเมื่อเครื่องจักรเป็นประเภท: ${splitNames(sel.machine_types || sel.pump_type).join(", ")}`
                  : "💡 ไม่ได้เลือกประเภทใด: ระบบจะถือว่าเป็นชุดทั่วไป และใช้เป็นค่าเริ่มต้นสำหรับเครื่องจักรทุกประเภท"}
              </span>
            </div>

            <div className="space-y-2">
              {sel.items.map((it, i) => (
                <div key={it.id} className="grid min-w-0 grid-cols-1 items-center gap-2 rounded border p-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <Input className="h-8" value={it.label} placeholder="ชื่อหัวข้อ" onChange={(e) => setItem(i, { label: e.target.value })} />
                  <select
                    className="h-8 rounded border bg-background px-2 text-sm"
                    value={it.kind}
                    onChange={(e) => {
                      const kind = e.target.value as ChecklistKind;
                      setItem(i, { kind, fields: kind === "status" ? [] : it.fields.length ? it.fields : [""] });
                    }}
                  >
                    {(Object.keys(KIND_LABEL) as ChecklistKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                  </select>
                  {it.kind !== "status" && (
                    <Input
                       className="h-8 w-full"
                      placeholder="ชื่อช่องย่อย เช่น Load, Unload"
                      value={it.fields.join(", ")}
                      onChange={(e) => setItem(i, { fields: e.target.value.split(",").map((s) => s.trimStart()) })}
                    />
                  )}
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSel({ ...sel, items: sel.items.filter((_, k) => k !== i) })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" onClick={() => setSel({ ...sel, items: [...sel.items, { id: uid(), label: "", kind: "status", fields: [] }] })}>
                <Plus className="mr-1 h-4 w-4" /> เพิ่มหัวข้อ
              </Button>
              <Button onClick={save} disabled={busy}><Save className="mr-1 h-4 w-4" /> บันทึก</Button>
              {isAdmin && (
                <ConfirmButton title={`ลบชุด "${sel.name}"?`} description="ผลเช็คลิสต์ในใบงานเก่ายังเก็บไว้ครบ" onConfirm={remove}>
                  <Trash2 className="h-4 w-4" /> ลบชุด
                </ConfirmButton>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">ยังไม่มีชุดเช็คลิสต์</CardContent></Card>
      )}

      {/* Modal จัดการประเภทปั๊มลม (Rename / Delete) */}
      <PumpTypeManagerDialog
        open={showPumpManager}
        onOpenChange={setShowPumpManager}
        onChanged={() => reload(sel?.id)}
      />
    </div>
  );
}

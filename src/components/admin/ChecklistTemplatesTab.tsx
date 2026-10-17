import { useEffect, useState } from "react";
import { supabase } from "@/lib/data-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Save } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useAccess, deleteAsAdmin } from "@/lib/access";
import { KIND_LABEL, loadTemplates, type ChecklistItem, type ChecklistKind, type ChecklistTemplate } from "@/lib/checklist";

const uid = () => Math.random().toString(36).slice(2, 10);

export function ChecklistTemplatesTab() {
  const { isAdmin } = useAccess();
  const [list, setList] = useState<ChecklistTemplate[]>([]);
  const [sel, setSel] = useState<ChecklistTemplate | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async (keepId?: string) => {
    const l = await loadTemplates();
    setList(l);
    const pick = l.find((t) => t.id === (keepId ?? sel?.id)) ?? l[0] ?? null;
    setSel(pick ? structuredClone(pick) : null);
  };
  useEffect(() => { reload(); }, []);

  const addTemplate = async () => {
    const { data, error } = await supabase
      .from("checklist_templates" as never)
      .insert({ name: "ชุดเช็คลิสต์ใหม่", machine_types: "", items: [], sort_order: list.length } as never)
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
    const { error } = await supabase
      .from("checklist_templates" as never)
      .update({ name: sel.name.trim(), machine_types: sel.machine_types?.trim() || null, items } as never)
      .eq("id", sel.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("บันทึกเทมเพลตแล้ว");
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
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
      <Card>
        <CardHeader><CardTitle className="text-base">ชุดเช็คลิสต์</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {list.map((t) => (
            <button
              key={t.id}
              onClick={() => setSel(structuredClone(t))}
              className={`w-full rounded border px-3 py-2 text-left text-sm ${sel?.id === t.id ? "border-primary bg-accent" : ""}`}
            >
              <div className="font-medium">{t.name}</div>
              <div className="text-xs text-muted-foreground">ประเภท: {t.machine_types || "—"} · {t.items.length} หัวข้อ</div>
            </button>
          ))}
          <Button variant="outline" className="w-full" onClick={addTemplate}><Plus className="mr-1 h-4 w-4" /> เพิ่มชุด</Button>
        </CardContent>
      </Card>

      {sel ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm">ชื่อชุด
                <Input value={sel.name} onChange={(e) => setSel({ ...sel, name: e.target.value })} />
              </label>
              <label className="text-sm">ประเภทเครื่องที่ใช้ (คั่นด้วย , เช่น สกรู, ลูกสูบ)
                <Input value={sel.machine_types ?? ""} onChange={(e) => setSel({ ...sel, machine_types: e.target.value })} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">ระบบจะเลือกชุดนี้อัตโนมัติเมื่อ "ประเภทปั๊ม" ของรุ่นเครื่องตรงกับคำที่ใส่ไว้</p>
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
            <div className="flex flex-wrap gap-2">
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
    </div>
  );
}

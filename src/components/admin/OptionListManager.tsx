import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/data-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X, Phone, MessageCircle } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { loadOptionList, saveOptionList, type OptionListKey } from "@/lib/option-lists";
import { lineHref, telHref, visibleLineId } from "@/lib/contact";

/**
 * จัดการรายการตัวเลือก "ผู้ขาย" หรือ "สถานะเครื่อง"
 * เพิ่ม / แก้ไขชื่อ (อัปเดตทุกเครื่องที่ใช้ค่านี้) / ลบ (ล้างค่าออกจากเครื่องที่ใช้)
 */
export function OptionListManager({
  listKey,
  column,
  title,
  presets = [],
  onChanged,
}: {
  listKey: OptionListKey;
  column: "seller" | "status";
  title: string;
  presets?: string[];
  onChanged?: () => void;
}) {
  const [custom, setCustom] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  /** ข้อมูลติดต่อ (เบอร์/LINE) ของผู้ขายจากตาราง sales_contacts แม็ปตามชื่อ */
  const [contacts, setContacts] = useState<Record<string, { phone: string | null; line: string | null }>>({});
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [list, units] = await Promise.all([
      loadOptionList(listKey),
      supabase.from("machine_units").select(column),
    ]);
    setCustom(list);
    const map: Record<string, number> = {};
    for (const u of (units.data ?? []) as any[]) {
      const v = (u[column] ?? "").trim();
      if (v) map[v] = (map[v] ?? 0) + 1;
    }
    setCounts(map);
    if (listKey === "sellers") {
      const { data: sc } = await supabase.from("sales_contacts").select("name, phone, line_contact");
      const cmap: Record<string, { phone: string | null; line: string | null }> = {};
      for (const r of (sc ?? []) as any[]) {
        const key = String(r.name ?? "").trim();
        if (key) cmap[key] = { phone: r.phone ?? null, line: visibleLineId(r.line_contact) || null };
      }
      setContacts(cmap);
    }
  }
  useEffect(() => { load(); }, [listKey, column]);
  useEffect(() => {
    const onChanged = () => load();
    window.addEventListener("sales-contacts-changed", onChanged);
    window.addEventListener("option-list-changed", onChanged);
    return () => {
      window.removeEventListener("sales-contacts-changed", onChanged);
      window.removeEventListener("option-list-changed", onChanged);
    };
  }, [listKey, column]);

  const all = useMemo(
    () =>
      Array.from(new Set([...presets, ...custom, ...Object.keys(counts)]))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "th")),
    [presets, custom, counts],
  );

  async function add() {
    const n = newName.trim();
    if (!n) return;
    if (all.some((s) => s.toLowerCase() === n.toLowerCase())) return toast.error("มีรายการนี้อยู่แล้ว");
    setBusy(true);
    await saveOptionList(listKey, [...custom, n]);
    setNewName("");
    await load();
    setBusy(false);
    onChanged?.();
    toast.success("เพิ่มแล้ว");
  }

  async function rename(oldName: string) {
    const n = editValue.trim();
    if (!n || n === oldName) { setEditing(null); return; }
    setBusy(true);
    await supabase.from("machine_units").update({ [column]: n } as any).eq(column, oldName);
    await saveOptionList(listKey, [...custom.filter((s) => s !== oldName), n]);
    setEditing(null);
    await load();
    setBusy(false);
    onChanged?.();
    toast.success("แก้ไขแล้ว");
  }

  async function remove(name: string) {
    setBusy(true);
    await supabase.from("machine_units").update({ [column]: null } as any).eq(column, name);
    await saveOptionList(listKey, custom.filter((s) => s !== name));
    await load();
    setBusy(false);
    onChanged?.();
    toast.success("ลบแล้ว");
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            placeholder={`เพิ่ม${title}ใหม่`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add} disabled={busy}><Plus className="h-4 w-4" /></Button>
        </div>
        <ul className="divide-y rounded border">
          {all.map((s) => (
            <li key={s} className="grid min-w-0 grid-cols-1 gap-2 px-3 py-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              {editing === s ? (
                <>
                  <Input
                    className="h-8"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && rename(s)}
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => rename(s)} disabled={busy}><Check className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
                  </div>
                </>
              ) : (
                <>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex min-w-0 flex-wrap items-center gap-2 break-words">
                      {s}
                      <Badge variant="outline">{counts[s] ?? 0} เครื่อง</Badge>
                    </span>
                    {contacts[s] && (telHref(contacts[s].phone) || lineHref(contacts[s].line)) && (
                      <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {telHref(contacts[s].phone) && (
                          <a className="inline-flex items-center gap-1 text-primary underline" href={telHref(contacts[s].phone)}>
                            <Phone className="h-3 w-3" /> {contacts[s].phone}
                          </a>
                        )}
                        {lineHref(contacts[s].line) && (
                          <a
                            className="inline-flex items-center gap-1 text-primary underline"
                            href={lineHref(contacts[s].line)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageCircle className="h-3 w-3" /> {contacts[s].line}
                          </a>
                        )}
                      </span>
                    )}
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setEditValue(s); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmButton
                      title={`ลบ "${s}"?`}
                      description={
                        counts[s]
                          ? `มี ${counts[s]} เครื่องที่ใช้ค่านี้ ระบบจะล้างค่าออกจากเครื่องเหล่านั้น`
                          : "ลบรายการนี้ออกจากตัวเลือก"
                      }
                      onConfirm={() => remove(s)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </ConfirmButton>
                  </div>
                </>
              )}
            </li>
          ))}
          {all.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">ยังไม่มีรายการ</li>}
        </ul>
      </CardContent>
    </Card>
  );
}

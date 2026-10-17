import { useEffect, useState } from "react";
import { supabase } from "@/lib/data-client";
import { deleteAsAdmin, useAccess } from "@/lib/access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmButton } from "@/components/ConfirmButton";
import { toast } from "sonner";
import { Briefcase, Check, Loader2, MessageCircle, Pencil, Phone, Plus, Trash2, X } from "lucide-react";
import { lineHref, telHref, visibleLineId } from "@/lib/contact";
import { loadOptionList, saveOptionList } from "@/lib/option-lists";

type Row = {
  id: string;
  kind: string;
  name: string;
  phone: string | null;
  line_contact: string | null;
};

const emptyDraft = { name: "", phone: "", lineId: "" };

/** จัดการรายชื่อผู้ขายและเซลล์รวมเป็นกลุ่มเดียว โดยคงประเภทและข้อมูลเดิมในฐานข้อมูล */
export function SalesContactsCard() {
  const { isAdmin } = useAccess();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ ...emptyDraft });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ ...emptyDraft });
  const [visibleRows, setVisibleRows] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("sales_contacts")
      .select("id, kind, name, phone, line_contact")
      .order("name");
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!draft.name.trim()) return toast.error("กรอกชื่อก่อน");
    setSaving(true);
    const { error } = await supabase.from("sales_contacts").insert({
      kind: "vendor",
      name: draft.name.trim(),
      phone: draft.phone.trim() || null,
      line_contact: draft.lineId.trim() || null,
    });
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }
    // ผูกชื่อเข้ากับลิสต์ "ผู้ขาย" (ด้านล่างซ้าย) ให้อัตโนมัติ ถ้ายังไม่มี
    const sellers = await loadOptionList("sellers");
    const n = draft.name.trim();
    if (!sellers.some((s) => s.toLowerCase() === n.toLowerCase())) {
      await saveOptionList("sellers", [...sellers, n]);
    }
    window.dispatchEvent(new Event("sales-contacts-changed"));
    setDraft({ ...emptyDraft });
    setSaving(false);
    toast.success("เพิ่มรายชื่อแล้ว");
    load();
  };

  const startEdit = (row: Row) => {
    setEditingId(row.id);
    setEditDraft({
      name: row.name,
      phone: row.phone ?? "",
      lineId: visibleLineId(row.line_contact),
    });
  };

  const update = async (row: Row) => {
    const name = editDraft.name.trim();
    if (!name) return toast.error("กรอกชื่อก่อน");
    setSaving(true);
    const { error } = await supabase
      .from("sales_contacts")
      .update({
        name,
        phone: editDraft.phone.trim() || null,
        line_contact: editDraft.lineId.trim() || null,
      })
      .eq("id", row.id);
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }
    if (name !== row.name) {
      const sellers = await loadOptionList("sellers");
      const oldNameStillUsed = rows.some((item) => item.id !== row.id && item.name.trim() === row.name.trim());
      const next = oldNameStillUsed ? sellers : sellers.filter((seller) => seller.trim() !== row.name.trim());
      if (!next.some((seller) => seller.toLowerCase() === name.toLowerCase())) next.push(name);
      await saveOptionList("sellers", next);
    }
    setEditingId(null);
    setSaving(false);
    window.dispatchEvent(new Event("sales-contacts-changed"));
    toast.success("บันทึกแล้ว");
    load();
  };

  const remove = async (id: string, name: string) => {
    const { error } = await deleteAsAdmin("sales_contacts", { id });
    if (error) return toast.error(error.message);
    // ลบชื่อออกจากลิสต์ "ผู้ขาย" ด้วย ถ้าไม่มีรายชื่ออื่นใช้ชื่อนี้อยู่
    const stillUsed = rows.some((r) => r.id !== id && r.name.trim() === name.trim());
    if (!stillUsed) {
      const sellers = await loadOptionList("sellers");
      await saveOptionList("sellers", sellers.filter((s) => s.trim() !== name.trim()));
    }
    toast.success("ลบแล้ว");
    window.dispatchEvent(new Event("sales-contacts-changed"));
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Briefcase className="h-4 w-4" /> ผู้ขาย ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <section className="space-y-3">
            <div className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto]">
              <Input
                placeholder="ชื่อ"
                value={draft.name}
                onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
              <Input
                placeholder="เบอร์โทร"
                value={draft.phone}
                onChange={(e) => setDraft((current) => ({ ...current, phone: e.target.value }))}
              />
              <Input
                placeholder="LINE ID"
                value={draft.lineId}
                onChange={(e) => setDraft((current) => ({ ...current, lineId: e.target.value }))}
              />
              <Button onClick={add} disabled={saving}>
                {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                เพิ่ม
              </Button>
            </div>

            <div className="space-y-2">
              {rows.map((row) => {
                const line = visibleLineId(row.line_contact);
                const tel = telHref(row.phone);
                const lh = lineHref(line);
                const lineVisible = visibleRows[row.id] ?? true;
                const isEditing = editingId === row.id;
                return (
                  <div key={row.id} className="rounded-md border p-3">
                    {isEditing ? (
                      <div className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto]">
                        <Input
                          aria-label="ชื่อ"
                          value={editDraft.name}
                          onChange={(e) => setEditDraft((current) => ({ ...current, name: e.target.value }))}
                        />
                        <Input
                          aria-label="เบอร์โทร"
                          placeholder="เบอร์โทร"
                          value={editDraft.phone}
                          onChange={(e) => setEditDraft((current) => ({ ...current, phone: e.target.value }))}
                        />
                        <Input
                          aria-label="LINE ID"
                          placeholder="LINE ID"
                          value={editDraft.lineId}
                          onChange={(e) => setEditDraft((current) => ({ ...current, lineId: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && update(row)}
                        />
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => update(row)} disabled={saving}>
                            <Check className="mr-1 h-4 w-4" /> บันทึก
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={saving}>
                            <X className="mr-1 h-4 w-4" /> ยกเลิก
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid min-w-0 grid-cols-1 gap-3 text-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto_auto_auto] lg:items-center">
                        <div className="min-w-0">
                          <span className="block text-xs text-muted-foreground">ชื่อ</span>
                          <span className="block truncate font-medium" title={row.name}>{row.name}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="block text-xs text-muted-foreground">เบอร์โทร</span>
                          {tel ? (
                            <a className="inline-flex max-w-full items-center gap-1 truncate text-primary underline" href={tel}>
                              <Phone className="h-3.5 w-3.5 shrink-0" /> {row.phone}
                            </a>
                          ) : <span>—</span>}
                        </div>
                        <div className="min-w-0">
                          <span className="block text-xs text-muted-foreground">LINE ID</span>
                          {lineVisible && lh ? (
                            <a className="inline-flex max-w-full items-center gap-1 truncate text-primary underline" href={lh} target="_blank" rel="noreferrer">
                              <MessageCircle className="h-3.5 w-3.5 shrink-0" /> {line}
                            </a>
                          ) : <span>{lineVisible ? (line || "—") : "••••••••"}</span>}
                        </div>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground" htmlFor={`contact-visible-${row.id}`}>
                          <Switch
                            id={`contact-visible-${row.id}`}
                            checked={lineVisible}
                            onCheckedChange={(checked) => setVisibleRows((current) => ({ ...current, [row.id]: checked }))}
                          />
                          {lineVisible ? "แสดง LINE" : "ซ่อน LINE"}
                        </label>
                        <Button size="sm" variant="outline" onClick={() => startEdit(row)}>
                          <Pencil className="mr-1 h-4 w-4" /> แก้ไข
                        </Button>
                        {isAdmin ? (
                          <ConfirmButton
                            size="sm"
                            variant="destructive"
                            onConfirm={() => remove(row.id, row.name)}
                            title="ลบรายชื่อนี้?"
                            description={`ลบ ${row.name} ออกจากระบบถาวร`}
                          >
                            <Trash2 className="mr-1 h-4 w-4" /> ลบ
                          </ConfirmButton>
                        ) : (
                          <Button size="sm" variant="destructive" disabled>
                            <Trash2 className="mr-1 h-4 w-4" /> ลบ
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {rows.length === 0 && (
                <p className="rounded-md border px-3 py-4 text-sm text-muted-foreground">ยังไม่มีข้อมูลผู้ขาย</p>
              )}
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

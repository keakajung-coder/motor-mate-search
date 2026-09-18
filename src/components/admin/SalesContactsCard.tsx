import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deleteAsAdmin, useAccess } from "@/lib/access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ConfirmButton";
import { toast } from "sonner";
import { Briefcase, Loader2, MessageCircle, Phone, Plus, Trash2, UserRound } from "lucide-react";
import { lineHref, telHref, visibleLineId } from "@/lib/contact";
import { loadOptionList, saveOptionList } from "@/lib/option-lists";

type Row = {
  id: string;
  kind: string;
  name: string;
  company: string | null;
  phone: string | null;
  line_contact: string | null;
};

const KINDS = [
  { value: "vendor", label: "ผู้ขาย" },
  { value: "sales", label: "เซลล์" },
];

const emptyDraft = { name: "", company: "", phone: "", lineId: "" };

/** จัดการรายชื่อผู้ขาย / เซลล์ แยกส่วนละฟอร์มเพิ่ม + ปุ่มลบรายรายการ */
export function SalesContactsCard() {
  const { isAdmin } = useAccess();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  /** แยก draft ฟอร์มตาม kind (vendor / sales) */
  const [drafts, setDrafts] = useState<Record<string, typeof emptyDraft>>({
    vendor: { ...emptyDraft },
    sales: { ...emptyDraft },
  });

  const load = async () => {
    const { data } = await supabase
      .from("sales_contacts")
      .select("id, kind, name, company, phone, line_contact")
      .order("name");
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const setDraft = (kind: string, patch: Partial<typeof emptyDraft>) =>
    setDrafts((d) => ({ ...d, [kind]: { ...d[kind], ...patch } }));

  const add = async (kind: string) => {
    const d = drafts[kind];
    if (!d.name.trim()) return toast.error("กรอกชื่อก่อน");
    const { error } = await supabase.from("sales_contacts").insert({
      kind,
      name: d.name.trim(),
      company: d.company.trim() || null,
      phone: d.phone.trim() || null,
      line_contact: d.lineId.trim() || null,
    });
    if (error) return toast.error(error.message);
    // ผูกชื่อเข้ากับลิสต์ "ผู้ขาย" (ด้านล่างซ้าย) ให้อัตโนมัติ ถ้ายังไม่มี
    const sellers = await loadOptionList("sellers");
    const n = d.name.trim();
    if (!sellers.some((s) => s.toLowerCase() === n.toLowerCase())) {
      await saveOptionList("sellers", [...sellers, n]);
    }
    window.dispatchEvent(new Event("sales-contacts-changed"));
    setDrafts((prev) => ({ ...prev, [kind]: { ...emptyDraft } }));
    toast.success("เพิ่มรายชื่อแล้ว");
    load();
  };

  const update = async (id: string, patch: Partial<Row>) => {
    const { error } = await supabase.from("sales_contacts").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    window.dispatchEvent(new Event("sales-contacts-changed"));
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
          <Briefcase className="h-4 w-4" /> ผู้ขาย / เซลล์ ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          KINDS.map((k) => {
            const list = rows.filter((r) => r.kind === k.value);
            const d = drafts[k.value];
            return (
              <section key={k.value} className="space-y-3 rounded-md border p-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  {k.label} ({list.length})
                </h3>

                {/* ฟอร์มเพิ่มรายชื่อของส่วนนี้โดยเฉพาะ */}
                <div className="flex flex-wrap gap-2">
                  <Input
                    className="min-w-36 flex-1"
                    placeholder="ชื่อ"
                    value={d.name}
                    onChange={(e) => setDraft(k.value, { name: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && add(k.value)}
                  />
                  <Input
                    className="w-40"
                    placeholder="บริษัท / ร้าน"
                    value={d.company}
                    onChange={(e) => setDraft(k.value, { company: e.target.value })}
                  />
                  <Input
                    className="w-36"
                    placeholder="เบอร์โทร"
                    value={d.phone}
                    onChange={(e) => setDraft(k.value, { phone: e.target.value })}
                  />
                  <Input
                    className="w-44"
                    placeholder="LINE ID (เช่น @shop หรือ 0812345678)"
                    value={d.lineId}
                    onChange={(e) => setDraft(k.value, { lineId: e.target.value })}
                  />
                  <Button onClick={() => add(k.value)}>
                    <Plus className="mr-1 h-4 w-4" /> เพิ่ม{k.label}
                  </Button>
                </div>

                <div className="space-y-2">
                  {list.map((r) => {
                    const line = visibleLineId(r.line_contact);
                    const tel = telHref(r.phone);
                    const lh = lineHref(line);
                    return (
                      <div key={r.id} className="space-y-2 rounded-md border p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            className="min-w-32 flex-1"
                            defaultValue={r.name}
                            onBlur={(e) => e.target.value.trim() && update(r.id, { name: e.target.value.trim() })}
                          />
                          <Input
                            className="w-36"
                            defaultValue={r.company ?? ""}
                            placeholder="บริษัท / ร้าน"
                            onBlur={(e) => update(r.id, { company: e.target.value.trim() || null })}
                          />
                          <Input
                            className="w-32"
                            defaultValue={r.phone ?? ""}
                            placeholder="เบอร์โทร"
                            onBlur={(e) => update(r.id, { phone: e.target.value.trim() || null })}
                          />
                          <Input
                            className="w-40"
                            defaultValue={r.line_contact ?? ""}
                            placeholder="LINE ID"
                            onBlur={(e) => update(r.id, { line_contact: e.target.value.trim() || null })}
                          />
                          {isAdmin && (
                            <ConfirmButton
                              onConfirm={() => remove(r.id, r.name)}
                              title="ลบรายชื่อนี้?"
                              description={`ลบ ${r.name} ออกจากระบบถาวร`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </ConfirmButton>
                          )}
                        </div>
                        {(tel || lh) && (
                          <div className="flex flex-wrap items-center gap-3 text-sm">
                            {tel && (
                              <a className="inline-flex items-center gap-1 text-primary underline" href={tel}>
                                <Phone className="h-3.5 w-3.5" /> {r.phone}
                              </a>
                            )}
                            {lh && (
                              <a
                                className="inline-flex items-center gap-1 text-primary underline"
                                href={lh}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <MessageCircle className="h-3.5 w-3.5" /> {line}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {list.length === 0 && (
                    <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล{k.label}</p>
                  )}
                </div>
              </section>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

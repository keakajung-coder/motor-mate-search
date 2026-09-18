import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deleteAsAdmin, useAccess } from "@/lib/access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ConfirmButton";
import { toast } from "sonner";
import { Briefcase, Loader2, MessageCircle, Phone, Plus, Trash2 } from "lucide-react";
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

/** จัดการรายชื่อผู้ขาย / เซลล์ พร้อมเบอร์โทรและ LINE ID สำหรับแชร์ผู้ติดต่อ */
export function SalesContactsCard() {
  const { isAdmin } = useAccess();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState("vendor");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [lineId, setLineId] = useState("");

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

  const add = async () => {
    if (!name.trim()) return toast.error("กรอกชื่อก่อน");
    const { error } = await supabase.from("sales_contacts").insert({
      kind,
      name: name.trim(),
      company: company.trim() || null,
      phone: phone.trim() || null,
      line_contact: lineId.trim() || null,
    });
    if (error) return toast.error(error.message);
    // ผูกชื่อเข้ากับลิสต์ "ผู้ขาย" (ด้านล่างซ้าย) ให้อัตโนมัติ ถ้ายังไม่มี
    const sellers = await loadOptionList("sellers");
    const n = name.trim();
    if (!sellers.some((s) => s.toLowerCase() === n.toLowerCase())) {
      await saveOptionList("sellers", [...sellers, n]);
    }
    window.dispatchEvent(new Event("sales-contacts-changed"));
    setName("");
    setCompany("");
    setPhone("");
    setLineId("");
    toast.success("เพิ่มรายชื่อแล้ว");
    load();
  };

  const update = async (id: string, patch: Partial<Row>) => {
    const { error } = await supabase.from("sales_contacts").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    window.dispatchEvent(new Event("sales-contacts-changed"));
  };

  const remove = async (id: string) => {
    const { error } = await deleteAsAdmin("sales_contacts", { id });
    if (error) return toast.error(error.message);
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
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <select
            className="h-10 rounded-md border bg-background px-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <Input className="min-w-36 flex-1" placeholder="ชื่อ" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            className="w-40"
            placeholder="บริษัท / ร้าน"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <Input className="w-36" placeholder="เบอร์โทร" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input
            className="w-44"
            placeholder="LINE ID (เช่น @shop หรือ 0812345678)"
            value={lineId}
            onChange={(e) => setLineId(e.target.value)}
          />
          <Button onClick={add}>
            <Plus className="mr-1 h-4 w-4" /> เพิ่ม
          </Button>
        </div>

        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const line = visibleLineId(r.line_contact);
              const tel = telHref(r.phone);
              const lh = lineHref(line);
              return (
                <div key={r.id} className="space-y-2 rounded-md border p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                      defaultValue={r.kind}
                      onChange={(e) => update(r.id, { kind: e.target.value })}
                    >
                      {KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </select>
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
                        onConfirm={() => remove(r.id)}
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
            {rows.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

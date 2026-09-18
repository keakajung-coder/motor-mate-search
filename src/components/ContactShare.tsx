import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Phone, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  autoShareEnabled,
  contactText,
  lineHref,
  lineShareHref,
  loadAllContacts,
  setAutoShare,
  shareContacts,
  telHref,
  visibleLineId,
  type ContactRow,
} from "@/lib/contact";

/**
 * แผงแชร์ผู้ติดต่อช่าง/ผู้ให้บริการ (ชื่อ · เบอร์ · LINE ID)
 * เลือกเองหรือเปิดสวิตช์ให้แชร์อัตโนมัติเมื่อส่งงาน/แจ้งปัญหา
 */
export function ContactShare({
  selected,
  onSelectedChange,
  customerName,
  title,
}: {
  selected: string[];
  onSelectedChange: (names: string[]) => void;
  customerName?: string | null;
  title: string;
}) {
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    loadAllContacts().then(setRows);
    setAuto(autoShareEnabled());
  }, []);

  const toggle = (name: string) =>
    onSelectedChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);

  const picked = rows.filter((r) => selected.includes(r.name));

  const sendNow = async () => {
    if (picked.length === 0) return toast.error("เลือกผู้ติดต่อก่อน");
    const ok = await shareContacts({ staffNames: selected, customerName, title });
    toast[ok ? "success" : "error"](ok ? "ส่งข้อมูลผู้ติดต่อเข้า LINE แล้ว" : "ยังส่งเข้า LINE ไม่ได้ ลองแชร์ด้วยมือ");
  };

  return (
    <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">ผู้ติดต่อ ช่าง / ผู้ขาย / เซลล์</p>
        <div className="flex items-center gap-2">
          <Label htmlFor="auto-share" className="text-xs text-muted-foreground">
            แชร์อัตโนมัติ
          </Label>
          <Switch
            id="auto-share"
            checked={auto}
            onCheckedChange={(v) => {
              setAuto(v);
              setAutoShare(v);
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {rows.map((r) => (
          <Badge
            key={r.id}
            variant={selected.includes(r.name) ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => toggle(r.name)}
          >
            {r.name}
            {r.role && r.role !== "staff" ? ` · ${r.role === "vendor" ? "ผู้ขาย" : "เซลล์"}` : ""}
          </Badge>
        ))}
        {rows.length === 0 && <span className="text-xs text-muted-foreground">ยังไม่มีรายชื่อผู้ติดต่อ</span>}
      </div>

      {picked.length > 0 && (
        <div className="space-y-1">
          {picked.map((r) => {
            const line = visibleLineId(r.line_contact) || visibleLineId(r.line_id);
            const tel = telHref(r.phone);
            const lh = lineHref(line);
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{r.name}</span>
                {tel && (
                  <a className="inline-flex items-center gap-1 text-primary underline" href={tel}>
                    <Phone className="h-3.5 w-3.5" /> {r.phone}
                  </a>
                )}
                {line &&
                  (lh ? (
                    <a
                      className="inline-flex items-center gap-1 text-primary underline"
                      href={lh}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> {line}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <MessageCircle className="h-3.5 w-3.5" /> {line}
                    </span>
                  ))}
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" size="sm" variant="outline" onClick={sendNow}>
              <Share2 className="mr-1 h-4 w-4" /> ส่งผู้ติดต่อเข้า LINE
            </Button>
            <Button type="button" size="sm" variant="ghost" asChild>
              <a href={lineShareHref(contactText(picked, title))} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-1 h-4 w-4" /> แชร์ด้วยตัวเอง
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

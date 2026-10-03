import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { ConfirmButton } from "@/components/ConfirmButton";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { loadOptionList, saveOptionList } from "@/lib/option-lists";
import { refreshDirectory } from "@/lib/directory";

/** โอนย้ายรายชื่อลูกค้า/เครื่องจักรจากผู้ขายคนเดิมไปยังผู้ขายคนใหม่ (Bulk Transfer) */
export function SellerTransfer({ onChanged }: { onChanged?: () => void }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [custom, setCustom] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [units, list] = await Promise.all([
      supabase.from("machine_units").select("seller"),
      loadOptionList("sellers"),
    ]);
    const map: Record<string, number> = {};
    for (const u of (units.data ?? []) as any[]) {
      const v = (u.seller ?? "").trim();
      if (v) map[v] = (map[v] ?? 0) + 1;
    }
    setCounts(map);
    setCustom(list);
  }
  useEffect(() => {
    load();
  }, []);

  const sellers = useMemo(
    () =>
      Array.from(new Set([...custom, ...Object.keys(counts)]))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "th")),
    [custom, counts],
  );

  async function transfer() {
    if (!from || !to || from === to) return toast.error("กรุณาเลือกผู้ขายต้นทางและปลายทางให้ถูกต้อง");
    setBusy(true);
    const { error } = await supabase.from("machine_units").update({ seller: to }).eq("seller", from);
    if (!error && !custom.includes(to)) await saveOptionList("sellers", [...custom, to]);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`โอนย้าย ${counts[from] ?? 0} รายการจาก ${from} ไปยัง ${to} แล้ว`);
    setFrom("");
    setTo("");
    await load();
    await refreshDirectory();
    onChanged?.();
  }

  const options = sellers.map((s) => ({ value: s, hint: `${counts[s] ?? 0} เครื่อง` }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">โอนย้ายข้อมูลลูกค้าข้ามผู้ขาย</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          ใช้เมื่อพนักงานขายลาออกหรือจัดสรรทีมใหม่ — ระบบจะย้ายลูกค้าและเครื่องจักรทั้งหมดของคนเดิมไปอยู่กับคนใหม่ทันที
        </p>
        <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-end">
          <div className="space-y-1">
            <Label className="text-xs">จากผู้ขาย (คนเดิม)</Label>
            <Combobox value={from} onChange={setFrom} options={options} placeholder="เลือกผู้ขายคนเดิม" />
          </div>
          <ArrowRight className="mx-auto hidden h-5 w-5 text-muted-foreground lg:block" />
          <div className="space-y-1">
            <Label className="text-xs">ไปยังผู้ขาย (คนใหม่)</Label>
            <Combobox value={to} onChange={setTo} options={options} allowCustom placeholder="เลือก / พิมพ์ผู้ขายคนใหม่" />
          </div>
        </div>
        {from && (
          <p className="text-sm">
            จะย้ายทั้งหมด <Badge variant="secondary">{counts[from] ?? 0} เครื่อง</Badge>
          </p>
        )}
        <ConfirmButton
          className="h-11 w-full sm:w-auto"
          variant="default"
          title="ยืนยันการโอนย้าย?"
          description={`ย้ายข้อมูลทั้งหมดของ "${from || "-"}" ไปยัง "${to || "-"}"`}
          confirmText="โอนย้าย"
          onConfirm={transfer}
        >
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} ยืนยันการโอนย้าย (Transfer Data)
        </ConfirmButton>
      </CardContent>
    </Card>
  );
}

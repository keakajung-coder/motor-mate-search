import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DatabaseBackup, Download, Loader2, Upload } from "lucide-react";
import { downloadBlob } from "@/lib/report";

const TABLES = [
  "brands",
  "categories",
  "compressor_models",
  "customers",
  "products",
  "machine_units",
  "machine_parts",
  "service_staff",
  "vehicles",
  "work_orders",
  "appointments",
  "maintenance_logs",
  "app_settings",
] as const;

export function BackupRestore() {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const backup = async () => {
    setBusy(true);
    try {
      const dump: Record<string, unknown[]> = {};
      for (const t of TABLES) {
        const { data, error } = await supabase.from(t as never).select("*");
        if (error) throw new Error(`${t}: ${error.message}`);
        dump[t] = data ?? [];
      }
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data: dump }, null, 2)], {
        type: "application/json",
      });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `backup-อะไหล่ปั๊มลม-${stamp}.json`);
      toast.success("ดาวน์โหลดไฟล์สำรองแล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "สำรองข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const restore = async (file: File) => {
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text());
      const dump: Record<string, unknown[]> = parsed?.data ?? parsed;
      let total = 0;
      for (const t of TABLES) {
        const rows = dump[t];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200);
          const { error } = await supabase.from(t as never).upsert(chunk as never, { onConflict: "id" });
          if (error) throw new Error(`${t}: ${error.message}`);
          total += chunk.length;
        }
      }
      toast.success(`กู้คืนข้อมูลแล้ว ${total} รายการ`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "กู้คืนข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <DatabaseBackup className="h-4 w-4" /> สำรอง / กู้คืนข้อมูล
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button onClick={backup} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
            ดาวน์โหลดข้อมูลสำรอง (JSON)
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="mr-1 h-4 w-4" /> กู้คืนข้อมูลจากไฟล์
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) restore(f);
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          การกู้คืนจะเขียนทับข้อมูลที่มีรหัสเดียวกัน และเพิ่มรายการที่ยังไม่มีในระบบ
        </p>
      </CardContent>
    </Card>
  );
}

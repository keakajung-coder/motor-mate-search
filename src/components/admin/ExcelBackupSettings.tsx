import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { storedAdminCode } from "@/lib/access";
import { formatBytes } from "@/lib/report";
import {
  backupDownloadUrl, backupNow, getBackupInfo, saveBackupInterval, type BackupInterval,
} from "@/lib/excel-backup.functions";

/** ตั้งค่าสำรองไฟล์ Excel อัตโนมัติเข้าโฟลเดอร์บนระบบ */
export function ExcelBackupSettings() {
  const [interval, setIntervalV] = useState<BackupInterval>("off");
  const [last, setLast] = useState("");
  const [files, setFiles] = useState<{ name: string; size: number }[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await getBackupInfo({ data: { code: storedAdminCode() } });
    if (!r.ok) return;
    setIntervalV(r.interval);
    setLast(r.last);
    setFiles(r.files);
  }, []);
  useEffect(() => void load(), [load]);

  const change = async (v: BackupInterval) => {
    setIntervalV(v);
    const r = await saveBackupInterval({ data: { code: storedAdminCode(), interval: v } });
    if (!r.ok) toast.error(r.error);
    else toast.success("บันทึกรอบสำรองแล้ว");
  };

  const now = async () => {
    setBusy(true);
    const r = await backupNow({ data: { code: storedAdminCode() } });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("สำรอง Excel แล้ว");
    load();
  };

  const download = async (name: string) => {
    const r = await backupDownloadUrl({ data: { code: storedAdminCode(), name } });
    if (!r.ok) return toast.error(r.error);
    window.open(r.url, "_blank");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-4 w-4" /> สำรองไฟล์ Excel อัตโนมัติ
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,16rem)_auto] sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs">รอบการสำรอง</Label>
            <Select value={interval} onValueChange={(v) => change(v as BackupInterval)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="off">ปิด (สำรองเองเท่านั้น)</SelectItem>
                <SelectItem value="daily">ทุกวัน</SelectItem>
                <SelectItem value="weekly">ทุกสัปดาห์</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={now} disabled={busy}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} สำรองตอนนี้
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          สำรองล่าสุด: {last ? new Date(last).toLocaleString("th-TH") : "ยังไม่เคย"} — ระบบจะสำรองเมื่อมีผู้เปิดแอปหลังครบกำหนด
        </p>
        <div className="space-y-1">
          {files.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีไฟล์สำรอง</p>}
          {files.map((f) => (
            <div key={f.name} className="flex min-w-0 items-center justify-between gap-2 rounded border px-2 py-1 text-sm">
              <span className="min-w-0 truncate">{f.name}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                {formatBytes(f.size)}
                <Button size="sm" variant="ghost" onClick={() => download(f.name)} aria-label="ดาวน์โหลด">
                  <Download className="h-4 w-4" />
                </Button>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { buildPageWorkbook } from "@/lib/excel-export";
import { saveFile, shareOrDownload } from "@/lib/report";
import { maybeAutoBackup } from "@/lib/excel-backup.functions";

/** ปุ่มลอยส่งออก Excel ทุกหน้า + ตรวจสำรองอัตโนมัติเมื่อครบกำหนด */
export function ExcelExportButton() {
  const path = useLocation({ select: (l) => l.pathname });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const run = () => void maybeAutoBackup().catch(() => {});
    run();
    const t = setInterval(run, 60 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const go = async (mode: "download" | "share") => {
    setBusy(true);
    try {
      if (path === "/planner") {
        await new Promise<void>((resolve, reject) => {
          window.dispatchEvent(new CustomEvent("app:planner-excel", { detail: { mode, resolve, reject } }));
        });
        return;
      }
      const { blob, filename, title } = await buildPageWorkbook(path);
      if (mode === "share") await shareOrDownload(blob, filename, title);
      else await saveFile(blob, filename);
      toast.success("ส่งออก Excel แล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ส่งออก Excel ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-3 z-40 print:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="secondary" className="shadow-md" disabled={busy} aria-label="ส่งออก Excel">
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1 h-4 w-4" />}
            Excel
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => go("download")}>ดาวน์โหลด Excel (.xlsx)</DropdownMenuItem>
          <DropdownMenuItem onClick={() => go("share")}>แชร์ไฟล์ Excel</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

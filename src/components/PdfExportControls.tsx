import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2, Printer, Check } from "lucide-react";
import type { PdfSettings } from "@/lib/pdf-layout";

function PdfControls({ build, initial, finish }: { build: (s: PdfSettings) => Promise<Blob>; initial: PdfSettings; finish: (b: Blob | null) => void }) {
  const [settings, setSettings] = useState(initial);
  const [custom, setCustom] = useState(initial.pages > 2);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const latest = useRef(0);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    const version = ++latest.current;
    setBusy(true);
    setBlob(null);
    setError("");
    const timer = setTimeout(() => {
      queue.current = queue.current.then(async () => {
        if (version !== latest.current) return;
        try {
          const result = await build(settings);
          if (version !== latest.current) return;
          setBlob(result);
          setUrl(URL.createObjectURL(result));
        } catch (e) {
          if (version === latest.current) setError(e instanceof Error ? e.message : "สร้าง PDF ไม่สำเร็จ");
        } finally {
          if (version === latest.current) setBusy(false);
        }
      });
    }, 250);
    return () => { clearTimeout(timer); latest.current++; };
  }, [build, settings]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return <Dialog open onOpenChange={open => { if (!open && !busy) finish(null); }}>
    <DialogContent aria-describedby={undefined} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => e.preventDefault()}>
      <DialogHeader><DialogTitle>ตั้งค่ากระดาษ / ตัวอย่าง PDF</DialogTitle></DialogHeader>
      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="min-w-0 space-y-2"><Label>แนวกระดาษ</Label>
          <Select value={settings.orientation} onValueChange={v => setSettings(s => ({ ...s, orientation: v === "landscape" ? "landscape" : "portrait" }))}>
            <SelectTrigger className="w-full" aria-label="แนวกระดาษ"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="portrait">แนวตั้ง (Portrait)</SelectItem><SelectItem value="landscape">แนวนอน (Landscape)</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-2"><Label>จำนวนหน้า</Label>
          <Select value={custom ? "custom" : String(settings.pages)} onValueChange={v => { setCustom(v === "custom"); setSettings(s => ({ ...s, pages: v === "custom" ? 3 : Number(v) })); }}>
            <SelectTrigger className="w-full" aria-label="จำนวนหน้า"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="0">อัตโนมัติ — อ่านง่ายหลายหน้า</SelectItem><SelectItem value="1">ไม่เกิน 1 หน้า</SelectItem><SelectItem value="2">ไม่เกิน 2 หน้า</SelectItem><SelectItem value="custom">กำหนดจำนวนหน้าเอง</SelectItem></SelectContent>
          </Select>
        </div>
        {custom && <div className="min-w-0 space-y-2"><Label htmlFor="pdf-page-limit">จำนวนหน้าสูงสุด</Label><Input id="pdf-page-limit" type="number" min={1} step={1} value={settings.pages} onChange={e => setSettings(s => ({ ...s, pages: Math.max(1, Math.floor(Number(e.target.value) || 1)) }))} /></div>}
      </div>
      <div className="h-[50dvh] min-h-40 overflow-hidden rounded border bg-muted" aria-busy={busy}>
        {busy ? <div role="status" className="flex h-full items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />กำลังจัดหน้ากระดาษ…</div> : error ? <p role="alert" className="p-4 text-destructive">{error}</p> : <iframe title="ตัวอย่าง PDF ตามการตั้งค่า" src={url} className="h-full w-full" />}
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={busy || !blob} onClick={() => { if (url) window.open(url, "_blank", "noopener,noreferrer"); }}><Printer className="mr-2 h-4 w-4" />เปิดเพื่อพิมพ์</Button>
        <Button disabled={busy || !blob} onClick={() => { if (blob) finish(blob); }}><Check className="mr-2 h-4 w-4" />ใช้ PDF นี้</Button>
        <Button variant="outline" disabled={busy} onClick={() => finish(null)}>ยกเลิก</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function openPdfControls(build: (s: PdfSettings) => Promise<Blob>, initial: PdfSettings): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const finish = (blob: Blob | null) => {
      root.unmount(); host.remove();
      if (blob) resolve(blob);
      else reject(new Error("ยกเลิกการส่งออก PDF"));
    };
    root.render(<PdfControls build={build} initial={initial} finish={finish} />);
  });
}
import { useRef, useState } from "react";
import { supabase } from "@/lib/data-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Film, ImageIcon, KeyRound, Loader2, Paperclip, Trash2 } from "lucide-react";
import { useAccess } from "@/lib/access";
import { getAccessStatus, refreshSession } from "@/lib/passcode.functions";

export type JobAttachment = { path: string; url: string; name: string; kind: "image" | "video" };

const BUCKET = "job-attachments";
const PREVIEW_SECONDS = 600;

const PASSCODE_INPUT = {
  type: "password",
  inputMode: "text",
  autoCapitalize: "none",
  autoCorrect: "off",
  spellCheck: false,
} as const;

/** อ่านรายการไฟล์แนบจากข้อความ JSON ที่เก็บในฐานข้อมูล */
export function parseAttachments(value?: string | null): JobAttachment[] {
  if (!value) return [];
  try {
    const list = JSON.parse(value);
    return Array.isArray(list) ? (list.filter((i) => i && i.url) as JobAttachment[]) : [];
  } catch {
    return [];
  }
}

export function serializeAttachments(list: JobAttachment[]) {
  return list.length ? JSON.stringify(list) : null;
}

/** อัปโหลด/ลบรูปภาพและคลิปวิดีโอหน้างานของใบสั่งงาน */
export function JobAttachments({
  value,
  onChange,
  readOnly = false,
}: {
  value?: string | null;
  onChange?: (next: string | null) => void;
  readOnly?: boolean;
}) {
  const items = parseAttachments(value);
  const [busy, setBusy] = useState(false);
  const [showReauth, setShowReauth] = useState(false);
  const [reauthCode, setReauthCode] = useState("");
  const [reauthBusy, setReauthBusy] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { unlockViewer } = useAccess();

  const upload = async (files: FileList | File[] | null) => {
    if (!files || (Array.isArray(files) ? !files.length : !files.length) || !onChange) return;
    setBusy(true);

    // Preflight: ตรวจสอบสถานะการเข้าใช้งานก่อนอัปโหลด
    const status = await getAccessStatus().catch(() => ({ viewerOk: false, isAdmin: false }));
    if (!status.viewerOk) {
      // ลอง Refresh เซสชันอัตโนมัติ
      const refreshed = await refreshSession().catch(() => ({ ok: false }));
      if (!refreshed.ok) {
        setPendingFiles(Array.from(files));
        setShowReauth(true);
        setBusy(false);
        return;
      }
    }

    const added: JobAttachment[] = [];
    const { compressImage } = await import("@/lib/image-compress");
    const fileList = Array.from(files);

    for (let i = 0; i < fileList.length; i++) {
      const original = fileList[i];
      const rawExt = original.name.split(".").pop()?.toLowerCase() || "";
      const isVideo = original.type.startsWith("video/") || /^(mp4|webm|mov|quicktime)$/.test(rawExt);
      const isImage = original.type.startsWith("image/") || /^(jpe?g|png|webp|gif|heic|heif)$/.test(rawExt);

      if (!isVideo && !isImage) {
        toast.error(`${original.name}: รองรับเฉพาะรูปภาพและวิดีโอ`);
        continue;
      }

      let file: File = original;
      if (!isVideo) {
        try {
          file = await compressImage(original, { maxSize: 1920, quality: 0.8 });
        } catch (e) {
          console.warn("[JobAttachments] Image compression failed, using original:", e);
          file = original;
        }
      }

      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name}: ไฟล์ใหญ่เกิน 50MB`);
        continue;
      }

      const ext = file.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
      const mime = file.type || (isVideo ? "video/mp4" : "image/jpeg");
      const path = `jobs/${crypto.randomUUID()}.${ext}`;

      let uploadRes = await supabase.storage.from(BUCKET).upload(path, file, { contentType: mime });

      // กรณี Session หมดอายุระหว่างอัปโหลด
      if (uploadRes.error && (uploadRes.error.message.includes("เข้าใช้งาน") || uploadRes.error.message.includes("ปลดล็อก"))) {
        const refreshed = await refreshSession().catch(() => ({ ok: false }));
        if (refreshed.ok) {
          uploadRes = await supabase.storage.from(BUCKET).upload(path, file, { contentType: mime });
        } else {
          // แจ้งเตือนขอรหัสผ่านในฟอร์มทันที โดยไม่ต้องโหลดหน้าใหม่และไม่ทำให้ข้อมูลที่กรอกหาย
          setPendingFiles(fileList.slice(i));
          setShowReauth(true);
          setBusy(false);
          return;
        }
      }

      if (uploadRes.error) {
        toast.error(`${file.name}: ${uploadRes.error.message}`);
        continue;
      }

      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, PREVIEW_SECONDS);
      added.push({ path, url: data?.signedUrl ?? "", name: file.name, kind: isVideo ? "video" : "image" });
    }

    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (added.length) {
      onChange(serializeAttachments([...items, ...added]));
      toast.success(`แนบไฟล์แล้ว ${added.length} รายการ`);
    }
  };

  const submitReauth = async () => {
    if (!reauthCode.trim()) return;
    setReauthBusy(true);
    const ok = await unlockViewer(reauthCode.trim());
    setReauthBusy(false);
    if (ok) {
      setShowReauth(false);
      setReauthCode("");
      toast.success("เข้าใช้งานสำเร็จ กำลังอัปโหลดไฟล์ต่อ...");
      if (pendingFiles?.length) {
        const next = pendingFiles;
        setPendingFiles(null);
        void upload(next);
      }
    } else {
      toast.error("รหัสผ่านไม่ถูกต้อง");
    }
  };

  const remove = async (item: JobAttachment) => {
    if (!onChange) return;
    setBusy(true);
    // Removing a reference is available to job operators; physical deletion is admin-only.
    setBusy(false);
    onChange(serializeAttachments(items.filter((i) => i.path !== item.path)));
    toast.success("ลบไฟล์แนบแล้ว");
  };

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => upload(e.target.files)}
          />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Paperclip className="mr-1 h-4 w-4" />}
            แนบรูป / คลิปวิดีโอ
          </Button>
          <span className="text-xs text-muted-foreground">ไฟล์ละไม่เกิน 50MB</span>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{readOnly ? "ไม่มีไฟล์แนบ" : "ยังไม่มีไฟล์แนบ"}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((item) => (
            <div key={item.path} className="relative overflow-hidden rounded-lg border bg-muted/30">
              <a href={item.url} target="_blank" rel="noreferrer" className="block">
                {item.kind === "image" ? (
                  <img src={item.url} alt={item.name} className="h-28 w-full object-cover" loading="lazy" />
                ) : (
                  <video src={item.url} className="h-28 w-full object-cover" muted playsInline preload="metadata" />
                )}
              </a>
              <div className="flex items-center gap-1 px-2 py-1 text-[11px]">
                {item.kind === "image" ? <ImageIcon className="h-3 w-3 shrink-0" /> : <Film className="h-3 w-3 shrink-0" />}
                <span className="truncate" title={item.name}>{item.name}</span>
              </div>
              {!readOnly && (
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="absolute right-1 top-1 h-7 w-7"
                  disabled={busy}
                  onClick={() => remove(item)}
                  aria-label={`ลบ ${item.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* กล่องข้อความกรอกรหัสผ่านในกรณีเซสชันหมดอายุ โดยคงข้อมูลในฟอร์มไว้ครบถ้วน */}
      <Dialog open={showReauth} onOpenChange={(open) => !open && setShowReauth(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              กรุณาเข้าใช้งานอีกครั้ง
            </DialogTitle>
            <DialogDescription>
              เซสชันการเข้าใช้งานหมดอายุ กรุณากรอกรหัสผ่านเพื่อดำเนินการแนบไฟล์ต่อ ข้อมูลฟอร์มที่กรอกไว้จะไม่สูญหาย
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              {...PASSCODE_INPUT}
              autoFocus
              value={reauthCode}
              onChange={(e) => setReauthCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitReauth()}
              placeholder="รหัสผ่านเข้าใช้งาน (ค่าเริ่มต้น 5555)"
              className="h-11 text-center text-lg tracking-widest"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setShowReauth(false)} disabled={reauthBusy}>
              ยกเลิก
            </Button>
            <Button type="button" onClick={submitReauth} disabled={reauthBusy}>
              {reauthBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              ยืนยันรหัสผ่าน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

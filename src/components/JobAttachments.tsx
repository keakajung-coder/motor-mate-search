import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Film, ImageIcon, Loader2, Paperclip, Trash2 } from "lucide-react";

export type JobAttachment = { path: string; url: string; name: string; kind: "image" | "video" };

const BUCKET = "job-attachments";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

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
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length || !onChange) return;
    setBusy(true);
    const added: JobAttachment[] = [];
    const { compressImage } = await import("@/lib/image-compress");
    for (const original of Array.from(files)) {
      const isVideo = original.type.startsWith("video/");
      if (!isVideo && !original.type.startsWith("image/")) {
        toast.error(`${original.name}: รองรับเฉพาะรูปภาพและวิดีโอ`);
        continue;
      }
      const file = isVideo ? original : await compressImage(original, { maxSize: 1920, quality: 0.8 });
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name}: ไฟล์ใหญ่เกิน 50MB`);
        continue;
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
      const path = `jobs/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (error) {
        toast.error(`${file.name}: ${error.message}`);
        continue;
      }
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, TEN_YEARS);
      added.push({ path, url: data?.signedUrl ?? "", name: file.name, kind: isVideo ? "video" : "image" });
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (added.length) {
      onChange(serializeAttachments([...items, ...added]));
      toast.success(`แนบไฟล์แล้ว ${added.length} รายการ`);
    }
  };

  const remove = async (item: JobAttachment) => {
    if (!onChange) return;
    setBusy(true);
    await supabase.storage.from(BUCKET).remove([item.path]);
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
    </div>
  );
}

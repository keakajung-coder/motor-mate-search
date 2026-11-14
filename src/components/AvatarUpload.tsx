import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/data-client";
import { uploadEmployeePhoto } from "@/lib/employee-create";
import { cn } from "@/lib/utils";

/** Click-to-change profile photo for a staff/contact row; admin writes go through the session gateway. */
export function AvatarUpload({ table, id, name, url, editable, onSaved, className }: { table: "service_staff" | "sales_contacts"; id: string; name: string; url: string | null; editable: boolean; onSaved?: (url: string) => void; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const next = await uploadEmployeePhoto(file);
      const { error } = await supabase.from(table).update({ avatar_url: next }).eq("id", id);
      if (error) throw new Error(error.message);
      onSaved?.(next);
      void queryClient.invalidateQueries({ queryKey: ["employee-selection"] });
      window.dispatchEvent(new Event("employee-photo-changed"));
      toast.success("อัปเดตรูปโปรไฟล์แล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const face = <Avatar className={cn("h-10 w-10 rounded-md", className)}>
    {url && <AvatarImage src={url} alt={name} className="object-cover" />}
    <AvatarFallback className="rounded-md bg-muted text-sm font-medium">{name.trim().slice(0, 2)}</AvatarFallback>
  </Avatar>;
  if (!editable) return face;
  return <button type="button" title="เปลี่ยนรูปโปรไฟล์" aria-label={`เปลี่ยนรูปโปรไฟล์ ${name}`} disabled={busy} onClick={() => input.current?.click()} className="relative shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    {face}
    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-foreground">{busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}</span>
    <input ref={input} type="file" accept="image/*" className="hidden" onChange={e => void pick(e.target.files?.[0])} />
  </button>;
}

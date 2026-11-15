import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/lib/user-role";
import { currentProfile, saveOwnPhoto } from "@/lib/profile.functions";
import { profilePhotoBase64 } from "@/lib/profile-photo";
import { updateEngineer } from "@/lib/engineers";
import { announceProfileChange } from "@/lib/data-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/data-client";
import { uploadEmployeePhoto } from "@/lib/employee-create";
import { cn } from "@/lib/utils";

/** Click-to-change profile photo for a staff/contact row; admin writes go through the session gateway. */
export function AvatarUpload({ table, id, name, url, editable, onSaved, className }: { table: "service_staff" | "sales_contacts" | "engineers"; id: string; name: string; url: string | null; editable: boolean; onSaved?: (url: string) => void; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const { role, userName } = useUserRole();
  const { data: me } = useQuery({ queryKey: ["current-profile", role, userName], queryFn: () => currentProfile(), enabled: !!role, retry: false });
  const prefix = table === "service_staff" ? "service" : table === "sales_contacts" ? "sales" : "project";
  const own = me?.id === `${prefix}:${id}`;
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      let next: string;
      if (!editable && own) {
        next = (await saveOwnPhoto({ data: { base64: await profilePhotoBase64(file) } })).avatar;
      } else if (editable) {
        next = await uploadEmployeePhoto(file);
        if (table === "engineers") {
          const result = await updateEngineer(id, { avatar_url: next });
          if (!result.success) throw new Error(result.error);
        } else {
          const { error } = await supabase.from(table).update({ avatar_url: next }).eq("id", id);
          if (error) throw new Error(error.message);
        }
      } else throw new Error("เปลี่ยนได้เฉพาะรูปของตัวเอง");
      onSaved?.(next);
      void queryClient.invalidateQueries({ queryKey: ["employee-selection"] });
      announceProfileChange();
      toast.success("อัปเดตรูปโปรไฟล์แล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const face = <Avatar className={cn("h-16 w-16 shrink-0 rounded-full border-2 border-background shadow-sm ring-1 ring-border", className)}>
    {url && <AvatarImage src={url} alt={name} className="object-cover" />}
    <AvatarFallback className="rounded-full bg-muted text-lg font-medium">{name.trim().slice(0, 2)}</AvatarFallback>
  </Avatar>;
  if (!editable && !own) return face;
  return <Button type="button" variant="ghost" title="เปลี่ยนรูปโปรไฟล์" aria-label={`เปลี่ยนรูปโปรไฟล์ ${name}`} disabled={busy} onClick={() => input.current?.click()} className="relative h-16 w-16 shrink-0 rounded-full p-0">
    {face}
    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-foreground">{busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}</span>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onClick={event => event.stopPropagation()} onChange={e => void pick(e.target.files?.[0])} />
  </Button>;
}

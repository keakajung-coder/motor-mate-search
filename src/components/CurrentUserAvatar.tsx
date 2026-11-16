import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useUserRole } from "@/lib/user-role";
import { useAccess } from "@/lib/access";
import { employeeQuery } from "@/components/RoleSelectionModal";
import { currentProfile, saveOwnPhoto, selectProfile } from "@/lib/profile.functions";
import { profilePhotoBase64 } from "@/lib/profile-photo";
import { announceProfileChange } from "@/lib/data-client";

/** Shows the currently selected user's profile photo in the app header. */
export function CurrentUserAvatar() {
  const { userName, role, openRoleSwitcher } = useUserRole();
  const { isAdmin } = useAccess();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { data: roster } = useQuery({ ...employeeQuery, enabled: !!userName, retry: false });
  const { data: me } = useQuery({ queryKey: ["current-profile", role, userName], queryFn: async () => {
    const profile = await currentProfile();
    if (!profile && role && !userName) { await selectProfile({ data: { id: null } }); return currentProfile(); }
    return profile;
  }, enabled: !!role, retry: false });
  useEffect(() => {
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["current-profile"] }); void queryClient.invalidateQueries({ queryKey: ["employee-selection"] }); };
    window.addEventListener("app:data-changed", refresh);
    window.addEventListener("app:user-role-changed", refresh);
    return () => { window.removeEventListener("app:data-changed", refresh); window.removeEventListener("app:user-role-changed", refresh); };
  }, [queryClient]);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const person = roster?.find(e => e.id === me?.id);
  const name = person?.name || me?.name || userName || (isAdmin ? "ผู้ดูแลระบบ" : "ผู้ใช้ทั่วไป");
  const avatar = person?.avatar || me?.avatar;
  const save = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const saved = await saveOwnPhoto({ data: { base64: await profilePhotoBase64(file) } });
      queryClient.setQueryData(["current-profile", role, userName], saved);
      queryClient.setQueryData<typeof roster>(employeeQuery.queryKey, rows => rows?.map(row => row.id === saved.id ? { ...row, avatar: saved.avatar } : row));
      announceProfileChange();
      toast.success("บันทึกรูปโปรไฟล์แล้ว"); setOpen(false); setFile(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setBusy(false); }
  };
  if (!role) return null;
  return <>
    <div className="flex min-w-0 shrink-0 items-center gap-2" title={name}>
      <Button type="button" variant="ghost" size="icon" className="relative h-12 w-12 shrink-0 rounded-full p-0" aria-label="เปลี่ยนรูปโปรไฟล์ของฉัน" title="เปลี่ยนรูปโปรไฟล์ของฉัน" onClick={() => { if (!me) { toast.info("กรุณาเลือกผู้ใช้งานอีกครั้งก่อนเปลี่ยนรูป"); openRoleSwitcher(); } else { setFile(null); setOpen(true); } }}>
        <Avatar className="h-12 w-12 rounded-full border-2 border-background shadow-sm ring-1 ring-border">
          {avatar && <AvatarImage src={avatar} alt={name} className="object-cover" />}
          <AvatarFallback className="bg-muted text-sm font-medium">{name.trim().slice(0, 2)}</AvatarFallback>
        </Avatar>
        <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border bg-background"><Camera className="h-3 w-3" /></span>
      </Button>
      <span className="hidden max-w-32 truncate whitespace-nowrap text-sm font-medium xl:inline">{name}</span>
    </div>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent data-no-voice="true">
        <DialogHeader><DialogTitle>เปลี่ยนรูปโปรไฟล์ของฉัน</DialogTitle><DialogDescription>{name}</DialogDescription></DialogHeader>
        <div className="flex flex-col items-center gap-5 py-4">
          <Avatar className="h-32 w-32 rounded-full border-2 border-background shadow-sm ring-1 ring-border"><AvatarImage src={preview || avatar} alt={name} className="object-cover" /><AvatarFallback>{name.slice(0, 2)}</AvatarFallback></Avatar>
          <Input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="เลือกรูปโปรไฟล์ของฉัน" className="hidden" disabled={busy} onChange={event => setFile(event.target.files?.[0] ?? null)} />
          <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}><Camera className="mr-2 h-4 w-4" />เลือกรูปภาพ</Button>
        </div>
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>ยกเลิก</Button><Button type="button" disabled={!file || busy} onClick={() => void save()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? "กำลังบันทึก…" : "บันทึกรูป"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

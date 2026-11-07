import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAccess } from "@/lib/access";
import { createEmployee, uploadEmployeePhoto } from "@/lib/employee-create";
import type { Employee } from "@/lib/employee-selection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeyRound, Loader2, Plus, ShieldCheck, Upload, UserRound } from "lucide-react";
import { toast } from "sonner";

export function EmployeeAdminAuth() {
  const { isAdmin, unlockAdmin, lockAdmin } = useAccess();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy || !code.trim()) return;
    setBusy(true);
    try {
      if (await unlockAdmin(code.trim())) { setOpen(false); toast.success("ยืนยันแอดมินแล้ว"); }
      else toast.error("รหัสแอดมินไม่ถูกต้องหรือเชื่อมต่อไม่สำเร็จ");
    } finally { setCode(""); setBusy(false); }
  };
  return <>
    <Button variant="outline" size="sm" onClick={() => isAdmin ? lockAdmin() : setOpen(true)}>{isAdmin ? <ShieldCheck className="mr-2 h-4 w-4" /> : <KeyRound className="mr-2 h-4 w-4" />}{isAdmin ? "ออกจากโหมดแอดมิน" : "ยืนยันแอดมิน"}</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) { setOpen(value); setCode(""); } }}>
      <DialogContent className="z-[100002]" data-no-voice="true"><DialogHeader><DialogTitle>ยืนยันสิทธิ์แอดมิน</DialogTitle><DialogDescription>กรอกรหัสแอดมินเดิม</DialogDescription></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); void submit(); }} className="space-y-4"><Input aria-label="รหัสแอดมิน" type="password" inputMode="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="current-password" value={code} onChange={e => setCode(e.target.value)} autoFocus disabled={busy} /><DialogFooter><Button type="submit" disabled={busy || !code.trim()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}ยืนยันแอดมิน</Button></DialogFooter></form>
      </DialogContent>
    </Dialog>
  </>;
}

export function AddEmployeeButton({ department, onCreated }: { department: Employee["department"]; onCreated: (employee: Employee) => void }) {
  const { isAdmin } = useAccess();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [selectedDepartment, setDepartment] = useState(department);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const uploaded = useRef<{ file: File; url: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!photo) { setPreview(""); return; } const url = URL.createObjectURL(photo); setPreview(url); return () => URL.revokeObjectURL(url); }, [photo]);
  const save = useMutation({
    mutationFn: async () => {
      if (!isAdmin) throw new Error("กรุณายืนยันแอดมินก่อน");
      let avatar = "";
      if (photo) {
        if (uploaded.current?.file !== photo) uploaded.current = { file: photo, url: await uploadEmployeePhoto(photo) };
        avatar = uploaded.current?.url ?? "";
      }
      return createEmployee({ name, phone, position: position || (selectedDepartment === "sales" ? "ฝ่ายขาย / เซลล์" : selectedDepartment === "service" ? "ช่างบริการ" : "วิศวกร / โปรเจกต์"), department: selectedDepartment, avatar });
    },
    onSuccess: employee => { onCreated(employee); setOpen(false); toast.success(`เพิ่ม ${employee.name} แล้ว`); },
    onError: reason => setError(reason.message),
  });
  if (!isAdmin) return null;
  return <>
    <Button onClick={() => { setName(""); setPhone(""); setPosition(""); setDepartment(department); setPhoto(null); uploaded.current = null; setError(""); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />เพิ่มพนักงานใหม่</Button>
    <Dialog open={open} onOpenChange={value => { if (!save.isPending) setOpen(value); }}>
      <DialogContent className="z-[100002] max-h-[90dvh] overflow-y-auto" data-no-voice="true"><DialogHeader><DialogTitle>เพิ่มพนักงานใหม่</DialogTitle><DialogDescription>ข้อมูลพนักงานและรูปโปรไฟล์</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); setError(""); save.mutate(); }}>
          <div className="flex flex-wrap items-center gap-4"><div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">{preview ? <img src={preview} alt="รูปโปรไฟล์ที่เลือก" className="h-full w-full object-cover" /> : <UserRound className="h-10 w-10 text-muted-foreground" />}</div><Input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="รูปโปรไฟล์" onChange={e => { const file = e.target.files?.[0]; if (file) { setPhoto(file); setError(""); } }} disabled={save.isPending} /><Button type="button" variant="outline" disabled={save.isPending} onClick={() => input.current?.click()}><Upload className="mr-2 h-4 w-4" />เลือกรูปโปรไฟล์</Button></div>
          <div className="space-y-2"><Label htmlFor="employee-name">ชื่อ-นามสกุล</Label><Input id="employee-name" required maxLength={200} value={name} onChange={e => setName(e.target.value)} disabled={save.isPending} /></div>
          <div className="space-y-2"><Label htmlFor="employee-phone">เบอร์โทรศัพท์</Label><Input id="employee-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} disabled={save.isPending} /></div>
          <div className="space-y-2"><Label>ฝ่าย</Label><Select value={selectedDepartment} onValueChange={value => { if (value === "sales" || value === "service" || value === "project") setDepartment(value); }} disabled={save.isPending}><SelectTrigger aria-label="ฝ่ายพนักงาน"><SelectValue /></SelectTrigger><SelectContent className="z-[100003]"><SelectItem value="sales">ฝ่ายขาย</SelectItem><SelectItem value="service">ฝ่ายบริการ / ช่าง</SelectItem><SelectItem value="project">โปรเจกต์</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="employee-position">ตำแหน่งงาน</Label><Input id="employee-position" value={position} onChange={e => setPosition(e.target.value)} disabled={save.isPending} /></div>
          {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setOpen(false)}>ยกเลิก</Button><Button type="submit" disabled={save.isPending || !name.trim()}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{save.isPending ? "กำลังบันทึก…" : "บันทึกพนักงาน"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
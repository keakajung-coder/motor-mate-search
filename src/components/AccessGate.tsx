import { useState } from "react";
import { useAccess } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KeyRound, Loader2, Lock, LockOpen, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

/** หน้าจอบังคับกรอกรหัสเข้าดู (ชั้นที่ 1) */
export function AccessGate({ children }: { children: React.ReactNode }) {
  const { ready, viewerOk, unlockViewer } = useAccess();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (viewerOk) return <>{children}</>;

  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true);
    const ok = await unlockViewer(code.trim());
    setBusy(false);
    if (!ok) {
      toast.error("รหัสผ่านไม่ถูกต้อง");
      setCode("");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>กรอกรหัสเข้าใช้งาน</CardTitle>
          <p className="text-sm text-muted-foreground">ระบบค้นหาอะไหล่ปั๊มลม (ใช้ภายในองค์กร)</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="รหัสผ่าน"
            className="h-12 text-center text-lg tracking-widest"
          />
          <Button className="h-11 w-full" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <LockOpen className="mr-1 h-4 w-4" />}
            เข้าใช้งาน
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            ติดต่อผู้ดูแลระบบหากไม่ทราบรหัสผ่าน
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** ปุ่มกุญแจสำหรับปลดล็อกโหมดแอดมิน (ชั้นที่ 2) */
export function AdminLockButton() {
  const { isAdmin, unlockAdmin, lockAdmin } = useAccess();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const ok = await unlockAdmin(code.trim());
    setBusy(false);
    if (ok) {
      toast.success("ปลดล็อกโหมดแอดมินแล้ว");
      setOpen(false);
      setCode("");
    } else {
      toast.error("รหัสแอดมินไม่ถูกต้อง");
      setCode("");
    }
  };

  if (isAdmin) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-primary"
        onClick={() => {
          lockAdmin();
          toast.message("ออกจากโหมดแอดมินแล้ว");
        }}
        title="ออกจากโหมดแอดมิน"
      >
        <ShieldCheck className="mr-1 h-4 w-4" /> แอดมิน
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="โหมดแอดมิน"
        title="โหมดแอดมิน"
        onClick={() => setOpen(true)}
      >
        <KeyRound className="h-4 w-4 text-muted-foreground" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> โหมดผู้ดูแลระบบ
            </DialogTitle>
            <DialogDescription>กรอกรหัสแอดมินเพื่อปลดล็อกการเพิ่ม/แก้ไข/ลบข้อมูล</DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="รหัสแอดมิน"
            className="h-12 text-center text-lg tracking-widest"
          />
          <DialogFooter>
            <Button className="w-full" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} ปลดล็อก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** ล็อกเนื้อหาไว้เฉพาะแอดมิน */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAccess();
  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Lock className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            ส่วนนี้สำหรับผู้ดูแลระบบ กดไอคอนกุญแจมุมขวาบนเพื่อปลดล็อก
          </p>
          <AdminLockButton />
        </CardContent>
      </Card>
    );
  }
  return <>{children}</>;
}

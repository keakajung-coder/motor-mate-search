import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { updatePasscodes } from "@/lib/passcode.functions";
import { setStoredAdminCode, storedAdminCode } from "@/lib/access";

export function PasscodeSettings() {
  const [current, setCurrent] = useState(storedAdminCode());
  const [viewer, setViewer] = useState("");
  const [admin, setAdmin] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const res = await updatePasscodes({
        data: { currentAdminCode: current.trim(), viewerCode: viewer.trim(), adminCode: admin.trim() },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.changedAdmin && admin.trim()) setStoredAdminCode(admin.trim());
      toast.success("บันทึกรหัสผ่านใหม่แล้ว");
      setViewer("");
      setAdmin("");
      setCurrent(storedAdminCode());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" /> ตั้งค่ารหัสผ่านระบบ
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>รหัสแอดมินปัจจุบัน (ยืนยันตัวตน)</Label>
          <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>รหัสเข้าดูใหม่ (Viewer)</Label>
            <Input
              type="password"
              value={viewer}
              onChange={(e) => setViewer(e.target.value)}
              placeholder="เว้นว่าง = ไม่เปลี่ยน"
            />
            <p className="text-xs text-muted-foreground">ใช้สำหรับพนักงาน/ลูกค้าที่สแกน QR เข้ามา</p>
          </div>
          <div className="space-y-1">
            <Label>รหัสแอดมินใหม่</Label>
            <Input
              type="password"
              value={admin}
              onChange={(e) => setAdmin(e.target.value)}
              placeholder="เว้นว่าง = ไม่เปลี่ยน"
            />
            <p className="text-xs text-muted-foreground">ใช้ปลดล็อกโหมดแก้ไขข้อมูลและอนุมัติงาน</p>
          </div>
        </div>
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} บันทึกรหัสผ่าน
        </Button>
        <p className="text-xs text-muted-foreground">
          เมื่อเปลี่ยนรหัสเข้าดู ผู้ที่เคยเข้าใช้งานด้วยรหัสเดิมจะถูกตัดสิทธิ์ทันที
        </p>
      </CardContent>
    </Card>
  );
}

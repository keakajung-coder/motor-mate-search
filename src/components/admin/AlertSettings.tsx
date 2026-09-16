import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BellRing, Loader2, SendHorizontal } from "lucide-react";
import { storedAdminCode } from "@/lib/access";
import { getAlertSettings, saveAlertSettings, testAdminAlert } from "@/lib/notify.functions";

/** ตั้งค่าแจ้งเตือนหลายช่องทาง (ในแอป / Line Messaging API / อีเมล) */
export function AlertSettings() {
  const [token, setToken] = useState("");
  const [tokenInfo, setTokenInfo] = useState("");
  const [targets, setTargets] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await getAlertSettings({ data: { code: storedAdminCode() } });
      if (res.ok) {
        setTokenInfo(res.hasToken ? `บันทึกไว้แล้ว (${res.tokenPreview})` : "ยังไม่ได้ตั้งค่า");
        setTargets(res.targets);
        setEmail(res.email);
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const res = await saveAlertSettings({
        data: { code: storedAdminCode(), token: token.trim(), targets, email },
      });
      if (!res.ok) return toast.error(res.error);
      if (token.trim()) setTokenInfo("บันทึกไว้แล้ว");
      setToken("");
      toast.success("บันทึกการตั้งค่าแจ้งเตือนแล้ว");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const res = await testAdminAlert({ data: { code: storedAdminCode() } });
      if (!res.ok) return toast.error(res.error);
      toast.success(`ส่งข้อความทดสอบแล้ว ${res.sent} ปลายทาง`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-4 w-4" /> การแจ้งเตือนแอดมิน (ในแอป / Line / อีเมล)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Channel Access Token (Line Official Account)</Label>
              <Input
                type="password"
                placeholder="วางโทเคนใหม่เพื่อเปลี่ยน"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">สถานะปัจจุบัน: {tokenInfo}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">User ID / Group ID ของแอดมิน (บรรทัดละ 1 รายการ)</Label>
              <Textarea rows={4} value={targets} onChange={(e) => setTargets(e.target.value)} placeholder="Uxxxxxxxx&#10;Cxxxxxxxx" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">อีเมลแอดมิน (คั่นด้วย , ได้)</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={busy}>
                บันทึกการตั้งค่า
              </Button>
              <Button variant="outline" onClick={test} disabled={busy}>
                <SendHorizontal className="mr-1 h-4 w-4" /> ส่งข้อความทดสอบเข้า Line
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

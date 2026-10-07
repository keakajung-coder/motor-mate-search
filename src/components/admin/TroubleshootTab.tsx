import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deleteAsAdmin, storedAdminCode } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { ConfirmButton } from "@/components/ConfirmButton";
import { toast } from "sonner";
import { Bot, Check, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { useIssues, type Issue } from "@/components/TroubleshootPanel";
import { draftTroubleshooting } from "@/lib/troubleshoot.functions";
import { loadAutoIssueAlert, saveAutoIssueAlert, sendIssueApprovalAlert } from "@/lib/issue-alerts";

/** แผงควบคุมคลังความรู้อาการเสีย + ให้ AI ร่างคำตอบรอแอดมินอนุมัติ */
export function TroubleshootTab() {
  const { issues, loading, reload } = useIssues("all");
  const [newTitle, setNewTitle] = useState("");
  const [autoAlert, setAutoAlert] = useState(true);
  useEffect(() => void loadAutoIssueAlert().then(setAutoAlert), []);

  const pending = issues.filter((i) => i.status !== "published");
  const published = issues.filter((i) => i.status === "published");

  const addIssue = async () => {
    const title = newTitle.trim();
    if (!title) return toast.error("กรุณากรอกชื่ออาการ");
    const { error } = await supabase.from("troubleshooting_issues").insert({ title, status: "pending" });
    if (error) return toast.error(error.message);
    setNewTitle("");
    toast.success("เพิ่มอาการใหม่แล้ว");
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border p-3 text-sm">
        <Switch
          id="auto-issue-alert"
          checked={autoAlert}
          onCheckedChange={(v) => {
            setAutoAlert(v);
            void saveAutoIssueAlert(v);
          }}
        />
        <Label htmlFor="auto-issue-alert">ส่ง LINE ให้ช่างอัตโนมัติเมื่อกดอนุมัติปัญหา</Label>
      </div>
      <CollapsibleSection title="➕ เพิ่มอาการเสียใหม่" subtitle="พิมพ์อาการ แล้วให้ AI ช่วยร่างคำตอบ">
        <div className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            className="min-w-0"
            placeholder="เช่น ปั๊มลมมีเสียงดังผิดปกติ"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Button onClick={addIssue}>
            <Plus className="mr-1 h-4 w-4" /> เพิ่ม
          </Button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={`🕓 อาการรออนุมัติ (${pending.length})`}
        subtitle="ปัญหาใหม่ที่ช่างส่งเข้ามา — ให้ AI ร่างคำตอบ ตรวจแล้วกดอนุมัติ"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {!loading && pending.length === 0 && <p className="text-sm text-muted-foreground">ไม่มีรายการรออนุมัติ</p>}
        {pending.map((i) => (
          <IssueEditor key={i.id} issue={i} onSaved={reload} />
        ))}
      </CollapsibleSection>

      <CollapsibleSection
        title={`📚 คลังความรู้ที่เผยแพร่แล้ว (${published.length})`}
        subtitle="ช่างค้นหาเจอที่หน้าแรก"
      >
        {published.map((i) => (
          <IssueEditor key={i.id} issue={i} onSaved={reload} />
        ))}
      </CollapsibleSection>
    </div>
  );
}

function IssueEditor({ issue, onSaved }: { issue: Issue; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: issue.title,
    keywords: issue.keywords ?? "",
    causes: issue.causes ?? "",
    check_steps: issue.check_steps ?? "",
    fix_steps: issue.fix_steps ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const runAi = async () => {
    setDrafting(true);
    try {
      const res = await draftTroubleshooting({
        data: { title: form.title, adminCode: storedAdminCode() },
      });
      if (!res.ok) return toast.error(res.error);
      setForm((f) => ({
        ...f,
        causes: res.causes || f.causes,
        check_steps: res.check_steps || f.check_steps,
        fix_steps: res.fix_steps || f.fix_steps,
      }));
      await supabase
        .from("troubleshooting_issues")
        .update({ ai_check_draft: res.check_steps, ai_fix_draft: res.fix_steps })
        .eq("id", issue.id);
      toast.success("AI ร่างคำตอบให้แล้ว กรุณาตรวจสอบก่อนอนุมัติ");
    } finally {
      setDrafting(false);
    }
  };

  const save = async (publish: boolean) => {
    setBusy(true);
    const { error } = await supabase
      .from("troubleshooting_issues")
      .update({
        title: form.title.trim(),
        keywords: form.keywords.trim() || null,
        causes: form.causes.trim() || null,
        check_steps: form.check_steps.trim() || null,
        fix_steps: form.fix_steps.trim() || null,
        status: publish ? "published" : issue.status,
        answered_at: publish ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", issue.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(publish ? "อนุมัติและบันทึกเข้าคลังแล้ว" : "บันทึกร่างแล้ว");
    if (publish && (await loadAutoIssueAlert())) {
      const sent = await sendIssueApprovalAlert(form);
      if (sent > 0) toast.success(`ส่งแจ้งเตือน LINE ให้ช่างแล้ว (${sent} ราย)`);
    }
    onSaved();
  };

  const shareNow = async () => {
    const sent = await sendIssueApprovalAlert(form);
    toast[sent > 0 ? "success" : "error"](sent > 0 ? `ส่งเข้า LINE แล้ว (${sent} ราย)` : "ยังส่งไม่ได้ — ยังไม่มีช่างที่ผูก LINE หรือยังไม่ได้ตั้งค่า LINE");
  };

  const remove = async () => {
    const { error } = await deleteAsAdmin("troubleshooting_issues", { id: issue.id });
    if (error) return toast.error(error.message);
    toast.success("ลบแล้ว");
    onSaved();
  };

  return (
    <div className="space-y-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={issue.status === "published" ? "default" : "secondary"}>
          {issue.status === "published" ? "เผยแพร่แล้ว" : "รออนุมัติ"}
        </Badge>
        <Input className="min-w-0 flex-1" value={form.title} onChange={(e) => set("title", e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">คำค้นหา (คั่นด้วย , )</Label>
        <Input value={form.keywords} onChange={(e) => set("keywords", e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">สาเหตุ</Label>
        <Input value={form.causes} onChange={(e) => set("causes", e.target.value)} />
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">วิธีการตรวจสอบ (AI Draft — แก้ไขได้)</Label>
          <Textarea rows={8} value={form.check_steps} onChange={(e) => set("check_steps", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">วิธีการแก้ไข (AI Draft — แก้ไขได้)</Label>
          <Textarea rows={8} value={form.fix_steps} onChange={(e) => set("fix_steps", e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={runAi} disabled={drafting}>
          {drafting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Bot className="mr-1 h-4 w-4" />}
          ให้ AI ร่างคำตอบ
        </Button>
        <Button variant="secondary" onClick={() => save(false)} disabled={busy}>
          ✏️ บันทึกร่าง
        </Button>
        <Button onClick={() => save(true)} disabled={busy}>
          <Check className="mr-1 h-4 w-4" /> อนุมัติและบันทึกเข้าคลัง
        </Button>
        <Button variant="outline" onClick={shareNow}>
          <Send className="mr-1 h-4 w-4" /> ส่งแจ้งเตือนผ่าน LINE
        </Button>
        <ConfirmButton onConfirm={remove} variant="outline">
          <Trash2 className="mr-1 h-4 w-4" /> ลบ
        </ConfirmButton>
      </div>
    </div>
  );
}

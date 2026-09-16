import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { Search, Stethoscope, Wrench, SendHorizontal, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { notifyAdminQueue } from "@/lib/prefs";
import { rememberMyIssue } from "@/lib/issue-watch";
import { notifyAdmins } from "@/lib/notify";

export type Issue = {
  id: string;
  title: string;
  keywords: string | null;
  causes: string | null;
  check_steps: string | null;
  fix_steps: string | null;
  status: string;
};

export function useIssues(status: "published" | "all" = "published") {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("troubleshooting_issues")
      .select("id,title,keywords,causes,check_steps,fix_steps,status")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (status === "published") q = q.eq("status", "published");
    const { data } = await q;
    setIssues((data as Issue[]) ?? []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, [status]);
  return { issues, loading, reload: load };
}

function StepList({ text }: { text: string | null }) {
  const lines = (text ?? "").split("\n").filter((l) => l.trim());
  if (lines.length === 0) return <p className="text-sm text-muted-foreground">-</p>;
  return (
    <ul className="space-y-1 text-sm leading-relaxed">
      {lines.map((l, i) => (
        <li key={i} className="whitespace-pre-wrap">
          {l}
        </li>
      ))}
    </ul>
  );
}

/** แผงค้นหาอาการเสีย + คำตอบ 2 กล่อง (วิธีตรวจสอบ / วิธีแก้ไข) */
export function TroubleshootPanel() {
  const { issues, loading, reload } = useIssues("published");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Issue | null>(null);
  const [sending, setSending] = useState(false);

  const kw = q.trim().toLowerCase();
  const matched = useMemo(() => {
    if (!kw) return [];
    return issues.filter((i) => `${i.title} ${i.keywords ?? ""} ${i.causes ?? ""}`.toLowerCase().includes(kw));
  }, [issues, kw]);

  useEffect(() => {
    if (kw && matched.length > 0) setSelected(matched[0]);
    if (!kw) setSelected(null);
  }, [kw, matched]);

  const askAdmin = async () => {
    const title = q.trim();
    if (!title) return;
    setSending(true);
    const { data, error } = await supabase
      .from("troubleshooting_issues")
      .insert({ title, status: "pending" })
      .select("id")
      .single();
    setSending(false);
    if (error) return toast.error("ส่งไม่สำเร็จ: " + error.message);
    if (data?.id) rememberMyIssue(data.id);
    notifyAdminQueue();
    void notifyAdmins({
      kind: "issue",
      title: `แจ้งปัญหาเครื่องใหม่: ${title}`,
      body: "ผู้ใช้ส่งอาการเข้ามาในคลังความรู้ รอแอดมินตรวจและอนุมัติคำตอบ",
      link: "/admin",
      dedupeKey: data?.id ? `issue:${data.id}` : undefined,
    });
    toast.success("ส่งอาการนี้ให้แอดมินแล้ว ระบบจะให้ AI ช่วยร่างคำตอบรออนุมัติ");
    setQ("");
    reload();
  };

  return (
    <CollapsibleSection
      title="🔧 ค้นหาอาการหรือปัญหาเครื่อง"
      subtitle="พิมพ์อาการเสีย แล้วดูวิธีตรวจสอบและวิธีแก้ไขได้ทันที"
      defaultOpen
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-12 pl-9"
          placeholder="เช่น เครื่องไม่ทำงาน, ลมไม่ขึ้น, ร้อนจัด, มีกลิ่นเหม็น"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {issues.map((i) => (
          <Button
            key={i.id}
            size="sm"
            variant={selected?.id === i.id ? "default" : "outline"}
            onClick={() => {
              setSelected(i);
              setQ(i.title);
            }}
          >
            {i.title}
          </Button>
        ))}
      </div>

      {kw && matched.length === 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3 text-sm">
          <span className="text-muted-foreground">ยังไม่มีคำตอบของอาการนี้ในคลังความรู้</span>
          <Button size="sm" onClick={askAdmin} disabled={sending}>
            {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <SendHorizontal className="mr-1 h-4 w-4" />}
            ส่งต่อให้แอดมิน (AI ช่วยร่างคำตอบ)
          </Button>
        </div>
      )}

      {selected && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="text-sm">{selected.title}</Badge>
            {selected.causes && <span className="text-xs text-muted-foreground">สาเหตุ: {selected.causes}</span>}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border bg-muted/40 p-3">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Stethoscope className="h-4 w-4 text-primary" /> วิธีการตรวจสอบ
              </h4>
              <StepList text={selected.check_steps} />
            </div>
            <div className="rounded-xl border bg-primary/5 p-3">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Wrench className="h-4 w-4 text-primary" /> วิธีการแก้ไข
              </h4>
              <StepList text={selected.fix_steps} />
            </div>
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}

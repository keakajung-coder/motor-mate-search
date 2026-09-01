import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyUserReply } from "@/lib/prefs";

const KEY = "my_submitted_issues";

function readIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** จำอาการที่ผู้ใช้เครื่องนี้ส่งเข้าคิวแอดมิน เพื่อรอแจ้งเตือนกลับ */
export function rememberMyIssue(id: string) {
  if (typeof window === "undefined" || !id) return;
  const ids = readIds();
  if (!ids.includes(id)) localStorage.setItem(KEY, JSON.stringify([...ids, id].slice(-50)));
}

export function forgetMyIssue(id: string) {
  localStorage.setItem(KEY, JSON.stringify(readIds().filter((x) => x !== id)));
}

/** เฝ้าดูว่าแอดมินตอบอาการที่เราส่งไปหรือยัง แล้วแจ้งเตือนด้วยเสียง+สั่น */
export function useMyIssueReplies(onReplied?: (id: string) => void) {
  useEffect(() => {
    const ids = readIds();
    if (ids.length === 0) return;

    const announce = (row: any) => {
      if (!ids.includes(row.id) || row.status !== "published") return;
      notifyUserReply();
      toast.success(`แอดมินตอบอาการ "${row.title}" แล้ว — เปิดดูวิธีแก้ไขได้เลย`, { duration: 8000 });
      forgetMyIssue(row.id);
      onReplied?.(row.id);
    };

    // ตรวจย้อนหลังเผื่อแอดมินตอบตอนที่ปิดแอปอยู่
    void supabase
      .from("troubleshooting_issues")
      .select("id, title, status")
      .in("id", ids)
      .eq("status", "published")
      .then(({ data }) => (data ?? []).forEach(announce));

    const ch = supabase
      .channel("my_issue_replies")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "troubleshooting_issues" },
        (payload) => announce(payload.new),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [onReplied]);
}

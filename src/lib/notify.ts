import { supabase } from "@/integrations/supabase/client";
import { sendAdminAlert } from "@/lib/notify.functions";

export type NotifyKind = "work_order" | "issue" | "part_due";

export const NOTIFY_KIND_TH: Record<string, string> = {
  work_order: "ใบสั่งงานใหม่",
  issue: "แจ้งปัญหาเครื่อง",
  part_due: "อะไหล่ครบกำหนด",
};

/**
 * แจ้งเตือนแอดมินทุกช่องทาง: ในแอป (ตาราง notifications) + Line
 * dedupeKey ใช้กันการแจ้งซ้ำของเหตุการณ์เดียวกัน
 */
export async function notifyAdmins(input: {
  kind: NotifyKind;
  title: string;
  body?: string;
  link?: string;
  dedupeKey?: string;
}) {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .upsert(
        {
          kind: input.kind,
          title: input.title,
          body: input.body ?? null,
          link: input.link ?? null,
          dedupe_key: input.dedupeKey ?? null,
        },
        { onConflict: "dedupe_key", ignoreDuplicates: true },
      )
      .select("id");
    // ถ้าซ้ำ (dedupe_key ชนกัน) จะไม่มีแถวใหม่ — ไม่ต้องส่งช่องทางอื่นซ้ำอีก
    if (error || !data || data.length === 0) return;
  } catch {
    return;
  }
  try {
    await sendAdminAlert({
      data: {
        title: `[${NOTIFY_KIND_TH[input.kind] ?? "แจ้งเตือน"}] ${input.title}`,
        body: input.body ?? "",
        link: input.link ?? "",
      },
    });
  } catch {
    /* ส่ง Line ไม่สำเร็จไม่ให้กระทบงานหลัก */
  }
}

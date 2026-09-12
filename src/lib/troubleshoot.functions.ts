import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** ให้ AI ร่างคำตอบ "วิธีตรวจสอบ" และ "วิธีแก้ไข" สำหรับอาการเสียใหม่ของปั๊มลม */
export const draftTroubleshooting = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      title: z.string().trim().min(1).max(200),
      note: z.string().trim().max(2_000).optional(),
      adminCode: z.string().min(4).max(128),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("security_settings")
      .select("value")
      .eq("key", "admin_passcode")
      .maybeSingle();
    if (!row || row.value.trim() !== data.adminCode.trim()) {
      return { ok: false as const, error: "รหัสแอดมินไม่ถูกต้องหรือยังไม่ได้ปลดล็อก" };
    }

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false as const, error: "ยังไม่ได้เชื่อมต่อระบบ AI" };

    const title = data.title;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "คุณเป็นวิศวกรบริการปั๊มลมอุตสาหกรรม (ปั๊มลมสกรู/ลูกสูบ) ตอบเป็นภาษาไทยเท่านั้น " +
              "ตอบกลับเป็น JSON เท่านั้น รูปแบบ {\"causes\":string,\"check_steps\":string,\"fix_steps\":string} " +
              "โดย check_steps และ fix_steps ให้เขียนเป็นข้อ 1..7 ขึ้นบรรทัดใหม่ด้วย \\n สั้น กระชับ ปฏิบัติได้จริง ระบุค่ามาตรฐาน เช่น ไฟ 3 เฟส 380V หรืออุณหภูมิ เมื่อเกี่ยวข้อง",
          },
          {
            role: "user",
            content: `อาการเสีย: ${title}${data.note ? `\nรายละเอียดเพิ่มเติม: ${data.note}` : ""}`,
          },
        ],
      }),
    });

    if (res.status === 429) return { ok: false as const, error: "ใช้งาน AI ถี่เกินไป กรุณาลองใหม่อีกครั้ง" };
    if (res.status === 402) return { ok: false as const, error: "เครดิต AI หมด กรุณาเติมเครดิต" };
    if (!res.ok) return { ok: false as const, error: `เรียก AI ไม่สำเร็จ (${res.status})` };

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned) as { causes?: string; check_steps?: string; fix_steps?: string };
      return {
        ok: true as const,
        causes: parsed.causes ?? "",
        check_steps: parsed.check_steps ?? "",
        fix_steps: parsed.fix_steps ?? "",
      };
    } catch {
      return { ok: true as const, causes: "", check_steps: cleaned, fix_steps: "" };
    }
  });

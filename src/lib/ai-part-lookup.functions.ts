import { createServerFn } from "@tanstack/react-start";

export type AiPartDraft = {
  name: string;
  part_number: string;
  category_name: string;
  cross_reference_parts: string[];
  description: string;
  reference_url: string;
};

/**
 * AI ช่วยค้นหาข้อมูลอะไหล่เมื่อค้นในระบบไม่พบ
 * คืนค่าเป็นฟอร์มร่างให้ช่างตรวจสอบก่อนกดยืนยันบันทึก
 */
export const aiPartLookup = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string; categories?: string[] }) => {
    const query = String(input?.query ?? "").trim().slice(0, 200);
    if (query.length < 2) throw new Error("กรุณาพิมพ์รหัสพาร์ทหรือ S/N ก่อนค้นหา");
    const categories = Array.isArray(input?.categories)
      ? input.categories.map((c) => String(c).slice(0, 80)).slice(0, 50)
      : [];
    return { query, categories };
  })
  .handler(async ({ data }): Promise<{ draft: AiPartDraft }> => {
    const { requireAccess } = await import("./access-session.server");
    await requireAccess("viewer");
    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    const catHint =
      data.categories.length > 0
        ? `หมวดหมู่ที่มีในระบบ: ${data.categories.join(", ")} — เลือกหมวดที่เหมาะสมที่สุดจากรายการนี้`
        : "กำหนดหมวดหมู่อะไหล่ปั๊มลมที่เหมาะสม เช่น ไส้กรองอากาศ, ไส้กรองน้ำมัน, น้ำมันปั๊ม, วาล์ว, ซีล, สายพาน";
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions:
          "คุณคือผู้เชี่ยวชาญอะไหล่ปั๊มลมอุตสาหกรรม ผู้ใช้จะส่งรหัสพาร์ทหรือหมายเลขเครื่อง (S/N) มาให้ " +
          "ให้ค้นหาและตอบกลับเป็น JSON อ็อบเจ็กต์เดียวเท่านั้น (ห้ามมีข้อความอื่น) ตามรูปแบบ: " +
          '{"name":"ชื่ออะไหล่ภาษาไทย","part_number":"รหัสพาร์ทหลัก","category_name":"หมวดหมู่","cross_reference_parts":["รหัสพาร์ทเทียบ1"],"description":"รายละเอียดสั้นๆ","reference_url":"URL แหล่งอ้างอิง"} ' +
          catHint +
          " ถ้าไม่แน่ใจค่าใดให้ใส่ค่าว่างหรืออาร์เรย์ว่าง ห้ามเดาราคา",
        input: data.query,
      });
      let out = "";
      for (const item of (res as { output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> }).output ?? []) {
        if (item.type !== "message") continue;
        for (const c of item.content ?? []) if (c.type === "output_text" && c.text) out += c.text;
      }
      const match = out.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("AI ไม่ได้ส่งข้อมูลกลับมา");
      const parsed = JSON.parse(match[0]) as Partial<AiPartDraft>;
      return {
        draft: {
          name: String(parsed.name ?? "").slice(0, 200),
          part_number: String(parsed.part_number ?? data.query).slice(0, 120),
          category_name: String(parsed.category_name ?? "").slice(0, 120),
          cross_reference_parts: Array.isArray(parsed.cross_reference_parts)
            ? parsed.cross_reference_parts.map((s) => String(s).slice(0, 120)).filter(Boolean).slice(0, 30)
            : [],
          description: String(parsed.description ?? "").slice(0, 1000),
          reference_url: /^https?:\/\//i.test(String(parsed.reference_url ?? ""))
            ? String(parsed.reference_url).slice(0, 500)
            : "",
        },
      };
    } catch (e) {
      if (e instanceof GatewayError) {
        console.error("aiPartLookup failed", e.code, e.httpStatus);
        if (e.httpStatus === 429) throw new Error("ใช้งาน AI ถี่เกินไป กรุณารอสักครู่");
        if (e.httpStatus === 402) throw new Error("เครดิต AI หมด กรุณาเติมเครดิต");
        throw new Error("ค้นหาด้วย AI ไม่สำเร็จ กรุณาลองใหม่");
      }
      throw e;
    }
  });

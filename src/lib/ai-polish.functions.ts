import { createServerFn } from "@tanstack/react-start";

export const polishText = createServerFn({ method: "POST" })
  .inputValidator((input: { text: string }) => {
    const text = String(input?.text ?? "").trim().slice(0, 4000);
    if (text.length < 2) throw new Error("ยังไม่มีข้อความให้เกลา");
    return { text };
  })
  .handler(async ({ data }): Promise<{ text: string }> => {
    const { requireAccess } = await import("./access-session.server");
    await requireAccess("viewer");
    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions:
          "คุณคือผู้ช่วยเรียบเรียงรายงานงานบริการ/ซ่อมบำรุงปั๊มลม แก้คำผิด จัดประโยคให้เป็นทางการ กระชับ และเป็นมืออาชีพ คงข้อเท็จจริง ตัวเลข รุ่น S/N หมายเลขพาร์ท และชื่อเฉพาะไว้ตามเดิม ห้ามแต่งข้อมูลเพิ่ม ใช้ภาษาเดียวกับต้นฉบับ ตอบเฉพาะข้อความที่เกลาแล้วเท่านั้น ไม่ต้องมีคำอธิบาย",
        input: data.text,
      });
      let out = "";
      for (const item of (res as { output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> }).output ?? []) {
        if (item.type !== "message") continue;
        for (const c of item.content ?? []) if (c.type === "output_text" && c.text) out += c.text;
      }
      out = out.trim();
      if (!out) throw new Error("AI ไม่ได้ส่งข้อความกลับมา");
      return { text: out };
    } catch (e) {
      if (e instanceof GatewayError) {
        console.error("polishText failed", e.code, e.httpStatus);
        if (e.httpStatus === 429) throw new Error("ใช้งาน AI ถี่เกินไป กรุณารอสักครู่");
        if (e.httpStatus === 402) throw new Error("เครดิต AI หมด กรุณาเติมเครดิต");
        throw new Error("เกลาข้อความไม่สำเร็จ กรุณาลองใหม่");
      }
      throw e;
    }
  });

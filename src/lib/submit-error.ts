/**
 * แปลงข้อผิดพลาดตอนกดส่ง/บันทึกเป็นข้อความภาษาไทยที่ผู้ใช้เข้าใจ
 * ครอบคลุม: ไฟล์ใหญ่เกิน (413), เน็ตหลุด, เซิร์ฟเวอร์ช้า, สิทธิ์หมดอายุ, ข้อมูลซ้ำ
 */
export function describeSubmitError(err: unknown): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err ?? "");
  const msg = raw.trim() || "ไม่ทราบสาเหตุ";
  const low = msg.toLowerCase();

  if (
    low.includes("413") ||
    low.includes("payload too large") ||
    low.includes("request entity too large") ||
    low.includes("exceeds the maximum") ||
    low.includes("too large")
  )
    return "ข้อมูลหรือไฟล์แนบมีขนาดใหญ่เกินไป ลองลดจำนวนรูปหรือถ่ายรูปใหม่แล้วส่งอีกครั้ง";

  if (
    low.includes("failed to fetch") ||
    low.includes("networkerror") ||
    low.includes("network request failed") ||
    low.includes("load failed") ||
    low.includes("offline")
  )
    return "การเชื่อมต่ออินเทอร์เน็ตขัดข้อง ตรวจสอบสัญญาณแล้วกดส่งอีกครั้ง";

  if (low.includes("timeout") || low.includes("timed out") || low.includes("abort"))
    return "เซิร์ฟเวอร์ตอบช้าเกินไป รอสักครู่แล้วกดส่งอีกครั้ง";

  if (
    low.includes("401") ||
    low.includes("403") ||
    low.includes("permission") ||
    low.includes("row-level security") ||
    low.includes("ไม่มีสิทธิ์") ||
    low.includes("หมดอายุ")
  )
    return "สิทธิ์การใช้งานหมดอายุหรือไม่เพียงพอ ลองปลดล็อกรหัสใหม่แล้วส่งอีกครั้ง";

  if (low.includes("duplicate key") || low.includes("23505"))
    return "มีข้อมูลนี้อยู่ในระบบแล้ว (ซ้ำ) ตรวจสอบเลขที่เอกสารหรือรายการที่ซ้ำกัน";

  if (low.includes("23503") || low.includes("foreign key"))
    return "ข้อมูลที่อ้างถึงไม่ครบหรือถูกลบไปแล้ว ลองเลือกข้อมูลใหม่อีกครั้ง";

  if (low.includes("42703") || low.includes("does not exist"))
    return `โครงสร้างฐานข้อมูลยังไม่อัปเดต แจ้งผู้ดูแลระบบให้ตรวจสอบ (${msg})`;

  if (low.includes("quota") || (low.includes("storage") && low.includes("exceed")))
    return "พื้นที่จัดเก็บไฟล์เต็มหรือเกินโควตา แจ้งผู้ดูแลระบบ";

  return msg;
}

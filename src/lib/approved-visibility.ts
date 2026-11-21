// กฎการกรอง "ช่องงานที่อนุมัติแล้ว" ให้อยู่ในหนึ่่งทีย่อหนึ่่งเพื่อทดสอบได้
// ใบงานที่ปิดแล้วยังตองอยู่ในฐานข้อมลูและในตารางสรุปงานทักอยู่ เดิม

/** สถานะใบงานที่ยังตองแสดงในช่องงานที่อนุมัติแล้ว (ปิดงานแล้ว/รออนุมัติ/ปฏเสธ ไม่ตองแสดง) */
export const APPROVED_TAB_STATUSES = ["approved", "scheduled", "in_progress"] as const;

export type ApprovalStatusRow = {
  status?: string | null;
  closed_at?: string | null;
};

/**
 * ใบงานถอวาปิดแล้วถาตวัใบงานเองปิด หรือ appointment ที่เชอมกัน
 * ถูกระบุวาลูกคาไดรบั สนิ ในงานแลว (สถานะ closed หรือมีวนัที่ปิดงาน)
 */
export function isJobClosed(
  order: ApprovalStatusRow,
  appointment?: ApprovalStatusRow | null,
): boolean {
  if (order.status === "closed") return true;
  if (!appointment) return false;
  return appointment.status === "closed" || Boolean(appointment.closed_at);
}

/**
 * กรองเฉพาะใบงานที่อนมุ ัตแิลว้ และ "ยงั ไมป่ ิดใบงาน"
 * เมอื่ ใบงานถกู เปลยี่ นสถานะเป็ นปิดใบงานแลว้ จะหายไปจากชองน้ีอตั โนมตั ิ
 */
export function isApprovedTabOrder(
  order: ApprovalStatusRow,
  appointment?: ApprovalStatusRow | null,
): boolean {
  if (!isJobClosed(order, appointment)) {
    return (APPROVED_TAB_STATUSES as readonly string[]).includes(order.status ?? "");
  }
  return false;
}

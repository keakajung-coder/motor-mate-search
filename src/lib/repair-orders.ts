import type { Tables } from "@/integrations/supabase/types";

export const REPAIR_STATUSES = ["Pending", "In Progress", "Waiting Parts", "Ready", "Completed"] as const;
export type RepairStatus = (typeof REPAIR_STATUSES)[number];
export type RepairOrder = Tables<"repair_orders">;

export const STATUS_LABELS: Record<RepairStatus, string> = {
  Pending: "รับเข้า",
  "In Progress": "กำลังซ่อม",
  "Waiting Parts": "รออะไหล่",
  Ready: "ซ่อมเสร็จรอส่ง",
  Completed: "ส่งออกแล้ว",
};

export function repairStatus(value: string): RepairStatus {
  return (REPAIR_STATUSES as readonly string[]).includes(value) ? (value as RepairStatus) : "Pending";
}

/** เครื่องที่ยังอยู่ในช็อป = ทุกสถานะที่ยังไม่ส่งออก */
export function isInShop(order: Pick<RepairOrder, "status">) {
  return repairStatus(order.status) !== "Completed";
}

/** ค้นหาจากบริษัท รุ่นเครื่อง S/N ผู้ขาย ผู้ติดต่อ หรือเบอร์โทร */
export function repairSearch(order: RepairOrder, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/[^\d]/g, "");
  const fields = [order.company_name, order.equipment_model, order.serial_number, order.sales_person, order.contact_person, order.assigned_tech];
  if (fields.some((f) => (f ?? "").toLowerCase().includes(q))) return true;
  return digits.length > 0 && (order.contact_phone ?? "").replace(/[^\d]/g, "").includes(digits);
}

export type RepairReport = {
  inShopTotal: number;
  byStatus: { status: RepairStatus; label: string; count: number }[];
  inShop: RepairOrder[];
  delivered: RepairOrder[];
};

/** สรุปรายงานประชุม: เครื่องค้างช็อปแยกตามสถานะ + เครื่องที่ส่งมอบจริงในช่วงวันที่เลือก */
export function buildRepairReport(orders: RepairOrder[], from: string, to: string): RepairReport {
  const inShop = orders.filter(isInShop);
  const delivered = orders.filter(
    (o) => repairStatus(o.status) === "Completed" && o.actual_delivery_date != null && o.actual_delivery_date >= from && o.actual_delivery_date <= to,
  );
  const byStatus = REPAIR_STATUSES.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: orders.filter((o) => repairStatus(o.status) === status).length,
  }));
  return { inShopTotal: inShop.length, byStatus, inShop, delivered };
}

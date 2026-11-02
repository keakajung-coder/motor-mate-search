import { describe, expect, test } from "bun:test";
import { bangkokDate, buildWeeklySummary, machineGroup, weekRange, type SummaryJob } from "./weekly-summary";
const range = { from: "2026-11-02", to: "2026-11-08" };
const job = (id: string, status = "pending", extra: Partial<SummaryJob> = {}): SummaryJob => ({ id, status, customer_name: "ลูกค้า", job_detail: null, staff_name: "ก, ข", visit_date: "2026-11-02", created_at: "2026-11-01T18:00:00Z", serial_number: null, ...extra });
describe("weekly meeting summary", () => {
  test("four KPIs count total, completed, quoted and not-started tasks", () => {
    expect(buildWeeklySummary([job("1"), job("2", "closed"), job("3", "quoted"), job("4", "in_progress")], [], [], range).counts).toEqual({ total: 4, completed: 1, quoted: 1, pending: 1, active: 1 });
  });
  test("range includes both endpoints and uses recorded date for undated backlog", () => {
    const result = buildWeeklySummary([job("1", "pending", { visit_date: null }), job("2", "pending", { visit_date: "2026-11-08" }), job("3", "pending", { visit_date: "2026-11-09" })], [], [], range);
    expect(result.jobs.map(j => j.id)).toEqual(["1", "2"]);
    expect(bangkokDate("2026-11-01T18:00:00Z")).toBe("2026-11-02");
  });
  test("linked appointment is counted once with its latest completion status", () => {
    expect(buildWeeklySummary([job("w", "approved")], [job("a", "closed", { work_order_id: "w", quotation_required: true })], [], range).counts).toEqual({ total: 1, completed: 1, quoted: 0, pending: 0, active: 0 });
  });
  test("excluded and out-of-range appointment cannot resurrect its work order", () => {
    expect(buildWeeklySummary([job("w")], [job("a", "closed", { work_order_id: "w", visit_date: "2026-11-09" }), job("r", "rejected")], [], range).counts.total).toBe(0);
  });
  test("each assigned technician counts once per job, including unassigned", () => {
    expect(buildWeeklySummary([job("1", "pending", { staff_name: "ก, ก, ข" }), job("2", "closed", { staff_name: null })], [], [], range).technicians).toEqual([{ name: "ก", count: 1 }, { name: "ข", count: 1 }, { name: "ยังไม่ระบุช่าง", count: 1 }]);
  });
  test("machine proportions preserve five requested categories plus custom and blank", () => {
    const statuses = ["คอนแทรค", "อยู่ในประกัน", "ซื้ออะไหล่เปลี่ยนเอง", "เรียกเป็นครั้ง", "หลุดคอนแทรค", "อื่นๆ", null];
    const s = buildWeeklySummary([], [], statuses.map((status, i) => ({ id: String(i), status })), range);
    expect(s.machineTotal).toBe(7); expect(s.machines.reduce((n, g) => n + g.count, 0)).toBe(7);
    expect(s.machines.slice(0, 5).map(g => g.count)).toEqual([1, 1, 1, 1, 1]);
    expect(machineGroup(null)).toBe("ไม่ระบุสถานะ");
  });
  test("default week is Monday through Sunday in Bangkok", () => { expect(weekRange(new Date("2026-11-01T18:00:00Z"))).toEqual(range); });
});
import { test } from "node:test";
import assert from "node:assert/strict";
import { agendaForDate, bangkokToday, formatAgendaLine, shiftIsoDate, type AgendaJob } from "./daily-agenda";

const jobs: AgendaJob[] = [
  { id: "1", visit_date: "2026-11-25", visit_time: "13:00", customer_name: "B", staff_name: "สมชาย, วิชัย", sales_rep: "นภา", status: "closed" },
  { id: "2", visit_date: "2026-11-25", visit_time: "08:30", customer_name: "A", staff_name: "วิชัย", sales_rep: "", status: "approved" },
  { id: "3", visit_date: "2026-11-26", customer_name: "C", staff_name: "สมชาย" },
];
const admin = { isAdmin: true, role: "admin", userName: "" };

test("admin sees every job on the date regardless of status, sorted by time", () => {
  assert.deepEqual(agendaForDate(jobs, "2026-11-25", admin).map((j) => j.id), ["2", "1"]);
});
test("technician sees only jobs naming them", () => {
  assert.deepEqual(agendaForDate(jobs, "2026-11-25", { isAdmin: false, role: "tech", userName: "สมชาย" }).map((j) => j.id), ["1"]);
});
test("seller sees only jobs where they are the seller", () => {
  assert.deepEqual(agendaForDate(jobs, "2026-11-25", { isAdmin: false, role: "seller", userName: "นภา" }).map((j) => j.id), ["1"]);
});
test("admin technician filter", () => {
  assert.deepEqual(agendaForDate(jobs, "2026-11-25", admin, "วิชัย").map((j) => j.id), ["2", "1"]);
  assert.deepEqual(agendaForDate(jobs, "2026-11-25", admin, "สมชาย").map((j) => j.id), ["1"]);
});
test("LINE text includes seller line for every job", () => {
  const text = formatAgendaLine("2026-11-25", agendaForDate(jobs, "2026-11-25", admin), jobs);
  assert.equal((text.match(/ผู้ขาย:/g) ?? []).length, 2);
  assert.match(text, /ผู้ขาย: นภา/);
});
test("Bangkok date rolls over at 17:00 UTC", () => {
  assert.equal(bangkokToday(new Date("2026-11-24T17:30:00Z")), "2026-11-25");
  assert.equal(shiftIsoDate("2026-11-30", 1), "2026-12-01");
});

test("15:30 shows tomorrow, 08:00 shows today", async () => {
  const { dueAgendaSlot, refreshAgendaSlot } = await import("./daily-agenda");
  assert.equal(dueAgendaSlot(7 * 60 + 59), null);
  assert.equal(dueAgendaSlot(8 * 60)?.dayOffset, 0);
  assert.equal(dueAgendaSlot(15 * 60 + 29)?.dayOffset, 0);
  assert.equal(dueAgendaSlot(15 * 60 + 30)?.dayOffset, 1);
  assert.equal(refreshAgendaSlot(15 * 60 + 25)?.key, "afternoon");
  assert.equal(refreshAgendaSlot(15 * 60 + 24), null);
});

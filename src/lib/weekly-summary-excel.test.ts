import { test } from "node:test";
import assert from "node:assert/strict";
import { summarySheets } from "./weekly-summary-excel";
import { buildWeeklySummary, type SummaryJob } from "./weekly-summary";
const range = { from: "2026-11-02", to: "2026-11-08" };
const palette = { paper: "FFFFFF", text: "222222", border: "DDDDDD", header: "EEEEEE", success: "168348" };
test("Excel exports filtered tasks and matching KPI formula caches", () => {
  const job: SummaryJob = { id: "a", customer_name: "ลูกค้า", job_detail: null, staff_name: "ก", status: "closed", visit_date: "2026-11-02", created_at: "2026-11-02T01:00:00Z", serial_number: "SN1" };
  const sheets = summarySheets(buildWeeklySummary([job, { ...job, id: "b", visit_date: "2026-11-09" }], [], [{ id: "m", status: "คอนแทรค" }], range), range, palette);
  assert.equal(sheets.length, 5); assert.equal(sheets[4].rows.length, 4);
  assert.equal(sheets[0].formulas?.B4.value, 1); assert.equal(sheets[0].formulas?.B5.value, 1);
  assert.equal(sheets[2].formulas?.C4.value, 1);
});
test("empty report avoids invalid formula ranges and division by zero", () => {
  const sheets = summarySheets(buildWeeklySummary([], [], [], range), range, palette);
  assert.equal(sheets[0].formulas?.B4.formula, "0");
  assert.equal(sheets[2].formulas?.C4.formula, "IFERROR(B4/$B$9,0)");
});
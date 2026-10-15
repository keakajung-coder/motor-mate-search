import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlannerSheets, plannerExcelHour, type PlannerExcelJob } from "./planner-excel";

const palette = { text: "17202A", paper: "FFFFFF", muted: "EEEEEE", border: "CCCCCC", header: "EEEEEE", holiday: "FFE4E6", holidayText: "9F1239", lunch: "FEF3C7", pending: "EF4444", active: "FBBF24", completed: "10B981" };
const job = (id: string, date: string, time: string): PlannerExcelJob => ({ id, visit_date: date, visit_time: time, customer_name: id, status: "scheduled", staff_name: "ช่าง A", vehicle_plate: "รถ A", machine_label: null, serial_number: null, service_type: null, job_detail: null });
test("Excel weekly/day time slots preserve planner placement", () => {
  assert.equal(plannerExcelHour("12:30"), 13);
  assert.equal(plannerExcelHour(null), 7);
  assert.equal(plannerExcelHour("06:00"), 7);
  assert.equal(plannerExcelHour("23:00"), 19);
});
test("weekly workbook only contains visible week and input-filtered jobs", () => {
  const sheets = buildPlannerSheets({ view: "week", cursor: new Date(2026, 9, 15), title: "สัปดาห์", jobs: [job("IN", "2026-10-15", "12:30"), job("OUT", "2026-10-25", "10:00")], leave: [], holidays: {}, filterLabel: "ช่าง A", palette, jobColors: () => ({ fill: "FFFFFF", border: "CCCCCC" }) });
  assert.equal(sheets[1].rows.length, 2);
  assert.equal(sheets[1].rows[1][3], "IN");
  const slot = sheets[0].rows.find((r) => r[0] === "13:00");
  assert.ok(slot);
  assert.ok(String(slot[4]).includes("IN"));
  assert.equal(sheets[0].rows.filter((r) => /^\d\d:00$/.test(String(r[0]))).length, 12);
});
test("monthly workbook preserves six Monday-Sunday groups and full job rows", () => {
  const jobs = Array.from({ length: 12 }, (_, i) => job(`JOB-${i}`, "2026-10-15", "08:00"));
  const sheets = buildPlannerSheets({ view: "month", cursor: new Date(2026, 9, 15), title: "เดือน", jobs, leave: [], holidays: {}, filterLabel: "", palette, jobColors: () => ({ fill: "FFFFFF", border: "CCCCCC" }) });
  assert.equal(sheets[0].cols?.length, 7);
  assert.equal(sheets[1].rows.length, 13);
  for (const j of jobs) assert.ok(sheets[0].rows.some((row) => row.some((cell) => String(cell).includes(` · ${j.id}\n`))));
});
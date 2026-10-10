import { test } from "node:test";
import assert from "node:assert/strict";
import { findScheduleConflicts } from "./schedule-conflicts";

const d = "2026-10-12";
test("blocks a job during full-day leave", () => {
  assert.equal(findScheduleConflicts({ visit_date: d, visit_time: "14:00", staff_name: "A" }, [], [{ staff_name: "A", leave_date: d, period: "full" }]).length, 1);
});
test("morning leave blocks morning job but not afternoon job", () => {
  const leave = [{ staff_name: "A", leave_date: d, period: "am" as const }];
  assert.equal(findScheduleConflicts({ visit_date: d, visit_time: "09:00", staff_name: "A" }, [], leave).length, 1);
  assert.equal(findScheduleConflicts({ visit_date: d, visit_time: "13:00", staff_name: "A" }, [], leave).length, 0);
});
test("same technician on two different vehicles at the same time is blocked", () => {
  const other = [{ id: "x", visit_date: d, visit_time: "09:00", staff_name: "A", vehicle_plate: "1กก" }];
  assert.equal(findScheduleConflicts({ visit_date: d, visit_time: "10:00", staff_name: "A", vehicle_plate: "2ขข" }, other, []).length, 1);
});
test("one vehicle may serve several jobs with the same crew", () => {
  const other = [{ id: "x", visit_date: d, visit_time: "09:00", staff_name: "A, B", vehicle_plate: "1กก" }];
  assert.equal(findScheduleConflicts({ visit_date: d, visit_time: "10:00", staff_name: "A", vehicle_plate: "1กก" }, other, []).length, 0);
});
test("several technicians may share one vehicle", () => {
  assert.equal(findScheduleConflicts({ visit_date: d, visit_time: "10:00", staff_name: "A, B, C", vehicle_plate: "1กก" }, [], []).length, 0);
});

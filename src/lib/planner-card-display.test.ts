import { test } from "node:test";
import assert from "node:assert/strict";
import { shortPlannerName, DEFAULT_PLANNER_CARD_FIELDS } from "./planner-card-display";
test("only first word of each staff or seller name is displayed", () => {
  assert.equal(shortPlannerName("  สมชาย ใจดี, วิชัย รักงาน / นภา ทดสอบ"), "สมชาย, วิชัย, นภา");
});
test("unspaced long names are bounded without changing the source", () => {
  const original = "ABCDEFGHIJKLMNOPQRST";
  assert.equal(shortPlannerName(original), "ABCDEFGHIJKLM…");
  assert.equal(original, "ABCDEFGHIJKLMNOPQRST");
});
test("every display field starts enabled", () => {
  assert.deepEqual(DEFAULT_PLANNER_CARD_FIELDS, { customer: true, serial: true, staff: true, seller: true, job: true, vehicle: true, time: true });
});
test("empty names remain safe", () => {
  assert.equal(shortPlannerName(null), "");
});
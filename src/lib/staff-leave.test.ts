import { test } from "node:test";
import assert from "node:assert/strict";
import { isLeavePeriod, leaveInSession } from "./staff-leave";
test("full-day leave covers both morning and afternoon", () => {
  assert.equal(leaveInSession("full", "am"), true);
  assert.equal(leaveInSession("full", "pm"), true);
});
test("morning half-day leave only covers morning", () => {
  assert.equal(leaveInSession("am", "am"), true);
  assert.equal(leaveInSession("am", "pm"), false);
});
test("afternoon half-day leave only covers afternoon", () => {
  assert.equal(leaveInSession("pm", "am"), false);
  assert.equal(leaveInSession("pm", "pm"), true);
});
test("only three leave periods are accepted", () => {
  assert.deepEqual(["full", "am", "pm", "other", ""].map(isLeavePeriod), [true, true, true, false, false]);
});
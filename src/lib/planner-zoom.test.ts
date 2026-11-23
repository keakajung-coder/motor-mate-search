import { test } from "node:test";
import assert from "node:assert/strict";
import { clampPlannerZoom, pinchPlannerZoom, stepPlannerZoom } from "./planner-zoom";

test("clamps between 50% and 200%", () => {
  assert.equal(clampPlannerZoom(0.1), 0.5);
  assert.equal(clampPlannerZoom(5), 2);
  assert.equal(clampPlannerZoom(Number.NaN), 1);
});
test("steps by 10% without float drift", () => {
  assert.equal(stepPlannerZoom(1, 1), 1.1);
  assert.equal(stepPlannerZoom(0.7, -1), 0.6);
  assert.equal(stepPlannerZoom(2, 1), 2);
});
test("pinch scales from the zoom at gesture start", () => {
  assert.equal(pinchPlannerZoom(1, 100, 150), 1.5);
  assert.equal(pinchPlannerZoom(1, 100, 10), 0.5);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APPROVED_TAB_STATUSES,
  isApprovedTabOrder,
  isJobClosed,
} from "./approved-visibility.ts";

test("approved and scheduled jobs that are not closed stay in the approved tab", () => {
  assert.equal(isApprovedTabOrder({ status: "approved" }, null), true);
  assert.equal(isApprovedTabOrder({ status: "scheduled" }, { status: "scheduled" }), true);
  assert.equal(isApprovedTabOrder({ status: "in_progress" }, { status: "in_progress" }), true);
});

test("a closed work order disappears from the approved tab automatically", () => {
  assert.equal(isApprovedTabOrder({ status: "closed" }, { status: "closed" }), false);
  assert.equal(isJobClosed({ status: "closed" }, null), true);
});

test("a job whose linked appointment was closed counts as closed even if the order row lags", () => {
  assert.equal(isApprovedTabOrder({ status: "approved" }, { status: "closed" }), false);
  assert.equal(isApprovedTabOrder({ status: "scheduled" }, { status: "closed" }), false);
  assert.equal(isApprovedTabOrder({ status: "in_progress" }, { status: "closed" }), false);
});

test("a close date on the appointment counts as closed even when its status was not updated", () => {
  assert.equal(
    isApprovedTabOrder({ status: "approved" }, { status: "approved", closed_at: "2026-11-20T09:00:00Z" }),
    false,
  );
});

test("jobs still waiting for approval or rejected are never shown in the approved tab", () => {
  assert.equal(isApprovedTabOrder({ status: "pending" }, null), false);
  assert.equal(isApprovedTabOrder({ status: "rejected" }, null), false);
  assert.equal(isApprovedTabOrder({ status: "unscheduled" }, null), false);
});

test("the approved tab only ever asks for open job statuses", () => {
  assert.deepEqual([...APPROVED_TAB_STATUSES], ["approved", "scheduled", "in_progress"]);
});

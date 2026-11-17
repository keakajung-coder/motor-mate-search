import { test } from "node:test";
import assert from "node:assert/strict";
import { contractJobStatus, bangkokContractDate } from "./contract-job-policy.ts";

test("contract jobs bypass pending admin approval even before customer confirmation", () => {
  assert.equal(contractJobStatus("unscheduled"), "approved");
  assert.equal(contractJobStatus("pending"), "approved");
  assert.equal(contractJobStatus("scheduled"), "scheduled");
});
test("due rounds use the Bangkok date at the UTC day boundary", () => {
  assert.equal(bangkokContractDate(new Date("2026-11-16T18:00:00Z")), "2026-11-17");
});
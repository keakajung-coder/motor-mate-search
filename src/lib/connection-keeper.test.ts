import { test } from "node:test";
import assert from "node:assert/strict";
import { CHECK_TIMEOUT_MS, NETWORK_FAILURES_FOR_OFFLINE } from "./connection-rules";

test("waits 15 seconds before a connection check times out", () => {
  assert.equal(CHECK_TIMEOUT_MS, 15_000);
});

test("needs more than one hard network failure before showing offline", () => {
  assert.ok(NETWORK_FAILURES_FOR_OFFLINE > 1);
});

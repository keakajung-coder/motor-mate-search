import { test } from "node:test";
import assert from "node:assert/strict";
import { withRequestTimeout } from "./request-timeout";

test("a hanging request rejects instead of keeping the UI busy forever", async () => {
  await assert.rejects(withRequestTimeout(new Promise(() => {}), 10), /กรุณาลองใหม่/);
});
test("a successful request returns its actual result", async () => {
  assert.equal(await withRequestTimeout(Promise.resolve(42), 100), 42);
});
test("request failures are forwarded", async () => {
  await assert.rejects(withRequestTimeout(Promise.reject(new Error("failed")), 100), /failed/);
});
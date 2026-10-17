import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleNotifications } from "./notification-dismissals";

const rows = [
  { id: "one", created_at: "2026-10-17T01:00:00Z" },
  { id: "two", created_at: "2026-10-17T01:01:00Z" },
  { id: "new", created_at: "2026-10-17T01:34:00Z" },
];

test("removes only the selected notification", () => {
  assert.deepEqual(visibleNotifications(rows, { ids: ["two"], clearedBefore: null }).map((r) => r.id), ["one", "new"]);
});
test("clears older notifications including ones outside the loaded batch, but preserves new arrivals", () => {
  assert.deepEqual(visibleNotifications(rows, { ids: [], clearedBefore: "2026-10-17T01:01:00Z" }).map((r) => r.id), ["new"]);
});
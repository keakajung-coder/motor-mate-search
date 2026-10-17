import { describe, expect, it } from "vitest";
import { visibleNotifications } from "./notification-dismissals";

const rows = [
  { id: "one", created_at: "2026-10-17T01:00:00Z" },
  { id: "two", created_at: "2026-10-17T01:01:00Z" },
  { id: "new", created_at: "2026-10-17T01:34:00Z" },
];

describe("notification dismissal", () => {
  it("removes only the selected notification", () => {
    expect(visibleNotifications(rows, { ids: ["two"], clearedBefore: null }).map((r) => r.id))
      .toEqual(["one", "new"]);
  });
  it("clears older notifications including ones outside the loaded batch, but preserves new arrivals", () => {
    expect(visibleNotifications(rows, { ids: [], clearedBefore: "2026-10-17T01:01:00Z" }).map((r) => r.id))
      .toEqual(["new"]);
  });
});
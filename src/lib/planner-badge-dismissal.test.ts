import { test } from "node:test";
import assert from "node:assert/strict";
import { dismissPlannerBadge, isPlannerBadgeDismissed, PLANNER_BADGE_DISMISSAL_KEY } from "./planner-badge-dismissal";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

test("admin badge dismissal persists independently for each job and badge type", () => {
  const storage = memoryStorage();
  assert.equal(dismissPlannerBadge("job-1", "zone", storage), true);
  assert.equal(isPlannerBadgeDismissed("job-1", "zone", storage), true);
  assert.equal(isPlannerBadgeDismissed("job-1", "overlap", storage), false);
  assert.equal(isPlannerBadgeDismissed("job-2", "zone", storage), false);
  assert.deepEqual(JSON.parse(storage.getItem(PLANNER_BADGE_DISMISSAL_KEY) ?? "[]"), ["zone:job-1"]);
});

test("dismissing the same badge repeatedly keeps one stable saved entry", () => {
  const storage = memoryStorage();
  dismissPlannerBadge("job-1", "overlap", storage);
  dismissPlannerBadge("job-1", "overlap", storage);
  assert.deepEqual(JSON.parse(storage.getItem(PLANNER_BADGE_DISMISSAL_KEY) ?? "[]"), ["overlap:job-1"]);
});

test("damaged local storage never hides badges or crashes the planner", () => {
  const storage = memoryStorage();
  storage.setItem(PLANNER_BADGE_DISMISSAL_KEY, "not-json");
  assert.equal(isPlannerBadgeDismissed("job-1", "zone", storage), false);
  assert.equal(dismissPlannerBadge("job-1", "zone", storage), true);
  assert.equal(isPlannerBadgeDismissed("job-1", "zone", storage), true);
});

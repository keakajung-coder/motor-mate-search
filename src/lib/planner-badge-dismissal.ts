export type PlannerBadgeKind = "zone" | "overlap";

export const PLANNER_BADGE_DISMISSAL_KEY = "planner-badge-dismissals-v1";
export const PLANNER_BADGE_DISMISSAL_EVENT = "app:planner-badge-dismissed";

type BadgeStorage = Pick<Storage, "getItem" | "setItem">;

function storageKey(jobId: string, kind: PlannerBadgeKind) {
  return `${kind}:${jobId}`;
}

function readKeys(storage: BadgeStorage): string[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(PLANNER_BADGE_DISMISSAL_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function isPlannerBadgeDismissed(jobId: string, kind: PlannerBadgeKind, storage?: BadgeStorage): boolean {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!target) return false;
  try {
    return readKeys(target).includes(storageKey(jobId, kind));
  } catch {
    return false;
  }
}

/** Hide only this badge on this job. No job record or permission data is changed. */
export function dismissPlannerBadge(jobId: string, kind: PlannerBadgeKind, storage?: BadgeStorage): boolean {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!target) return false;
  try {
    const keys = new Set(readKeys(target));
    keys.add(storageKey(jobId, kind));
    target.setItem(PLANNER_BADGE_DISMISSAL_KEY, JSON.stringify([...keys]));
    if (!storage) window.dispatchEvent(new Event(PLANNER_BADGE_DISMISSAL_EVENT));
    return true;
  } catch {
    return false;
  }
}

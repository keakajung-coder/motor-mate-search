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

export function countDismissedPlannerBadges(storage?: BadgeStorage): number {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!target) return 0;
  try { return readKeys(target).length; } catch { return 0; }
}

/** Show a hidden badge again. Without jobId, restores every hidden badge. Job records are untouched. */
export function restorePlannerBadge(jobId?: string, kind?: PlannerBadgeKind, storage?: BadgeStorage): boolean {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!target) return false;
  try {
    const keys = jobId
      ? readKeys(target).filter((key) => (kind ? key !== storageKey(jobId, kind) : !key.endsWith(`:${jobId}`)))
      : [];
    target.setItem(PLANNER_BADGE_DISMISSAL_KEY, JSON.stringify(keys));
    if (!storage) window.dispatchEvent(new Event(PLANNER_BADGE_DISMISSAL_EVENT));
    return true;
  } catch {
    return false;
  }
}

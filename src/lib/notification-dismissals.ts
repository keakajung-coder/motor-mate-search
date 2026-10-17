export type NotificationDismissals = { ids: string[]; clearedBefore: string | null };

export const EMPTY_DISMISSALS: NotificationDismissals = { ids: [], clearedBefore: null };
const STORAGE_KEY = "app_notification_dismissals";

export function readDismissals(): NotificationDismissals {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!value || typeof value !== "object") return EMPTY_DISMISSALS;
    const record = value as Record<string, unknown>;
    return {
      ids: Array.isArray(record.ids) ? record.ids.filter((id): id is string => typeof id === "string") : [],
      clearedBefore: typeof record.clearedBefore === "string" && Number.isFinite(Date.parse(record.clearedBefore))
        ? record.clearedBefore : null,
    };
  } catch {
    return EMPTY_DISMISSALS;
  }
}

export function saveDismissals(value: NotificationDismissals) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function visibleNotifications<T extends { id: string; created_at: string }>(
  rows: T[], dismissals: NotificationDismissals,
): T[] {
  const hidden = new Set(dismissals.ids);
  const cutoff = dismissals.clearedBefore ? Date.parse(dismissals.clearedBefore) : -Infinity;
  return rows.filter((row) => !hidden.has(row.id) && Date.parse(row.created_at) > cutoff);
}
/**
 * แคชข้อมูลเครื่องจักรลงเครื่อง เพื่อให้ค้นหาได้แม้ไม่มีอินเทอร์เน็ต
 * (LocalStorage — เขียนทับทุกครั้งที่โหลดข้อมูลสำเร็จตอนออนไลน์)
 */
const PREFIX = "offline_cache_";

export function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function saveOffline<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* พื้นที่เต็ม — ข้ามไป */
  }
}

export function loadOffline<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return (JSON.parse(raw) as { data: T }).data ?? null;
  } catch {
    return null;
  }
}

export function offlineSavedAt(key: string): Date | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return new Date((JSON.parse(raw) as { at: number }).at);
  } catch {
    return null;
  }
}

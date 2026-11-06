/**
 * สำรองข้อมูลฟอร์มลง LocalStorage เมื่อส่งไม่สำเร็จหรือเน็ตหลุด
 * กันข้อมูลที่พิมพ์/เซ็นสูญหาย — เก็บไว้ 24 ชั่วโมงแล้วลบทิ้งอัตโนมัติ
 */
const PREFIX = "form-backup:";
const TTL_MS = 24 * 60 * 60 * 1000;

type BackupEnvelope<T> = { savedAt: number; data: T };

export function saveFormBackup<T>(key: string, data: T): boolean {
  try {
    const env: BackupEnvelope<T> = { savedAt: Date.now(), data };
    localStorage.setItem(PREFIX + key, JSON.stringify(env));
    return true;
  } catch {
    return false; // พื้นที่เต็มหรือโหมดส่วนตัว — ไม่ขัดจังหวะผู้ใช้
  }
}

export function loadFormBackup<T>(key: string): { data: T; savedAt: Date } | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const env = JSON.parse(raw) as BackupEnvelope<T>;
    if (!env || typeof env.savedAt !== "number" || Date.now() - env.savedAt > TTL_MS) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return { data: env.data, savedAt: new Date(env.savedAt) };
  } catch {
    return null;
  }
}

export function clearFormBackup(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

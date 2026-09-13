import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { verifyPasscode } from "@/lib/passcode.functions";

const VIEWER_KEY = "pc_viewer";
const ADMIN_KEY = "pc_admin";

type AccessValue = {
  ready: boolean;
  viewerOk: boolean;
  isAdmin: boolean;
  unlockViewer: (code: string) => Promise<boolean>;
  unlockAdmin: (code: string) => Promise<boolean>;
  lockAdmin: () => void;
  lockAll: () => void;
};

const AccessContext = createContext<AccessValue | null>(null);

export function useAccess(): AccessValue {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error("useAccess must be used inside <AccessProvider>");
  return ctx;
}

async function check(kind: "viewer" | "admin", code: string) {
  try {
    const res = await verifyPasscode({ data: { kind, code } });
    return !!res?.ok;
  } catch {
    return false;
  }
}

export function AccessProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [viewerOk, setViewerOk] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const v = localStorage.getItem(VIEWER_KEY);
      const a = localStorage.getItem(ADMIN_KEY);
      const [vOk, aOk] = await Promise.all([
        v ? check("viewer", v) : Promise.resolve(false),
        a ? check("admin", a) : Promise.resolve(false),
      ]);
      if (cancelled) return;
      if (!vOk) localStorage.removeItem(VIEWER_KEY);
      if (!aOk) localStorage.removeItem(ADMIN_KEY);
      setViewerOk(vOk || aOk);
      setIsAdmin(aOk);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const unlockViewer = useCallback(async (code: string) => {
    const ok = await check("viewer", code);
    if (ok) {
      localStorage.setItem(VIEWER_KEY, code);
      setViewerOk(true);
    }
    return ok;
  }, []);

  const unlockAdmin = useCallback(async (code: string) => {
    const ok = await check("admin", code);
    if (ok) {
      localStorage.setItem(ADMIN_KEY, code);
      setIsAdmin(true);
      setViewerOk(true);
    }
    return ok;
  }, []);

  const lockAdmin = useCallback(() => {
    localStorage.removeItem(ADMIN_KEY);
    setIsAdmin(false);
  }, []);

  const lockAll = useCallback(() => {
    localStorage.removeItem(ADMIN_KEY);
    localStorage.removeItem(VIEWER_KEY);
    setIsAdmin(false);
    setViewerOk(false);
  }, []);

  return (
    <AccessContext.Provider
      value={{ ready, viewerOk, isAdmin, unlockViewer, unlockAdmin, lockAdmin, lockAll }}
    >
      {children}
    </AccessContext.Provider>
  );
}

/** รหัสแอดมินที่บันทึกไว้ (ใช้ยืนยันตอนเปลี่ยนรหัส) */
export function storedAdminCode(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ADMIN_KEY) ?? "";
}

export function setStoredAdminCode(code: string) {
  localStorage.setItem(ADMIN_KEY, code);
}

/**
 * ลบข้อมูลผ่านเซิร์ฟเวอร์โดยยืนยันรหัสแอดมิน (anon ไม่มีสิทธิ์ DELETE)
 * คืนค่ารูปแบบเดียวกับ supabase: { error }
 */
export async function deleteAsAdmin(
  table: string,
  filters: Record<string, string>,
): Promise<{ error: { message: string } | null }> {
  try {
    const { adminDelete } = await import("@/lib/admin-write.functions");
    const res = await adminDelete({ data: { code: storedAdminCode(), table, filters } });
    if (res?.ok) {
      const { logAudit } = await import("@/lib/audit");
      await logAudit({
        table,
        recordId: filters.id ?? null,
        action: "delete",
        summary: `ลบข้อมูลในตาราง ${table} (${Object.entries(filters).map(([k, v]) => `${k}=${v}`).join(", ")})`,
        changes: filters,
      });
    }
    return res?.ok ? { error: null } : { error: { message: res?.error ?? "ลบไม่สำเร็จ" } };
  } catch (e) {
    return { error: { message: e instanceof Error ? e.message : "ลบไม่สำเร็จ" } };
  }
}

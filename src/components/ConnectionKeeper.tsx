import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/data-client";

/** Recheck the backend when the browser wakes up or regains connectivity. */
export function ConnectionKeeper() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let wasOffline = false;
    let hiddenAt = 0;

    const check = async (refresh = false) => {
      if (disposed || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const { error } = await supabase.from("categories").select("id").limit(1).abortSignal(AbortSignal.timeout(10_000));
        if (disposed) return;
        // เซิร์ฟเวอร์ตอบกลับ = ออนไลน์ แม้เป็น 401/403 (เซสชันหมดอายุ ไม่ใช่เน็ตหลุด)
        const status = (error as { status?: number; code?: string } | null)?.status;
        const connected = !error || (typeof status === "number" && status > 0);
        window.dispatchEvent(new CustomEvent("app:connection-status", { detail: { online: connected } }));
        if (error && (status === 401 || status === 403)) {
          window.dispatchEvent(new Event("app:session-expired"));
        }
        if (connected) {
          if (wasOffline || refresh) {
            void queryClient.invalidateQueries();
            window.dispatchEvent(new Event("app:connection-restored"));
          }
        }
        wasOffline = !connected;
      } catch {
        if (!disposed) {
          wasOffline = true;
          window.dispatchEvent(new CustomEvent("app:connection-status", { detail: { online: false } }));
        }
      } finally {
        inFlight = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else void check(hiddenAt > 0 && Date.now() - hiddenAt > 60_000);
    };
    void check();
    const timer = window.setInterval(() => { void check(); }, 60_000);
    const onWake = () => { void check(); };
    const onOffline = () => {
      wasOffline = true;
      window.dispatchEvent(new CustomEvent("app:connection-status", { detail: { online: false } }));
    };
    window.addEventListener("online", onWake);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("online", onWake);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [queryClient]);

  return null;
}
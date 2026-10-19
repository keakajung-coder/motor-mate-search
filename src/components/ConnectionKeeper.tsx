import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/data-client";
import { clearOfflineCache } from "@/lib/offline";

/** Timeout for a single reachability check; slow answers never count as offline. */
export const CHECK_TIMEOUT_MS = 15_000;
/** Consecutive network failures (with the browser still reporting online) before showing offline. */
export const NETWORK_FAILURES_FOR_OFFLINE = 2;

const emitStatus = (online: boolean) =>
  window.dispatchEvent(new CustomEvent("app:connection-status", { detail: { online } }));

/**
 * Status always starts online and is never persisted. Offline is shown only when the
 * browser reports no internet, or repeated hard network failures occur — never for slow replies.
 */
export function ConnectionKeeper() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let offlineShown = false;
    let networkFailures = 0;
    let hiddenAt = 0;

    const setOnline = (online: boolean) => {
      offlineShown = !online;
      emitStatus(online);
    };

    const reload = () => {
      void queryClient.invalidateQueries();
      window.dispatchEvent(new Event("app:connection-restored"));
    };

    const check = async (refresh = false) => {
      if (disposed || inFlight) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setOnline(false);
        return;
      }
      inFlight = true;
      try {
        const { error, status } = await supabase
          .from("categories")
          .select("id")
          .limit(1)
          .abortSignal(AbortSignal.timeout(CHECK_TIMEOUT_MS));
        if (disposed) return;
        const answered = typeof status === "number" && status > 0;
        if (!error || answered) {
          networkFailures = 0;
          const wasOffline = offlineShown;
          setOnline(true);
          if (error && (status === 401 || status === 403)) window.dispatchEvent(new Event("app:session-expired"));
          if (wasOffline || refresh) reload();
          return;
        }
        // No HTTP answer: timeout/abort means slow, not offline.
        const msg = `${error.message ?? ""} ${(error as { details?: string }).details ?? ""}`;
        if (/abort|timeout/i.test(msg)) return;
        networkFailures += 1;
        if (networkFailures >= NETWORK_FAILURES_FOR_OFFLINE) setOnline(false);
      } catch (e) {
        if (disposed) return;
        const name = e instanceof Error ? e.name : "";
        if (name === "AbortError" || name === "TimeoutError") return;
        networkFailures += 1;
        if (networkFailures >= NETWORK_FAILURES_FOR_OFFLINE) setOnline(false);
      } finally {
        inFlight = false;
      }
    };

    // Fresh start: online, old offline cache removed, real data reloaded immediately.
    clearOfflineCache();
    setOnline(true);
    void check(true);

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") void check();
    }, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else void check(hiddenAt > 0 && Date.now() - hiddenAt > 60_000);
    };
    const onOnline = () => {
      networkFailures = 0;
      setOnline(true);
      void check(true);
    };
    const onOffline = () => setOnline(false);
    const onFocus = () => { void check(offlineShown); };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [queryClient]);

  return null;
}

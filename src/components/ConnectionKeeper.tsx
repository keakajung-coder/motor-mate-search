import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.expires_at && session.expires_at * 1000 - Date.now() < 120_000) {
          await supabase.auth.refreshSession();
        }

        const { error } = await supabase.from("categories").select("id").limit(1).abortSignal(AbortSignal.timeout(10_000));
        const connected = !error || !!error.code;
        if (disposed) return;
        window.dispatchEvent(new CustomEvent("app:connection-status", { detail: { online: connected } }));
        if (connected) {
          if (supabase.getChannels().length > 0 && !supabase.realtime.isConnected()) supabase.realtime.connect();
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
    window.addEventListener("online", onWake);
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("online", onWake);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [queryClient]);

  return null;
}
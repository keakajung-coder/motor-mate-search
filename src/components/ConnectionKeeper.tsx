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

    const check = async () => {
      if (disposed || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.expires_at && session.expires_at * 1000 - Date.now() < 120_000) {
          await supabase.auth.refreshSession();
        }

        // A database response (even an authorization error) proves the connection is alive.
        const { error } = await supabase.from("categories").select("id").limit(1);
        const connected = !error || !!error.code;
        if (disposed) return;
        window.dispatchEvent(new CustomEvent("app:connection-status", { detail: { online: connected } }));
        if (connected) {
          supabase.realtime.connect();
          if (wasOffline) {
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

    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    void check();
    const timer = window.setInterval(() => { void check(); }, 60_000);
    window.addEventListener("online", check);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("online", check);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [queryClient]);

  return null;
}
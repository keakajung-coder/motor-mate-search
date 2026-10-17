import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Query-builder compatibility; business requests go through the session-gated server, never the public Data API. */
export const supabase = createClient<Database>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (!/^\/(rest|storage)\/v1\//.test(url.pathname)) throw new Error("Unsupported business request");
    const headers = new Headers(init?.headers);
    headers.delete("authorization"); headers.delete("apikey");
    return fetch(`/api/data${url.pathname}${url.search}`, { ...init, headers, credentials: "same-origin" });
  } },
});
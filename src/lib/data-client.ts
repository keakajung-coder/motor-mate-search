import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { clearOfflineCache } from "@/lib/offline";

const RETRIES = 3;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retries reads/idempotent requests up to 3 times on network errors or 5xx; writes are never replayed. */
async function fetchWithRetry(url: string, init: RequestInit | undefined): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const retryable = method === "GET" || method === "HEAD";
  let lastError: unknown;
  for (let attempt = 0; attempt <= (retryable ? RETRIES : 0); attempt++) {
    if (attempt > 0) await wait(500 * 2 ** (attempt - 1));
    if (init?.signal?.aborted) break;
    try {
      const res = await fetch(url, init);
      if (res.status < 500 || !retryable || attempt === RETRIES) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")) throw e;
      lastError = e;
    }
  }
  clearOfflineCache();
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("app:connection-unstable"));
  throw lastError instanceof Error ? lastError : new Error("เชื่อมต่อไม่สำเร็จ");
}

/** Query-builder compatibility; business requests go through the session-gated server, never the public Data API. */
export const supabase = createClient<Database>(`${typeof window === "undefined" ? "http://localhost:8080" : window.location.origin}/api/data`, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const path = url.pathname.replace(/^\/api\/data/, "");
    if (!/^\/(rest|storage)\/v1\//.test(path)) throw new Error("Unsupported business request");
    const headers = new Headers(init?.headers);
    headers.delete("authorization"); headers.delete("apikey");
    return fetchWithRetry(`/api/data${path}${url.search}`, { ...init, headers, credentials: "same-origin" });
  } },
});

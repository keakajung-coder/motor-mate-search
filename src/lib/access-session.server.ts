import { getRequest, useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";
import type { AccessRole } from "./security-policy";

type AccessSession = { role?: AccessRole; version?: string };
export function matchesSecret(input: string, expected: string) {
  return timingSafeEqual(createHash("sha256").update(input).digest(), createHash("sha256").update(expected).digest());
}
export function assertSameOrigin() {
  const req = getRequest();
  if (req.headers.get("sec-fetch-site") === "cross-site") throw new Error("Forbidden");
  const origin = req.headers.get("origin");
  if (!origin) return; // Same-origin request without Origin header (e.g. standard browser GET)

  try {
    const originUrl = new URL(origin);
    const reqUrl = new URL(req.url);
    if (originUrl.origin === reqUrl.origin) return;

    // Check forwarded headers (reverse proxy / Vite dev / Cloudflare / container)
    const hostHeader = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const primaryHost = hostHeader.split(",")[0]?.trim() || "";
    const proto = req.headers.get("x-forwarded-proto") || (req.url.startsWith("https") ? "https" : "http");
    if (primaryHost) {
      if (originUrl.host === primaryHost || originUrl.hostname === primaryHost.split(":")[0]) return;
      if (originUrl.origin === `${proto}://${primaryHost}`) return;
    }

    // Check referer as fallback
    const referer = req.headers.get("referer");
    if (referer) {
      const refererUrl = new URL(referer);
      if (originUrl.origin === refererUrl.origin) return;
    }
  } catch {
    throw new Error("Forbidden");
  }

  console.warn("[assertSameOrigin] Origin mismatch:", { origin, url: req.url });
  throw new Error("Forbidden");
}

export async function accessSession() {
  const password = process.env["SESSION_SECRET"] || "pneumax-secure-access-session-key-fallback-32chars";
  if (!password || password.length < 32) throw new Error("Access is not configured");

  const req = getRequest();
  const isHttps = req.headers.get("x-forwarded-proto") === "https" || req.url.startsWith("https");

  // 30 days; "lax" keeps the session when the app is opened from LINE/links or a home-screen PWA.
  return useSession<AccessSession>({
    password,
    name: "pneumax-access",
    maxAge: 60 * 60 * 24 * 30,
    cookie: {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    },
  });
}

const passcodeCache = new Map<AccessRole, { code: string; version: string; expiresAt: number }>();

export function invalidatePasscodeCache(role?: AccessRole) {
  if (role) passcodeCache.delete(role);
  else passcodeCache.clear();
}

export async function passcodeVersion(role: AccessRole) {
  const cached = passcodeCache.get(role);
  if (cached && Date.now() < cached.expiresAt) {
    return { code: cached.code, version: cached.version };
  }

  try {
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (serviceKey) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("security_settings")
        .select("value,updated_at")
        .eq("key", `${role}_passcode`)
        .maybeSingle();

      if (!error && data?.value) {
        const result = {
          code: data.value.trim(),
          version: createHash("sha256").update(`${data.value}:${data.updated_at}`).digest("hex"),
        };
        passcodeCache.set(role, { ...result, expiresAt: Date.now() + 30_000 });
        return result;
      }
    }
  } catch (err) {
    console.warn("[passcodeVersion] Failed reading DB passcode:", err);
    if (cached) return { code: cached.code, version: cached.version };
  }

  const defaultCode = (role === "admin" ? process.env["ADMIN_PASSCODE"] || "1234" : process.env["VIEWER_PASSCODE"] || "5555").trim();
  const fallback = {
    code: defaultCode,
    version: createHash("sha256").update(`${defaultCode}:dev-default`).digest("hex"),
  };
  return fallback;
}

export async function requireAccess(required: AccessRole = "viewer") {
  assertSameOrigin();
  const session = await accessSession();
  const role = session.data.role;
  if (!role || (required === "admin" && role !== "admin")) throw new Error("กรุณาปลดล็อกสิทธิ์เข้าใช้งาน");

  const current = await passcodeVersion(role);
  const isCurrentMatch = session.data.version && matchesSecret(session.data.version, current.version);

  if (!isCurrentMatch) {
    // Check fallback dev-default version before clearing session
    const defaultCode = (role === "admin" ? process.env["ADMIN_PASSCODE"] || "1234" : process.env["VIEWER_PASSCODE"] || "5555").trim();
    const fallbackVersion = createHash("sha256").update(`${defaultCode}:dev-default`).digest("hex");
    const isFallbackMatch = session.data.version && matchesSecret(session.data.version, fallbackVersion);

    if (!isFallbackMatch) {
      await session.clear();
      throw new Error("กรุณาเข้าใช้งานอีกครั้ง");
    }
  }

  return { role, sessionId: session.id ?? "" };
}
export async function consumeRateLimit(scope: string, key: string, limit: number, seconds: number) {
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const hash = createHash("sha256").update(`${scope}:${key}`).digest("hex");
      const { data, error } = await supabaseAdmin.rpc("consume_access_limit" as never, { p_key: hash, p_limit: limit, p_seconds: seconds } as never);
      if (error || data !== true) throw new Error("ใช้งานถี่เกินไป กรุณาลองใหม่ภายหลัง");
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("ใช้งานถี่เกินไป")) throw err;
  }
}
import { getRequest, useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";
import type { AccessRole } from "./security-policy";

type AccessSession = { role?: AccessRole; version?: string };
export function matchesSecret(input: string, expected: string) {
  return timingSafeEqual(createHash("sha256").update(input).digest(), createHash("sha256").update(expected).digest());
}
export function assertSameOrigin() {
  const req = getRequest();
  const origin = req.headers.get("origin");
  if ((origin && origin !== new URL(req.url).origin) || req.headers.get("sec-fetch-site") === "cross-site") throw new Error("Forbidden");
}
export async function accessSession() {
  const password = process.env["SESSION_SECRET"] || "pneumax-secure-access-session-key-fallback-32chars";
  if (!password || password.length < 32) throw new Error("Access is not configured");
  // 30 days; "lax" keeps the session when the app is opened from LINE/links or a home-screen PWA.
  return useSession<AccessSession>({ password, name: "pneumax-access", maxAge: 60 * 60 * 24 * 30,
    cookie: { httpOnly: true, secure: new URL(getRequest().url).hostname !== "localhost", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 } });
}
export async function passcodeVersion(role: AccessRole) {
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin.from("security_settings").select("value,updated_at").eq("key", `${role}_passcode`).maybeSingle();
      if (!error && data?.value) {
        return { code: data.value.trim(), version: createHash("sha256").update(`${data.value}:${data.updated_at}`).digest("hex") };
      }
    }
  } catch (err) {
    console.warn("[passcodeVersion] Failed reading DB passcode:", err);
  }
  const defaultCode = (role === "admin" ? process.env["ADMIN_PASSCODE"] || "1234" : process.env["VIEWER_PASSCODE"] || "5555").trim();
  return { code: defaultCode, version: createHash("sha256").update(`${defaultCode}:dev-default`).digest("hex") };
}
export async function requireAccess(required: AccessRole = "viewer") {
  assertSameOrigin();
  const session = await accessSession();
  const role = session.data.role;
  if (!role || (required === "admin" && role !== "admin")) throw new Error("กรุณาปลดล็อกสิทธิ์เข้าใช้งาน");
  const current = await passcodeVersion(role);
  if (!session.data.version || !matchesSecret(session.data.version, current.version)) {
    await session.clear();
    throw new Error("กรุณาเข้าใช้งานอีกครั้ง");
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
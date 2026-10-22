import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const verifyPasscode = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ kind: z.enum(["viewer", "admin"]), code: z.string().max(128) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const { assertSameOrigin, accessSession, passcodeVersion, matchesSecret, consumeRateLimit } = await import("./access-session.server");
      assertSameOrigin();
      const req = getRequest();
      await consumeRateLimit("login", req.headers.get("cf-connecting-ip") ?? "shared", 10, 900);
      const expected = await passcodeVersion(data.kind);
      if (!data.code.trim() || !matchesSecret(data.code.trim(), expected.code)) return { ok: false };
      const session = await accessSession();
      await session.update({ role: data.kind, version: expected.version });
      return { ok: true };
    } catch { return { ok: false }; }
  });

export const getAccessStatus = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const { requireAccess } = await import("./access-session.server");
    const { role } = await requireAccess();
    return { viewerOk: true, isAdmin: role === "admin" };
  } catch { return { viewerOk: false, isAdmin: false }; }
});
export const lockAccess = createServerFn({ method: "POST" })
  .inputValidator((d: { adminOnly: boolean }) => d)
  .handler(async ({ data }) => {
    const { accessSession, assertSameOrigin, passcodeVersion } = await import("./access-session.server");
    assertSameOrigin();
    const session = await accessSession();
    if (data.adminOnly && session.data.role) {
      const viewer = await passcodeVersion("viewer");
      await session.update({ role: "viewer", version: viewer.version });
    } else await session.clear();
    return { ok: true };
  });
export const refreshSession = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const { requireAccess, accessSession, passcodeVersion } = await import("./access-session.server");
    const { role } = await requireAccess();
    const session = await accessSession();
    const current = await passcodeVersion(role);
    await session.update({ role, version: current.version });
    return { ok: true, role };
  } catch {
    return { ok: false };
  }
});

export const updatePasscodes = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ currentAdminCode: z.string().max(128), viewerCode: z.string().max(128).optional(), adminCode: z.string().max(128).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAccess, passcodeVersion, matchesSecret, accessSession, invalidatePasscodeCache } = await import("./access-session.server");
    await requireAccess("admin");
    const current = await passcodeVersion("admin");
    if (!matchesSecret(data.currentAdminCode.trim(), current.code)) return { ok: false as const, error: "รหัสแอดมินปัจจุบันไม่ถูกต้อง" };
    const updates = [{ key: "viewer_passcode", value: data.viewerCode?.trim() ?? "" }, { key: "admin_passcode", value: data.adminCode?.trim() ?? "" }].filter((r) => r.value);
    if (!updates.length) return { ok: false as const, error: "ยังไม่ได้กรอกรหัสใหม่" };
    if (updates.some((r) => r.value.length < 12)) return { ok: false as const, error: "รหัสใหม่ต้องมีอย่างน้อย 12 ตัวอักษร" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const row of updates) {
      const { error } = await supabaseAdmin.from("security_settings").update({ value: row.value }).eq("key", row.key);
      if (error) return { ok: false as const, error: "บันทึกรหัสไม่สำเร็จ" };
    }
    invalidatePasscodeCache();
    const session = await accessSession();
    const refreshed = await passcodeVersion("admin");
    await session.update({ role: "admin", version: refreshed.version });
    return { ok: true as const, changedAdmin: !!data.adminCode?.trim() };
  });

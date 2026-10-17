import { createServerFn } from "@tanstack/react-start";

const SETTING_KEYS = {
  token: "line_channel_token",
  targets: "line_target_ids",
  email: "alert_email",
} as const;

async function readSettings() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("security_settings")
    .select("key, value")
    .in("key", [SETTING_KEYS.token, SETTING_KEYS.targets, SETTING_KEYS.email]);
  const map = new Map((data ?? []).map((r) => [r.key, r.value ?? ""]));
  return {
    token: (map.get(SETTING_KEYS.token) ?? "").trim(),
    targets: (map.get(SETTING_KEYS.targets) ?? "")
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    email: (map.get(SETTING_KEYS.email) ?? "").trim(),
  };
}

async function verifyAdmin(_code: string) {
  const { requireAccess } = await import("./access-session.server");
  await requireAccess("admin");
  return true;
}

async function pushLine(token: string, targets: string[], text: string) {
  const results: { to: string; ok: boolean; error?: string }[] = [];
  for (const to of targets) {
    try {
      const res = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error(`LINE push failed [${res.status}]: ${body}`);
        results.push({ to, ok: false, error: `${res.status} ${body}` });
      } else {
        results.push({ to, ok: true });
      }
    } catch (e) {
      results.push({ to, ok: false, error: e instanceof Error ? e.message : "network error" });
    }
  }
  return results;
}

/** ส่งแจ้งเตือนเข้า Line (Messaging API) ให้แอดมินทุกคนที่ตั้งค่าไว้ */
export const sendAdminAlert = createServerFn({ method: "POST" })
  .inputValidator((d: { title: string; body?: string; link?: string }) => d)
  .handler(async ({ data }) => {
    const { requireAccess, consumeRateLimit } = await import("./access-session.server");
    const access = await requireAccess();
    await consumeRateLimit("line", access.sessionId, 20, 60);
    const settings = await readSettings();
    const text = [data.title, data.body ?? "", data.link ? `ลิงก์: ${data.link}` : ""]
      .filter(Boolean)
      .join("\n");

    if (!settings.token || settings.targets.length === 0) {
      return { line: "skipped" as const, email: "skipped" as const };
    }
    const results = await pushLine(settings.token, settings.targets, text);
    const sent = results.filter((r) => r.ok).length;
    return {
      line: sent > 0 ? ("sent" as const) : ("failed" as const),
      email: "skipped" as const,
      errors: results.filter((r) => !r.ok).map((r) => r.error ?? ""),
    };
  });

/** ส่งแจ้งเตือนเข้า Line ให้ผู้ใช้ (ลูกค้า/ช่าง) ตาม LINE ID ที่ผูกไว้ในโปรไฟล์ */
export const sendUserAlert = createServerFn({ method: "POST" })
  .inputValidator((d: { lineIds: string[]; title: string; body?: string; link?: string }) => d)
  .handler(async ({ data }) => {
    const { requireAccess, consumeRateLimit } = await import("./access-session.server");
    const access = await requireAccess();
    await consumeRateLimit("line", access.sessionId, 20, 60);
    const settings = await readSettings();
    // LINE Messaging API ส่งได้เฉพาะ userId (U…) / groupId (C…) / roomId (R…) เท่านั้น
    const targets = Array.from(
      new Set(
        (data.lineIds ?? [])
          .map((s) => String(s ?? "").trim())
          .filter((s) => /^[UCR][0-9a-f]{20,}$/i.test(s)),
      ),
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const allowed = new Set(settings.targets);
    for (const table of ["customers", "service_staff", "sales_contacts"] as const) {
      const { data: contacts } = await supabaseAdmin.from(table).select("line_id").not("line_id", "is", null);
      for (const contact of contacts ?? []) if (contact.line_id) allowed.add(contact.line_id.trim());
    }
    if (targets.length > 50 || targets.some((id) => !allowed.has(id))) throw new Error("Invalid recipients");
    if (!settings.token || targets.length === 0) return { line: "skipped" as const, sent: 0 };
    const text = [data.title, data.body ?? "", data.link ? `ลิงก์: ${data.link}` : ""]
      .filter(Boolean)
      .join("\n");
    const results = await pushLine(settings.token, targets, text);
    const sent = results.filter((r) => r.ok).length;
    return { line: sent > 0 ? ("sent" as const) : ("failed" as const), sent };
  });

/** อ่านค่าตั้งค่าแจ้งเตือน (ต้องใช้รหัสแอดมิน, ซ่อนโทเคนบางส่วน) */
export const getAlertSettings = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data }) => {
    if (!(await verifyAdmin(data.code))) return { ok: false as const, error: "ต้องปลดล็อกแอดมินก่อน" };
    const s = await readSettings();
    return {
      ok: true as const,
      hasToken: s.token.length > 0,
      tokenPreview: s.token ? "••••••••" : "",
      targets: s.targets.join("\n"),
      email: s.email,
    };
  });

/** บันทึกค่าตั้งค่าแจ้งเตือน (โทเคน Line / ปลายทาง / อีเมล) */
export const saveAlertSettings = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; token?: string; targets?: string; email?: string }) => d)
  .handler(async ({ data }) => {
    if (!(await verifyAdmin(data.code))) return { ok: false as const, error: "ต้องปลดล็อกแอดมินก่อน" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows: { key: string; value: string }[] = [];
    if (typeof data.token === "string" && data.token.trim())
      rows.push({ key: SETTING_KEYS.token, value: data.token.trim() });
    if (typeof data.targets === "string") rows.push({ key: SETTING_KEYS.targets, value: data.targets.trim() });
    if (typeof data.email === "string") rows.push({ key: SETTING_KEYS.email, value: data.email.trim() });
    for (const r of rows) {
      const { data: exists } = await supabaseAdmin
        .from("security_settings")
        .select("id")
        .eq("key", r.key)
        .maybeSingle();
      const { error } = exists
        ? await supabaseAdmin.from("security_settings").update({ value: r.value }).eq("key", r.key)
        : await supabaseAdmin.from("security_settings").insert({ key: r.key, value: r.value });
      if (error) return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  });

/** ส่งข้อความทดสอบเข้า Line */
export const testAdminAlert = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data }) => {
    if (!(await verifyAdmin(data.code))) return { ok: false as const, error: "ต้องปลดล็อกแอดมินก่อน" };
    const s = await readSettings();
    if (!s.token) return { ok: false as const, error: "ยังไม่ได้ใส่ Channel Access Token" };
    if (s.targets.length === 0) return { ok: false as const, error: "ยังไม่ได้ใส่ User ID / Group ID" };
    const results = await pushLine(s.token, s.targets, "ทดสอบแจ้งเตือนจากระบบอะไหล่ปั๊มลม ✅");
    const failed = results.filter((r) => !r.ok);
    if (failed.length === results.length)
      return { ok: false as const, error: failed[0]?.error ?? "ส่งไม่สำเร็จ" };
    return { ok: true as const, sent: results.length - failed.length, failed: failed.length };
  });

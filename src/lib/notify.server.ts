// Shared LINE Messaging helpers (same settings/targets as new work-order alerts → "fox").
export const SETTING_KEYS = {
  token: "line_channel_token",
  targets: "line_target_ids",
  email: "alert_email",
} as const;

export async function readSettings() {
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

export async function pushLine(token: string, targets: string[], text: string) {
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


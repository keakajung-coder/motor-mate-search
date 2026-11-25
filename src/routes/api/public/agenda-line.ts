import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Scheduled 08:00 (today) / 15:30 (tomorrow) Bangkok agenda push to the existing LINE "fox" targets.
export const Route = createFileRoute("/api/public/agenda-line")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        let slot = "";
        try { slot = String(((await request.json()) as { slot?: unknown })?.slot ?? ""); } catch { /* invalid */ }
        if (slot !== "morning" && slot !== "afternoon") return new Response("Bad slot", { status: 400 });
        const { bangkokToday, shiftIsoDate, agendaForDate, formatAgendaLine } = await import("@/lib/daily-agenda");
        const date = shiftIsoDate(bangkokToday(), slot === "afternoon" ? 1 : 0);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("appointments")
          .select("id, work_order_id, visit_date, visit_time, customer_name, customer_address, customer_location, cust_id, serial_number, machine_label, service_type, job_detail, staff_name, sales_rep, vehicle_plate, status")
          .eq("visit_date", date);
        if (error) return Response.json({ ok: false, error: "query failed" }, { status: 500 });
        const all = data ?? [];
        const jobs = agendaForDate(all, date, { isAdmin: true, role: "admin", userName: "" });
        const prefix = slot === "afternoon" ? "🚐 พรุ่งนี้ไปไหน\n" : "🚐 วันนี้ไปไหน\n";
        const text = prefix + formatAgendaLine(date, jobs, all);
        const { readSettings, pushLine } = await import("@/lib/notify.server");
        const s = await readSettings();
        if (!s.token || !s.targets.length) return Response.json({ ok: false, line: "skipped" });
        const results = await pushLine(s.token, s.targets, text);
        const sent = results.filter((r) => r.ok).length;
        return Response.json({ ok: sent > 0, date, jobs: jobs.length, sent });
      },
    },
  },
});

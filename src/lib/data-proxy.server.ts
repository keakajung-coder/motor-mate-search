import { requireAccess } from "./access-session.server";
import { canAccessTable } from "./security-policy";
import { reviewVehicleZone } from "./vehicle-zone.server";
import type { ZoneJob } from "./vehicle-zone";

const BUCKETS = new Set(["product-images", "job-attachments"]);
export async function proxyBusinessRequest(request: Request) {
  try {
    const { role } = await requireAccess();
    const url = new URL(request.url);
    const path = url.pathname.slice("/api/data".length);
    const method = request.method;
    let body: ArrayBuffer | string | undefined;
    if (path.startsWith("/rest/v1/")) {
      const table = path.slice("/rest/v1/".length);
      if (!canAccessTable(role, table, method)) return Response.json({ message: "Forbidden" }, { status: 403 });
      if (!/^[a-z_]+$/.test(table)) return Response.json({ message: "Forbidden" }, { status: 403 });
      if (method === "PATCH" && !Array.from(url.searchParams.keys()).some((k) => !["select", "order", "limit", "offset", "on_conflict"].includes(k))) return Response.json({ message: "A filter is required" }, { status: 400 });
      if (method === "POST" || method === "PATCH") {
        const text = await request.text();
        if (text.length > 2_000_000) return Response.json({ message: "Too large" }, { status: 413 });
        const payload = JSON.parse(text);
        const rows = Array.isArray(payload) ? payload : [payload];
        if (rows.length > 2000 || rows.some((r) => !r || typeof r !== "object" || Array.isArray(r))) return Response.json({ message: "Invalid records" }, { status: 400 });
        if (table === "audit_log") for (const row of rows) row.actor = role;
        if (table === "appointments" || table === "work_orders") {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          let existing: Record<string, unknown>[] = [];
          if (method === "PATCH") {
            const base = process.env["SUPABASE_URL"];
            const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
            if (!base || !key) throw new Error("Unavailable");
            const filters = new URLSearchParams(url.search);
            for (const k of ["select", "order", "limit", "offset", "on_conflict"]) filters.delete(k);
            const h = new Headers({ apikey: key });
            if (!key.startsWith("sb_")) h.set("authorization", `Bearer ${key}`);
            const response = await fetch(`${base}/rest/v1/${table}?${filters}&select=*`, { headers: h });
            if (!response.ok) throw new Error("อ่านงานก่อนตรวจจังหวัดไม่สำเร็จ");
            existing = await response.json();
          }
          for (const row of rows) {
            const signature = row.__zone_signature;
            delete row.__zone_signature;
            // Approval is always derived server-side, never trusted from form data.
            delete row.cross_zone_approval;
            const scheduleChanged = method === "POST" || ["vehicle_plate", "visit_date", "customer_address", "customer_name", "cust_id", "serial_number"].some(k => k in row);
            if (!scheduleChanged) continue;
            const targets = method === "POST" ? [row] : existing.map(current => ({ ...current, ...row }));
            if (targets.length > 1) return Response.json({ message: "กรุณาจัดงานและอนุมัติข้ามโซนทีละใบงาน" }, { status: 400 });
            for (const target of targets) {
              const job = { ...target, work_order_id: table === "work_orders" ? target.id : target.work_order_id } as ZoneJob;
              const review = await reviewVehicleZone(supabaseAdmin, job);
              const previous = existing.find(r => r.id === target.id)?.cross_zone_approval as { signature?: string } | null;
              if (review.conflicts.length && previous?.signature !== review.signature && !(role === "admin" && signature === review.signature)) {
                return Response.json({ code: "VEHICLE_ZONE_APPROVAL_REQUIRED", message: "รถมีงานข้ามโซน", review }, { status: 409, headers: { "cache-control": "no-store" } });
              }
              row.cross_zone_approval = review.conflicts.length ? { ...review, approved_at: new Date().toISOString(), approved_by: "admin" } : null;
            }
          }
        }
        if (role === "viewer") {
          if (rows.some((r) => "line_id" in r)) return Response.json({ message: "Only admins can configure notification recipients" }, { status: 403 });
          if (table === "troubleshooting_issues" && rows.some((r) => r.status !== "pending" || r.ai_check_draft || r.ai_fix_draft || r.answered_at)) return Response.json({ message: "Publishing answers requires admin" }, { status: 403 });
          if ((request.headers.get("prefer") ?? "").includes("resolution=merge-duplicates")) return Response.json({ message: "An explicit authorized edit is required" }, { status: 403 });
          if (method === "POST" && table === "work_orders" && rows.some((r) => r.status !== "pending" || r.approved_hidden === true)) return Response.json({ message: "Approval requires admin" }, { status: 403 });
          if (method === "PATCH" && table === "work_orders" && rows.some((r) => "status" in r && r.status !== "pending")) return Response.json({ message: "Approval requires admin" }, { status: 403 });
          if (method === "PATCH" && table === "notifications" && rows.some((r) => Object.keys(r).some((k) => k !== "read"))) return Response.json({ message: "Forbidden" }, { status: 403 });
        }
        body = JSON.stringify(payload);
      }
    } else if (path.startsWith("/storage/v1/object/")) {
      const pieces = path.split("/").filter(Boolean);
      let bucket = "";
      let isSign = false;
      let objectPath = "";
      if (pieces[3] === "sign") {
        isSign = true;
        bucket = pieces[4] || "";
        objectPath = pieces.slice(5).join("/");
      } else if (pieces[3] === "upload" && pieces[4] === "sign") {
        bucket = pieces[5] || "";
        objectPath = pieces.slice(6).join("/");
      } else if (pieces[3] === "authenticated") {
        bucket = pieces[4] || "";
        objectPath = pieces.slice(5).join("/");
      } else {
        bucket = pieces[3] || "";
        objectPath = pieces.slice(4).join("/");
      }

      if (!bucket || !BUCKETS.has(bucket)) return Response.json({ message: "Forbidden" }, { status: 403 });

      if (isSign && method === "POST") {
        // Return an authenticated URL instead of a bearer link lasting years.
        if (!objectPath) return Response.json({ message: "Invalid path" }, { status: 400 });
        return Response.json({ signedURL: `/object/authenticated/${bucket}/${objectPath}` }, { headers: { "cache-control": "no-store" } });
      }

      if (!["GET", "HEAD", "POST", "DELETE"].includes(method) || (bucket === "product-images" && method !== "GET" && method !== "HEAD" && role !== "admin")) {
        return Response.json({ message: "Forbidden" }, { status: 403 });
      }
      if (method === "DELETE" && role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });

      if (method === "POST") {
        const type = (request.headers.get("content-type") ?? "").toLowerCase();
        const ext = objectPath.split(".").pop()?.toLowerCase() ?? "";

        const isImage = /image\/(jpeg|jpg|png|webp|gif|heic|heif)/.test(type) || /^(jpe?g|png|webp|gif|heic|heif)$/.test(ext);
        const isVideo = /video\/(mp4|webm|quicktime|x-matroska|3gpp)/.test(type) || /^(mp4|webm|mov|quicktime)$/.test(ext);
        const isMultipart = type.startsWith("multipart/form-data");

        if (bucket === "product-images" && !isImage && (!isMultipart || !/^(jpe?g|png|webp|gif)$/.test(ext))) {
          return Response.json({ message: "Images only (jpg, png, webp, gif)" }, { status: 400 });
        }

        if (bucket === "job-attachments" && !isImage && !isVideo && (!isMultipart || !/^(jpe?g|png|webp|gif|heic|heif|mp4|webm|mov)$/.test(ext))) {
          return Response.json({ message: "Unsupported file format" }, { status: 400 });
        }

        body = await request.arrayBuffer();
        const maxBytes = (bucket === "product-images" ? 10 : 50) * 1024 * 1024;
        if (body.byteLength > maxBytes) return Response.json({ message: "Too large" }, { status: 413 });
      } else if (method === "DELETE") {
        body = await request.text();
      }
    } else return Response.json({ message: "Forbidden" }, { status: 403 });

    const base = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
    if (!base || !key) throw new Error("Unavailable");
    const headers = new Headers();
    for (const name of ["content-type", "prefer", "range", "range-unit", "accept", "x-upsert"]) {
      const value = request.headers.get(name); if (value) headers.set(name, value);
    }
    headers.set("apikey", key);
    if (!key.startsWith("sb_")) headers.set("authorization", `Bearer ${key}`);
    const response = await fetch(`${base}${path}${url.search}`, { method, headers, body, redirect: "manual" });
    const out = new Headers();
    for (const name of ["content-type", "content-range", "content-length"]) { const value = response.headers.get(name); if (value) out.set(name, value); }
    out.set("cache-control", "private, no-store");
    out.set("x-content-type-options", "nosniff");
    return new Response(response.body, { status: response.status, headers: out });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("[data-proxy]", reason);
    if (reason === "Forbidden") {
      return Response.json({ message: "ไม่มีสิทธิ์เข้าถึง (Forbidden)" }, { status: 403, headers: { "cache-control": "no-store" } });
    }
    if (reason.includes("ปลดล็อก") || reason.includes("เข้าใช้งานอีกครั้ง")) {
      return Response.json({ message: reason }, { status: 401, headers: { "cache-control": "no-store" } });
    }
    if (reason.includes("ถี่เกินไป")) {
      return Response.json({ message: reason }, { status: 429, headers: { "cache-control": "no-store" } });
    }
    if (reason === "Unavailable") {
      return Response.json({ message: "บริการไม่พร้อมใช้งานชั่วคราว" }, { status: 503, headers: { "cache-control": "no-store" } });
    }
    return Response.json({ message: reason || "เกิดข้อผิดพลาดในการประมวลผลคำขอ" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
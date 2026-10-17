import { requireAccess } from "./access-session.server";
import { canAccessTable } from "./security-policy";

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
      const operation = pieces[3];
      const isSign = operation === "sign";
      const bucket = isSign || operation === "authenticated" ? pieces[4] : operation;
      if (!bucket || !BUCKETS.has(bucket)) return Response.json({ message: "Forbidden" }, { status: 403 });
      if (isSign && method === "POST") {
        // Return an authenticated URL instead of a bearer link lasting years.
        const object = pieces.slice(5).join("/");
        if (!object) return Response.json({ message: "Invalid path" }, { status: 400 });
        return Response.json({ signedURL: `/object/authenticated/${bucket}/${object}` }, { headers: { "cache-control": "no-store" } });
      }
      if (!["GET", "HEAD", "POST", "DELETE"].includes(method) || (bucket === "product-images" && method !== "GET" && method !== "HEAD" && role !== "admin")) return Response.json({ message: "Forbidden" }, { status: 403 });
      if (method === "DELETE" && role !== "admin") return Response.json({ message: "Forbidden" }, { status: 403 });
      if (method === "POST") {
        const type = request.headers.get("content-type") ?? "";
        if (!/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime))($|;)/.test(type) && !type.startsWith("multipart/form-data")) return Response.json({ message: "Unsupported file" }, { status: 400 });
        if (type.startsWith("multipart/form-data")) {
          const form = await request.clone().formData();
          const files = Array.from(form.values()).filter((v): v is File => typeof v !== "string");
          if (files.length !== 1 || !/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime))$/.test(files[0].type)) return Response.json({ message: "Unsupported file" }, { status: 400 });
          if (bucket === "product-images" && !files[0].type.startsWith("image/")) return Response.json({ message: "Images only" }, { status: 400 });
        }
        body = await request.arrayBuffer();
        if (body.byteLength > (bucket === "product-images" ? 10 : 50) * 1024 * 1024) return Response.json({ message: "Too large" }, { status: 413 });
      } else if (method === "DELETE") body = await request.text();
    } else return Response.json({ message: "Forbidden" }, { status: 403 });

    const base = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"];
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
    return Response.json({ message: "กรุณาเข้าใช้งานอีกครั้ง" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
}
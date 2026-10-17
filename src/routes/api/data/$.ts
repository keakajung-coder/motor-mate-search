import { createFileRoute } from "@tanstack/react-router";

async function handle({ request }: { request: Request }) {
  const { proxyBusinessRequest } = await import("@/lib/data-proxy.server");
  return proxyBusinessRequest(request);
}
export const Route = createFileRoute("/api/data/$")({
  server: { handlers: { GET: handle, HEAD: handle, POST: handle, PATCH: handle, DELETE: handle } },
});
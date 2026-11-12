import { getQueryClient } from "@/lib/query-client";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = getQueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ({ error, reset }) => (
      <div role="alert" style={{ padding: 24, textAlign: "center" }}>
        <p style={{ fontWeight: 600 }}>โหลดไม่สำเร็จ</p>
        <p style={{ fontSize: 14, opacity: 0.7 }}>{error instanceof Error ? error.message : "กรุณาลองใหม่"}</p>
        <button type="button" onClick={() => { router.invalidate(); reset(); }} style={{ marginTop: 12, textDecoration: "underline" }}>ลองอีกครั้ง</button>
      </div>
    ),
  });

  return router;
};

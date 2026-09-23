import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { Wrench, CalendarDays } from "lucide-react";
import { AccessProvider } from "@/lib/access";
import { AccessGate, AdminLockButton } from "@/components/AccessGate";
import { setupPwa } from "@/lib/pwa";
import { useMyIssueReplies } from "@/lib/issue-watch";
import { NotificationBell } from "@/components/NotificationBell";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">ไม่พบหน้านี้</h2>
        <p className="mt-2 text-sm text-muted-foreground">หน้าที่คุณค้นหาไม่มีอยู่หรือถูกย้ายไปแล้ว</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            กลับหน้าแรก
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">โหลดหน้านี้ไม่สำเร็จ</h1>
        <p className="mt-2 text-sm text-muted-foreground">เกิดข้อผิดพลาด ลองรีเฟรชหรือกลับหน้าแรก</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            ลองอีกครั้ง
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            หน้าแรก
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#faf8f3" },
      { title: "ระบบค้นหาอะไหล่ปั๊มลม" },
      { name: "description", content: "ค้นหาอะไหล่ปั๊มลมด้วย S/N เครื่อง" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function NavBar() {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Wrench className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">อะไหล่ปั๊มลม</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/"
            className="rounded-md px-3 py-2 hover:bg-accent [&.active]:bg-accent [&.active]:font-medium"
            activeOptions={{ exact: true }}
          >
            ค้นหา
          </Link>
          <Link
            to="/planner"
            className="flex items-center gap-1 rounded-md px-3 py-2 hover:bg-accent [&.active]:bg-accent [&.active]:font-medium"
          >
            <CalendarDays className="h-4 w-4" />
            ปฏิทิน / แพลนเนอร์
          </Link>

          <Link
            to="/admin"
            className="rounded-md px-3 py-2 hover:bg-accent [&.active]:bg-accent [&.active]:font-medium"
          >
            จัดการข้อมูล
          </Link>
          <NotificationBell />
          <AdminLockButton />
        </nav>
      </div>
    </header>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    setupPwa();
  }, []);
  useMyIssueReplies();

  return (
    <QueryClientProvider client={queryClient}>
      <AccessProvider>
        <AccessGate>
          <div className="min-h-dvh min-w-0 overflow-x-clip bg-background">
            <NavBar />
            <main className="mx-auto min-w-0 max-w-6xl px-3 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-4 sm:py-6 sm:pb-[calc(6rem+env(safe-area-inset-bottom))]">
              <Outlet />
            </main>
          </div>
        </AccessGate>
      </AccessProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

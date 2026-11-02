import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, Component, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
const Dashboard = lazy(() => import("@/components/WeeklySummaryDashboard"));
export const Route = createFileRoute("/weekly-summary")({
  head: () => ({ meta: [
    { title: "สรุปประชุมรายสัปดาห์ - อะไหล่ปั๊มลม" },
    { name: "description", content: "สรุปงานบริการรายสัปดาห์ งานค้าง สถานะเครื่องจักร และกระจายงานช่าง พร้อมรายงาน Excel" },
    { property: "og:title", content: "สรุปประชุมรายสัปดาห์ - อะไหล่ปั๊มลม" },
    { property: "og:description", content: "ติดตามงานบริการ งานค้าง และสถิติช่างตามช่วงวันที่ พร้อมส่งออก Excel" },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: WeeklySummaryPage,
});
function Loading() { return <div role="status" className="flex min-h-64 items-center justify-center gap-3 text-muted-foreground"><Loader2 className="size-5 animate-spin" />กำลังโหลดรายงาน</div>; }
class ReportBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div role="alert" className="space-y-4 py-12 text-center"><h1 className="text-xl font-semibold">โหลดรายงานไม่สำเร็จ</h1><Button variant="outline" onClick={() => window.location.reload()}>ลองอีกครั้ง</Button></div> : this.props.children; }
}
function WeeklySummaryPage() { return <ClientOnly fallback={<Loading />}><ReportBoundary><Suspense fallback={<Loading />}><Dashboard /></Suspense></ReportBoundary></ClientOnly>; }
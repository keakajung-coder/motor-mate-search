import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, Component, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
const Dashboard = lazy(() => import("@/components/RepairTrackingDashboard"));
export const Route = createFileRoute("/repair-tracking")({
  head: () => ({ meta: [
    { title: "ติดตามเครื่องค้างช็อป - อะไหล่ปั๊มลม" },
    { name: "description", content: "รับเครื่องเข้าซ่อม ติดตามสถานะเครื่องค้างช็อป และออกรายงานประชุมประจำสัปดาห์" },
    { property: "og:title", content: "ติดตามเครื่องค้างช็อป - อะไหล่ปั๊มลม" },
    { property: "og:description", content: "บันทึกรับเครื่องเข้าซ่อม อัปเดตสถานะ และสรุปรายงานเครื่องค้างช็อปรายสัปดาห์" },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: RepairTrackingPage,
});
function Loading() { return <div role="status" className="flex min-h-64 items-center justify-center gap-3 text-muted-foreground"><Loader2 className="size-5 animate-spin" />กำลังโหลดข้อมูลเครื่องซ่อม</div>; }
class RepairBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div role="alert" className="space-y-4 py-12 text-center"><h1 className="text-xl font-semibold">โหลดข้อมูลเครื่องซ่อมไม่สำเร็จ</h1><Button variant="outline" onClick={() => window.location.reload()}>ลองอีกครั้ง</Button></div> : this.props.children; }
}
function RepairTrackingPage() { return <ClientOnly fallback={<Loading />}><RepairBoundary><Suspense fallback={<Loading />}><Dashboard /></Suspense></RepairBoundary></ClientOnly>; }

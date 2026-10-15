import { createFileRoute, Link } from "@tanstack/react-router";
import { AccessGate, AdminOnly } from "@/components/AccessGate";
import { TrashTab } from "@/components/admin/TrashTab";
import { ArrowLeft, Trash2, CalendarDays, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/trash")({
  head: () => ({
    meta: [
      { title: "ถังขยะและกู้คืนข้อมูล - อะไหล่ปั๊มลม" },
      {
        name: "description",
        content: "กู้คืนข้อมูลพนักงาน/ช่างที่ถูกลบ (Soft Delete) และรายการข้อมูลอื่นๆ จากถังขยะ",
      },
      { property: "og:title", content: "ถังขยะและกู้คืนข้อมูล" },
      { property: "og:description", content: "กู้คืนข้อมูลพนักงานและรายการที่ถูกลบ" },
    ],
  }),
  component: TrashPage,
});

function TrashPage() {
  return (
    <AccessGate>
      <AdminOnly>
        <div className="space-y-4">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Link to="/admin">
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 px-3 text-xs">
                    <ArrowLeft className="h-3.5 w-3.5" /> จัดการข้อมูล
                  </Button>
                </Link>
                <Link to="/planner">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
                  >
                    <CalendarDays className="h-3.5 w-3.5" /> ปฏิทิน
                  </Button>
                </Link>
              </div>
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                <Trash2 className="h-6 w-6 text-destructive" />
                ถังขยะและกู้คืนข้อมูล (Trash & Restore)
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                กู้คืนพนักงาน/ช่างที่ถูกลบ (Soft Delete)
                เพื่อนำกลับมาใช้งานโดยไม่กระทบประวัติงานย้อนหลัง และกู้คืนข้อมูลอื่นๆ
              </p>
            </div>
          </header>

          <TrashTab />
        </div>
      </AdminOnly>
    </AccessGate>
  );
}

import { useEffect, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Eye, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useAccess } from "@/lib/access";
import {
  dismissPlannerBadge,
  restorePlannerBadge,
  isPlannerBadgeDismissed,
  PLANNER_BADGE_DISMISSAL_EVENT,
  PLANNER_BADGE_DISMISSAL_KEY,
  type PlannerBadgeKind,
} from "@/lib/planner-badge-dismissal";

export function DismissiblePlannerBadge({ jobId, kind, label, className, children }: {
  jobId: string;
  kind: PlannerBadgeKind;
  label: string;
  className: string;
  children: ReactNode;
}) {
  const { isAdmin } = useAccess();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const refresh = () => setHidden(isPlannerBadgeDismissed(jobId, kind));
    refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === PLANNER_BADGE_DISMISSAL_KEY) refresh();
    };
    window.addEventListener(PLANNER_BADGE_DISMISSAL_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PLANNER_BADGE_DISMISSAL_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [jobId, kind]);

  if (hidden) {
    if (!isAdmin) return null;
    const restore = (event: MouseEvent | KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (restorePlannerBadge(jobId, kind)) { setHidden(false); toast.success(`แสดงป้าย${label}อีกครั้งแล้ว`); }
      else toast.error("เบราว์เซอร์ไม่อนุญาตให้บันทึกค่า");
    };
    return (
      <span
        role="button"
        tabIndex={0}
        aria-label={`แสดงป้าย${label}ที่ซ่อนไว้`}
        title={`แสดงป้าย${label}ที่ซ่อนไว้อีกครั้ง`}
        className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-muted-foreground/50 text-muted-foreground hover:bg-muted"
        onClick={restore}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") restore(event); }}
      >
        <Eye className="size-3" aria-hidden />
      </span>
    );
  }

  const dismiss = (event: MouseEvent | KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const persisted = dismissPlannerBadge(jobId, kind);
    setHidden(true);
    if (persisted) toast.success(`ซ่อนป้าย${label}ของใบงานนี้แล้ว`);
    else toast.error(`ซ่อนป้าย${label}แล้วชั่วคราว แต่เบราว์เซอร์ไม่อนุญาตให้จำค่าหลังรีเฟรช`);
  };

  return (
    <Badge variant="outline" className={className}>
      <span>{children}</span>
      {isAdmin && (
        <span
          role="button"
          tabIndex={0}
          aria-label={`ซ่อนป้าย${label}`}
          title={`ซ่อนป้าย${label}เฉพาะใบงานนี้ (เฉพาะเครื่องนี้)`}
          className="-mr-1 inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-background/60"
          onClick={dismiss}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") dismiss(event);
          }}
        >
          <X className="size-3" aria-hidden />
        </span>
      )}
    </Badge>
  );
}

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  countDismissedPlannerBadges,
  restorePlannerBadge,
  PLANNER_BADGE_DISMISSAL_EVENT,
  PLANNER_BADGE_DISMISSAL_KEY,
} from "@/lib/planner-badge-dismissal";

/** Admin toolbar button: show every hidden overlap / cross-zone badge again. */
export function RestoreHiddenBadgesButton() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const refresh = () => setCount(countDismissedPlannerBadges());
    refresh();
    const onStorage = (e: StorageEvent) => { if (e.key === PLANNER_BADGE_DISMISSAL_KEY) refresh(); };
    window.addEventListener(PLANNER_BADGE_DISMISSAL_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PLANNER_BADGE_DISMISSAL_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  if (count === 0) return null;
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        if (restorePlannerBadge()) toast.success(`แสดงป้ายที่ซ่อนไว้ ${count} ป้ายอีกครั้งแล้ว`);
        else toast.error("เบราว์เซอร์ไม่อนุญาตให้บันทึกค่า");
      }}
    >
      <Eye className="size-4" />
      แสดงป้ายที่ซ่อน ({count})
    </Button>
  );
}

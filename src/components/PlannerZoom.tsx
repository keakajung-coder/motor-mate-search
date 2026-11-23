import { useEffect, useRef, type ReactNode } from "react";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PLANNER_ZOOM_DEFAULT,
  clampPlannerZoom,
  pinchPlannerZoom,
  stepPlannerZoom,
} from "@/lib/planner-zoom";

export const PLANNER_ZOOM_KEY = "planner-zoom";

/** ปุ่มซูม + / − / รีเซ็ต ของตารางแพลนเนอร์ */
export function PlannerZoomControls({ zoom, onChange }: { zoom: number; onChange: (z: number) => void }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="ซูมตาราง">
      <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label="ซูมออก" onClick={() => onChange(stepPlannerZoom(zoom, -1))}>
        <ZoomOut className="h-4 w-4" />
      </Button>
      <span className="w-12 text-center text-xs font-semibold tabular-nums">{Math.round(zoom * 100)}%</span>
      <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label="ซูมเข้า" onClick={() => onChange(stepPlannerZoom(zoom, 1))}>
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="รีเซ็ตขนาด" onClick={() => onChange(PLANNER_ZOOM_DEFAULT)}>
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * พื้นที่ตารางที่ซูมได้: ใช้ CSS zoom (เลย์เอาต์และการเลื่อนยังเป็นปกติ)
 * บีบ 2 นิ้วบนจอสัมผัส และ Ctrl/⌘ + ล้อเมาส์ หรือบีบทัชแพดบนคอมพิวเตอร์
 * นิ้วเดียวไม่ถูกแตะต้อง จึงไม่ชนการปัดเลื่อน/แตะเปิดงาน
 */
export function PlannerZoomArea({ zoom, onChange, children }: { zoom: number; onChange: (z: number) => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let pinch: { distance: number; zoom: number } | null = null;
    let frame = 0;
    let pending = 0;
    const distance = (t: TouchList) => {
      const a = t[0], b = t[1];
      if (!a || !b) return 0;
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };
    const apply = (z: number) => {
      pending = z;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (pending !== zoomRef.current) changeRef.current(pending);
      });
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) pinch = { distance: distance(e.touches), zoom: zoomRef.current };
    };
    const onMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      apply(pinchPlannerZoom(pinch.zoom, pinch.distance, distance(e.touches)));
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      apply(clampPlannerZoom((pending || zoomRef.current) * Math.exp(-dy * 0.002)));
    };
    // Safari (iPad/iPhone) ยิง gesture event ของตัวเอง — กันไม่ให้ทั้งหน้าซูม
    const stopGesture = (e: Event) => e.preventDefault();
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", stopGesture);
    el.addEventListener("gesturechange", stopGesture);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", stopGesture);
      el.removeEventListener("gesturechange", stopGesture);
    };
  }, []);

  return (
    <div ref={ref} className="planner-zoom-area">
      <div style={{ zoom }}>{children}</div>
    </div>
  );
}

/** ขอบเขตและขั้นการซูมตารางแพลนเนอร์ (ค่าล้วน ทดสอบได้) */
export const PLANNER_ZOOM_MIN = 0.5;
export const PLANNER_ZOOM_MAX = 2;
export const PLANNER_ZOOM_STEP = 0.1;
export const PLANNER_ZOOM_DEFAULT = 1;

export function clampPlannerZoom(value: number): number {
  if (!Number.isFinite(value)) return PLANNER_ZOOM_DEFAULT;
  const clamped = Math.min(PLANNER_ZOOM_MAX, Math.max(PLANNER_ZOOM_MIN, value));
  return Math.round(clamped * 100) / 100;
}

export function stepPlannerZoom(value: number, direction: 1 | -1): number {
  return clampPlannerZoom(value + direction * PLANNER_ZOOM_STEP);
}

/** อัตราส่วนระยะห่างสองนิ้ว คูณกับค่าซูมตอนเริ่มบีบ */
export function pinchPlannerZoom(startZoom: number, startDistance: number, distance: number): number {
  if (startDistance <= 0) return clampPlannerZoom(startZoom);
  return clampPlannerZoom(startZoom * (distance / startDistance));
}

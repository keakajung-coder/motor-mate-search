import { reviewVehicleAssignment } from "./vehicle-zone.functions";
import type { ZoneJob, ZoneReview } from "./vehicle-zone";

export type ZoneDecision = { approve: true } | { vehicle: string } | null;
export const approvedZoneSignatures = new Set<string>();
export function requestZoneDecision(review: ZoneReview): Promise<ZoneDecision> {
  return new Promise(resolve => window.dispatchEvent(new CustomEvent("app:zone-review", { detail: { review, resolve } })));
}
export async function chooseVehicleForJob(job: ZoneJob): Promise<string | null> {
  let candidate = job;
  for (;;) {
    const review = await reviewVehicleAssignment({ data: candidate });
    if (!review.conflicts.length || approvedZoneSignatures.has(review.signature)) return candidate.vehicle_plate ?? "";
    const decision = await requestZoneDecision(review);
    if (!decision) return null;
    if ("approve" in decision) { approvedZoneSignatures.add(review.signature); return candidate.vehicle_plate ?? ""; }
    candidate = { ...candidate, vehicle_plate: decision.vehicle };
  }
}
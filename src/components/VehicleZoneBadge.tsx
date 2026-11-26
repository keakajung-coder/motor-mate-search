import { Badge } from "@/components/ui/badge";
import { DismissiblePlannerBadge } from "@/components/DismissiblePlannerBadge";
import { findVehicleZoneConflicts, zoneSignature, type ZoneJob } from "@/lib/vehicle-zone";

function approvalSignature(approval: unknown): string {
  return approval && typeof approval === "object" && "signature" in approval && typeof approval.signature === "string"
    ? approval.signature
    : "";
}

export function VehicleZoneBadge({ approval, job, jobs, dismissible = true }: {
  approval?: unknown;
  job?: ZoneJob & { id: string };
  jobs?: ZoneJob[];
  dismissible?: boolean;
}) {
  if (job && jobs) {
    const conflicts = findVehicleZoneConflicts(job, jobs);
    if (conflicts.length === 0) return null;
    const approved = approvalSignature(approval) === zoneSignature(job, conflicts);
    const label = approved ? "ข้ามโซน (อนุมัติแล้ว)" : "ข้ามโซน";
    const className = "border-zone-warning/50 bg-zone-warning/15 text-zone-warning gap-0.5 whitespace-normal text-[9px]";
    if (!dismissible) return <Badge variant="outline" className={className}>⚠ {label}</Badge>;
    return (
      <DismissiblePlannerBadge jobId={job.id} kind="zone" label={label} className={className}>
        ⚠ {label}
      </DismissiblePlannerBadge>
    );
  }

  if (!approval || typeof approval !== "object" || !("conflicts" in approval) || !Array.isArray(approval.conflicts) || !approval.conflicts.length) return null;
  return <Badge variant="outline" className="border-zone-warning/50 bg-zone-warning/15 text-zone-warning whitespace-normal">⚠ ข้ามโซน (อนุมัติแล้ว)</Badge>;
}

import { Badge } from "@/components/ui/badge";
export function VehicleZoneBadge({ approval }: { approval?: unknown }) {
  if (!approval || typeof approval !== "object" || !("conflicts" in approval) || !Array.isArray(approval.conflicts) || !approval.conflicts.length) return null;
  return <Badge variant="outline" className="border-zone-warning/50 bg-zone-warning/15 text-zone-warning whitespace-normal">⚠ ข้ามโซน (อนุมัติแล้ว)</Badge>;
}
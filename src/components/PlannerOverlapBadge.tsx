import { ShieldAlert } from "lucide-react";
import { DismissiblePlannerBadge } from "@/components/DismissiblePlannerBadge";
import { findScheduleConflicts, type SlotJob } from "@/lib/schedule-conflicts";

type OverlapJob = SlotJob & { job_detail?: string | null };

/** Current card conflict, not merely the historical override note saved in job_detail. */
export function PlannerOverlapBadge({ job, jobs }: { job: OverlapJob; jobs: OverlapJob[] }) {
  if (!job.id || findScheduleConflicts(job, jobs, []).length === 0) return null;
  const overridden = job.job_detail?.includes("[Admin Override") ?? false;
  return (
    <DismissiblePlannerBadge
      jobId={job.id}
      kind="overlap"
      label={overridden ? "งานซ้อน (Override)" : "งานซ้อน"}
      className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300 gap-0.5 whitespace-normal text-[9px]"
    >
      <span className="inline-flex items-center gap-0.5">
        <ShieldAlert className="size-3" aria-hidden /> งานซ้อน{overridden ? " (Override)" : ""}
      </span>
    </DismissiblePlannerBadge>
  );
}

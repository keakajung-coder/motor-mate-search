import { shortPlannerName, shortPlannerStaff, type PlannerCardFields } from "@/lib/planner-card-display";

type CardJob = {
  customer_name?: string | null; cust_id?: string | null; serial_number?: string | null;
  machine_label?: string | null; staff_name?: string | null; sales_rep?: string | null;
  job_detail?: string | null; service_type?: string | null; vehicle_plate?: string | null;
  visit_time?: string | null;
};

export function PlannerCardData({ job, fields, mine, month = false }: {
  job: CardJob; fields: PlannerCardFields; mine: boolean; month?: boolean;
}) {
  return <span className={month ? "planner-card-data planner-card-data--month" : "planner-card-data"}>
    {fields.customer && <span className="block truncate font-bold" title={job.customer_name ?? ""}>
      {mine && <span className="text-primary">★ </span>}{job.cust_id ? `[${job.cust_id}] ` : ""}{job.customer_name || "ไม่ระบุลูกค้า"}
    </span>}
    {fields.serial && (job.serial_number || job.machine_label) && <span className="planner-card-serial block truncate" title={job.serial_number || job.machine_label || ""}>⚙ {job.serial_number || job.machine_label}</span>}
    <span className="flex min-w-0 items-baseline gap-1">
      {fields.staff && <span className="planner-card-staff min-w-0 flex-1 truncate" title={job.staff_name ?? ""}>👤 {shortPlannerStaff(job.staff_name) || "-"}</span>}
      {fields.seller && job.sales_rep && <span className="planner-card-seller min-w-0 flex-1 truncate" title={job.sales_rep}>💼 {shortPlannerName(job.sales_rep)}</span>}
    </span>
    {fields.job && (job.service_type || job.job_detail) && <span className="planner-card-staff block truncate" title={job.job_detail || job.service_type || ""}>{job.service_type || job.job_detail}</span>}
    <span className="flex min-w-0 items-baseline gap-1">
      {fields.vehicle && <span className="planner-card-vehicle min-w-0 flex-1 truncate" title={job.vehicle_plate ?? ""}>🚚 {job.vehicle_plate || "ยังไม่ระบุรถ"}</span>}
      {fields.time && job.visit_time && <span className="planner-card-vehicle shrink-0">{job.visit_time.slice(0, 5)}</span>}
    </span>
  </span>;
}
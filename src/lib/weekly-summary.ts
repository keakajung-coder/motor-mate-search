export type SummaryJob = {
  id: string; work_order_id?: string | null; customer_name: string | null;
  job_detail: string | null; staff_name: string | null; status: string;
  visit_date: string | null; created_at: string; serial_number: string | null;
  quotation_required?: boolean | null;
};
export type SummaryMachine = { id: string; status: string | null };
export type SummaryRange = { from: string; to: string };
export type SummaryStage = "completed" | "quoted" | "pending" | "active";
export const MACHINE_GROUPS = ["ในคอนแทรค", "ในประกัน", "ซื้ออะไหล่เปลี่ยนเอง", "เรียกเป็นครั้ง", "หลุดคอนแทรค"];

export function bangkokDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
export function weekRange(now = new Date()): SummaryRange {
  const today = bangkokDate(now.toISOString());
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}
export function summaryStage(job: SummaryJob): SummaryStage {
  if (["closed", "completed"].includes(job.status)) return "completed";
  if (["quoted", "quotation", "awaiting_quote"].includes(job.status) || job.quotation_required) return "quoted";
  if (job.status === "in_progress") return "active";
  return "pending";
}
export function machineGroup(status: string | null) {
  const s = status?.trim() ?? "";
  if (["คอนแทรค", "ในคอนแทรค"].includes(s)) return "ในคอนแทรค";
  if (["อยู่ในประกัน", "ในประกัน"].includes(s)) return "ในประกัน";
  return MACHINE_GROUPS.includes(s) ? s : s || "ไม่ระบุสถานะ";
}
export function summaryDate(job: SummaryJob) { return job.visit_date || bangkokDate(job.created_at); }
export function buildWeeklySummary(orders: SummaryJob[], appointments: SummaryJob[], machines: SummaryMachine[], range: SummaryRange) {
  // Appointments carry the latest service outcome; linked work orders are the same task.
  const linked = new Set(appointments.map(a => a.work_order_id).filter(Boolean));
  const jobs = [...orders.filter(o => !linked.has(o.id)), ...appointments]
    .filter(j => !["rejected", "cancelled", "canceled"].includes(j.status))
    .filter(j => { const date = summaryDate(j); return date >= range.from && date <= range.to; })
    .sort((a, b) => summaryDate(a).localeCompare(summaryDate(b)) || a.id.localeCompare(b.id));
  const counts = { total: jobs.length, completed: 0, quoted: 0, pending: 0, active: 0 };
  const tech = new Map<string, number>();
  for (const job of jobs) {
    counts[summaryStage(job)]++;
    const names = [...new Set((job.staff_name ?? "").split(",").map(n => n.trim()).filter(Boolean))];
    for (const name of names.length ? names : ["ยังไม่ระบุช่าง"]) tech.set(name, (tech.get(name) ?? 0) + 1);
  }
  const groups = new Map(MACHINE_GROUPS.map(name => [name, 0]));
  for (const machine of machines) { const name = machineGroup(machine.status); groups.set(name, (groups.get(name) ?? 0) + 1); }
  return {
    jobs, counts, backlog: jobs.filter(j => summaryStage(j) === "pending"),
    technicians: [...tech].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th")),
    machines: [...groups].map(([name, count]) => ({ name, count, percent: machines.length ? count / machines.length * 100 : 0 })),
    machineTotal: machines.length,
  };
}
export type WeeklySummary = ReturnType<typeof buildWeeklySummary>;
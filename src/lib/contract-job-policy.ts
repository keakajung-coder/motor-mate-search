/** Appointment confirmation is independent of automatic contract-job approval. */
export function contractJobStatus(visitStatus?: string | null) {
  return visitStatus === "scheduled" || visitStatus === "in_progress" ? visitStatus : "approved";
}

export function bangkokContractDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
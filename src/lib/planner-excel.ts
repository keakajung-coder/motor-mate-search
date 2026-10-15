import type { CellStyle } from "xlsx-js-style";
import type { GridSheet } from "./excel-layout";
import type { StaffLeave } from "./staff-leave";
import { LEAVE_LABELS } from "./staff-leave";

export type PlannerExcelJob = {
  id: string; visit_date: string; visit_time: string | null; status: string;
  cust_id?: string | null; customer_name: string | null; staff_name: string | null;
  vehicle_plate: string | null; serial_number: string | null; machine_label: string | null;
  sales_rep?: string | null; service_type: string | null; job_detail: string | null;
};
export type PlannerExcelPalette = {
  text: string; paper: string; muted: string; border: string; header: string;
  holiday: string; holidayText: string; lunch: string;
  pending: string; active: string; completed: string;
};
type Options = {
  view: "month" | "week" | "day"; cursor: Date; title: string;
  jobs: PlannerExcelJob[]; leave: StaffLeave[];
  holidays: Record<string, { title: string }>; filterLabel: string;
  palette: PlannerExcelPalette;
  jobColors: (job: PlannerExcelJob) => { fill: string; border: string };
};
const dow = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const add = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monday = (d: Date) => add(d, -((d.getDay() + 6) % 7));
const dateLabel = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
const address = (r: number, c: number) => `${String.fromCharCode(65 + c)}${r + 1}`;
const status = (s: string) => s === "closed" ? "ปิดงานแล้ว" : s === "in_progress" ? "กำลังดำเนินการ" : s === "scheduled" ? "นัดหมายแล้ว" : "ยังไม่ไป";
const firstName = (s: string | null) => (s ?? "").split(",")[0]?.trim() ?? "";
const order = (a: PlannerExcelJob, b: PlannerExcelJob) => (firstName(a.vehicle_plate) || "zzzz").toLowerCase().localeCompare((firstName(b.vehicle_plate) || "zzzz").toLowerCase(), "th") || (a.visit_time ?? "").localeCompare(b.visit_time ?? "");

/** Same hour placement as TimeGrid, including the lunch-hour shift and edge clamping. */
export function plannerExcelHour(time: string | null) {
  let h = Number((time ?? "").slice(0, 2));
  if (Number.isNaN(h)) h = 7;
  if (h === 12) h = 13;
  return Math.min(Math.max(h, 7), 19);
}

export function buildPlannerSheets(o: Options): GridSheet[] {
  const p = o.palette;
  const thin = { style: "thin" as const, color: { rgb: p.border } };
  const base: CellStyle = { font: { name: "Arial", sz: 11, color: { rgb: p.text } }, fill: { fgColor: { rgb: p.paper } }, alignment: { wrapText: true, vertical: "top" }, border: { top: thin, bottom: thin, left: thin, right: thin } };
  const heading: CellStyle = { ...base, font: { ...base.font, bold: true, sz: 12 }, fill: { fgColor: { rgb: p.header } }, alignment: { wrapText: true, horizontal: "center", vertical: "center" } };
  const start = o.view === "month" ? monday(new Date(o.cursor.getFullYear(), o.cursor.getMonth(), 1)) : o.view === "week" ? monday(o.cursor) : o.cursor;
  const days = Array.from({ length: o.view === "month" ? 42 : o.view === "week" ? 7 : 1 }, (_, i) => add(start, i));
  const keys = new Set(days.map(iso));
  const jobs = o.jobs.filter((j) => keys.has(j.visit_date));
  const byDay = (d: Date) => jobs.filter((j) => j.visit_date === iso(d)).sort(order);
  const count = o.view === "month" ? 7 : days.length + 1;
  const rows: GridSheet["rows"] = [];
  const styles: Record<string, CellStyle> = {};
  const heights: number[] = [];
  const merges: NonNullable<GridSheet["merges"]> = [];
  const put = (values: string[], height: number, style = base) => {
    const r = rows.length; rows.push(Array.from({ length: count }, (_, c) => values[c] ?? "")); heights.push(height);
    for (let c = 0; c < count; c++) styles[address(r, c)] = style;
    return r;
  };
  const full = (text: string, height: number, style = heading) => {
    const r = put([text], height, style); merges.push({ s: { r, c: 0 }, e: { r, c: count - 1 } });
  };
  const dayText = (d: Date) => {
    const k = iso(d), h = o.holidays[k];
    return [dateLabel(d), h ? `วันหยุด: ${h.title}` : "", ...o.leave.filter((l) => l.leave_date === k).map((l) => `พนักงานลา: ${l.staff_name} · ${LEAVE_LABELS[l.period]}`)].filter(Boolean).join("\n");
  };
  const dayStyle = (d: Date): CellStyle => ({ ...heading, font: { ...heading.font, color: { rgb: o.holidays[iso(d)] || d.getDay() === 0 ? p.holidayText : p.text } }, fill: { fgColor: { rgb: o.holidays[iso(d)] || d.getDay() === 0 ? p.holiday : d.getMonth() !== o.cursor.getMonth() && o.view === "month" ? p.muted : p.header } } });
  const text = (j: PlannerExcelJob) => [
    `${j.visit_time?.slice(0, 5) || "--:--"} · ${j.cust_id ? `[${j.cust_id}] ` : ""}${j.customer_name || "ไม่ระบุลูกค้า"}`,
    `สถานะ: ${status(j.status)}`,
    `ช่าง: ${j.staff_name || "-"} · รถ: ${j.vehicle_plate || "-"}`,
    j.service_type || j.job_detail || "",
    [j.machine_label, j.serial_number ? `S/N ${j.serial_number}` : ""].filter(Boolean).join(" · "),
    j.sales_rep ? `เซลล์: ${j.sales_rep}` : "",
  ].filter(Boolean).join("\n");
  const jobStyle = (j: PlannerExcelJob): CellStyle => {
    const colors = o.jobColors(j);
    return { ...base, fill: { fgColor: { rgb: colors.fill } }, border: { top: { style: "medium", color: { rgb: colors.border } }, bottom: { style: "medium", color: { rgb: colors.border } }, right: { style: "medium", color: { rgb: colors.border } }, left: { style: "thick", color: { rgb: j.status === "closed" ? p.completed : ["scheduled", "in_progress"].includes(j.status) ? p.active : p.pending } } } };
  };
  const wrapLines = (t: string, width: number) => t.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / width)), 0);
  const jobRows = (lists: PlannerExcelJob[][], offset: number, label = "", dates: Date[] = []) => {
    for (let i = 0; i < Math.max(1, ...lists.map((l) => l.length)); i++) {
      const values = Array(count).fill("") as string[];
      if (offset) values[0] = i === 0 ? label : "";
      let height = 32;
      lists.forEach((list, c) => { const j = list[i]; if (j) { values[c + offset] = text(j); height = Math.max(height, wrapLines(values[c + offset], c === 6 ? 20 : 38) * 15 + 10); } });
      const r = put(values, Math.min(409, height));
      lists.forEach((list, c) => {
        const j = list[i], d = dates[c];
        if (j) styles[address(r, c + offset)] = jobStyle(j);
        else if (d) styles[address(r, c + offset)] = { ...base, fill: dayStyle(d).fill };
      });
    }
  };
  full(`ตารางนัดหมายบริการ · ${o.title}`, 30);
  full(o.filterLabel || "ช่างทุกคน · รถทุกคัน", 24, base);
  full("สถานะ: แดง = ยังไม่ไป · เหลือง = นัดหมายแล้ว / กำลังดำเนินการ · เขียว = ปิดงานแล้ว", 26, base);
  if (o.view === "month") {
    put(dow, 26, heading);
    for (let w = 0; w < 6; w++) {
      const week = days.slice(w * 7, w * 7 + 7);
      const labels = week.map(dayText);
      const r = put(labels, Math.min(409, Math.max(...labels.map((t) => wrapLines(t, 30))) * 17 + 12));
      week.forEach((d, c) => { styles[address(r, c)] = dayStyle(d); });
      jobRows(week.map(byDay), 0, "", week);
    }
  } else {
    const labels = ["เวลา", ...days.map((d) => `วัน${dow[(d.getDay() + 6) % 7]}\n${dayText(d)}`)];
    const r = put(labels, Math.min(409, Math.max(...labels.map((t) => wrapLines(t, 30))) * 17 + 12), heading);
    days.forEach((d, c) => { styles[address(r, c + 1)] = dayStyle(d); });
    for (const h of [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]) {
      if (h === 12) full("พักเที่ยง 12:00 – 13:00", 26, { ...heading, fill: { fgColor: { rgb: p.lunch } } });
      else jobRows(days.map((d) => byDay(d).filter((j) => plannerExcelHour(j.visit_time) === h)), 1, `${String(h).padStart(2, "0")}:00`, days);
    }
  }
  const grid: GridSheet = { name: `${o.view === "month" ? "เดือน" : o.view === "week" ? "สัปดาห์" : "วัน"} ${o.title}`, rows, styles, defaultStyle: base, merges, rowHeights: heights, cols: o.view === "day" ? [10, 90] : [...(o.view === "week" ? [10] : []), 42, 42, 42, 42, 42, 28, 22] };
  const listRows: GridSheet["rows"] = [["วันที่", "เวลา", "รหัสลูกค้า", "ชื่อลูกค้า", "เครื่อง", "S/N", "ช่าง", "เซลล์", "รถ", "สถานะ", "รายละเอียดงาน"]];
  const listStyles: Record<string, CellStyle> = {};
  const detail = [...jobs].sort((a, b) => a.visit_date.localeCompare(b.visit_date) || order(a, b));
  detail.forEach((j) => listRows.push([dateLabel(new Date(j.visit_date + "T00:00:00")), j.visit_time?.slice(0, 5) ?? "", j.cust_id ?? "", j.customer_name ?? "", j.machine_label ?? "", j.serial_number ?? "", j.staff_name ?? "", j.sales_rep ?? "", j.vehicle_plate ?? "", status(j.status), j.job_detail ?? ""]));
  for (let c = 0; c < 11; c++) listStyles[address(0, c)] = heading;
  detail.forEach((j, r) => { for (let c = 0; c < 11; c++) listStyles[address(r + 1, c)] = jobStyle(j); });
  return [grid, { name: "รายการงาน", rows: listRows, cols: [15, 10, 16, 32, 30, 26, 24, 24, 20, 24, 50], defaultStyle: base, styles: listStyles, rowHeights: listRows.map((row) => Math.min(409, Math.max(...row.map((v) => wrapLines(String(v ?? ""), 30))) * 15 + 12)), autoFilter: `A1:K${listRows.length}` }];
}

/** Resolve actual rendered CSS colors (including oklch) into Excel's sRGB format. Call only from a browser event. */
export function createPlannerColorSampler() {
  const probe = document.createElement("span");
  probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  const canvas = document.createElement("canvas"); canvas.width = 1; canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) { probe.remove(); throw new Error("ไม่สามารถอ่านสีแพลนเนอร์ได้"); }
  const rgb = (color: string) => {
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3).map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase();
  };
  const read = (classes: string, property: "backgroundColor" | "borderTopColor" | "color") => {
    probe.className = classes; return rgb(getComputedStyle(probe)[property]);
  };
  return { read, dispose: () => probe.remove() };
}
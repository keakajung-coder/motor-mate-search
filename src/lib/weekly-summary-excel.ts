import type { GridSheet } from "./excel-layout";
import type { SummaryRange, WeeklySummary } from "./weekly-summary";
import { bangkokDate, summaryDate, summaryStage } from "./weekly-summary";
import { exportDateLabel } from "./export-filename";
export type SummaryPalette = { paper: string; text: string; border: string; header: string; success: string };
const stages = { completed: "เสร็จเรียบร้อย", quoted: "อยู่ระหว่างเสนอราคา", pending: "ยังไม่ดำเนินการ", active: "กำลังดำเนินการ" };
export function summarySheets(s: WeeklySummary, range: SummaryRange, p: SummaryPalette): GridSheet[] {
  const period = exportDateLabel(range.from, range.to);
  const make = (name: string, headers: string[], body: GridSheet["rows"], cols: number[]): GridSheet => {
    const rows = [[name], [period], headers, ...body];
    const line = { style: "thin" as const, color: { rgb: p.border } };
    const base = { font: { name: "Arial", sz: 11, color: { rgb: p.text } }, fill: { fgColor: { rgb: p.paper } }, alignment: { wrapText: true, vertical: "center" as const }, border: { top: line, bottom: line, left: line, right: line } };
    const styles: NonNullable<GridSheet["styles"]> = {};
    headers.forEach((_, c) => { styles[`${String.fromCharCode(65 + c)}3`] = { ...base, font: { ...base.font, bold: true }, fill: { fgColor: { rgb: p.header } } }; });
    return { name, rows, cols, styles, defaultStyle: base, rowHeights: rows.map((_, i) => i < 3 ? 30 : 44), merges: [0, 1].map(r => ({ s: { r, c: 0 }, e: { r, c: headers.length - 1 } })), autoFilter: body.length ? `A3:${String.fromCharCode(64 + headers.length)}${rows.length}` : undefined };
  };
  const tasks = make("รายการงานทั้งหมด", ["ลูกค้า", "รายละเอียด", "ช่าง", "วันเข้าบริการ/บันทึก", "วันที่บันทึก", "สถานะ", "S/N"], s.jobs.map(j => [j.customer_name || "-", j.job_detail || "-", j.staff_name || "ยังไม่ระบุช่าง", summaryDate(j), bangkokDate(j.created_at), stages[summaryStage(j)], j.serial_number || "-"]), [30, 55, 30, 24, 24, 28, 25]);
  const summary = make("ภาพรวม", ["ตัวชี้วัด", "จำนวนงาน"], [["งานทั้งหมด", s.counts.total], ["เสร็จเรียบร้อย", s.counts.completed], ["อยู่ระหว่างเสนอราคา", s.counts.quoted], ["ยังไม่ดำเนินการ", s.counts.pending], ["กำลังดำเนินการ", s.counts.active]], [38, 20]);
  summary.formulas = {
    B4: { formula: `'รายการงานทั้งหมด'!A4:A${Math.max(4, s.jobs.length + 3)}`.replace(/^.*$/, s.jobs.length ? `COUNTA('รายการงานทั้งหมด'!A4:A${s.jobs.length + 3})` : "0"), value: s.counts.total },
  };
  ["completed", "quoted", "pending", "active"].forEach((stage, i) => {
    summary.formulas ??= {};
    summary.formulas[`B${i + 5}`] = { formula: s.jobs.length ? `COUNTIF('รายการงานทั้งหมด'!F4:F${s.jobs.length + 3},"${stages[stage as keyof typeof stages]}")` : "0", value: s.counts[stage as keyof typeof stages] };
  });
  const machines = make("สถานะเครื่องจักร", ["สถานะปัจจุบัน", "จำนวนเครื่อง", "สัดส่วน"], s.machines.map(g => [g.name, g.count, g.percent / 100]), [38, 20, 20]);
  machines.rows.push(["รวม", s.machineTotal, s.machineTotal ? 1 : 0]);
  machines.formulas = { [`B${machines.rows.length}`]: { formula: `SUM(B4:B${s.machines.length + 3})`, value: s.machineTotal } };
  s.machines.forEach((g, i) => {
    machines.formulas ??= {}; machines.formulas[`C${i + 4}`] = { formula: `IFERROR(B${i + 4}/$B$${machines.rows.length},0)`, value: g.percent / 100 };
    machines.styles ??= {}; machines.styles[`C${i + 4}`] = { ...machines.defaultStyle, numFmt: "0.0%;(0.0%);-" };
  });
  const backlog = make("งานยังไม่ดำเนินการ", ["ลูกค้า", "รายละเอียดงาน", "ช่างรับผิดชอบ", "วันที่บันทึก", "วันเข้าบริการ", "S/N"], s.backlog.map(j => [j.customer_name || "-", j.job_detail || "-", j.staff_name || "ยังไม่ระบุช่าง", bangkokDate(j.created_at), j.visit_date || "ยังไม่กำหนด", j.serial_number || "-"]), [30, 55, 30, 24, 24, 25]);
  const technicians = make("กระจายงานช่าง", ["ช่าง", "จำนวนงานที่รับผิดชอบ"], s.technicians.map(t => [t.name, t.count]), [35, 28]);
  return [summary, backlog, machines, technicians, tasks];
}
import type { GridSheet } from "./excel-layout";
import type { SummaryPalette } from "./weekly-summary-excel";
import type { RepairOrder, RepairReport } from "./repair-orders";
import { STATUS_LABELS, repairStatus } from "./repair-orders";
import { exportDateLabel } from "./export-filename";

const dash = (v: string | null) => (v && v.trim() ? v : "-");

function makeSheet(p: SummaryPalette, name: string, headers: string[], body: GridSheet["rows"], cols: number[]): GridSheet {
  const rows = [[name], [exportDateLabel(new Date())], headers, ...body];
  const line = { style: "thin" as const, color: { rgb: p.border } };
  const base = { font: { name: "Arial", sz: 11, color: { rgb: p.text } }, fill: { fgColor: { rgb: p.paper } }, alignment: { wrapText: true, vertical: "center" as const }, border: { top: line, bottom: line, left: line, right: line } };
  const styles: NonNullable<GridSheet["styles"]> = {};
  headers.forEach((_, c) => { styles[`${String.fromCharCode(65 + c)}3`] = { ...base, font: { ...base.font, bold: true }, fill: { fgColor: { rgb: p.header } } }; });
  return { name, rows, cols, styles, defaultStyle: base, rowHeights: rows.map((_, i) => (i < 3 ? 30 : 44)), merges: [0, 1].map((r) => ({ s: { r, c: 0 }, e: { r, c: headers.length - 1 } })), autoFilter: body.length ? `A3:${String.fromCharCode(64 + headers.length)}${rows.length}` : undefined };
}

const inShopRow = (o: RepairOrder) => [
  dash(o.equipment_model), dash(o.serial_number), dash(o.company_name), dash(o.contact_person), dash(o.sales_person),
  o.check_in_date, dash(o.issue_description), STATUS_LABELS[repairStatus(o.status)], dash(o.next_action), o.target_delivery_date ?? "ยังไม่กำหนด",
];

/** รายงานประชุมรายสัปดาห์: ภาพรวมสถานะ + เครื่องค้างช็อป + เครื่องที่ส่งมอบในช่วงที่เลือก */
export function repairReportSheets(report: RepairReport, from: string, to: string, p: SummaryPalette): GridSheet[] {
  const overview = makeSheet(p, "ภาพรวม", ["สถานะเครื่อง", "จำนวนเครื่อง"], report.byStatus.map((s) => [s.label, s.count]), [30, 20]);
  overview.rows.push(["รวมเครื่องค้างช็อป", report.inShopTotal]);
  // สูตรรวมค้างช็อป = ผลรวมทุกสถานะยกเว้นส่งออกแล้ว
  overview.formulas = { [`B${overview.rows.length}`]: { formula: `SUM(B4:B7)`, value: report.inShopTotal } };

  const inShop = makeSheet(p, "เครื่องค้างช็อป", ["รุ่นเครื่อง", "S/N", "บริษัท", "ผู้ติดต่อ", "ผู้ดูแล", "วันที่รับเข้า", "อาการเสีย", "สถานะล่าสุด", "สิ่งที่ต้องทำต่อ", "กำหนดส่งออก"], report.inShop.map(inShopRow), [24, 20, 30, 22, 20, 18, 45, 20, 40, 18]);

  const delivered = makeSheet(p, "ส่งมอบสัปดาห์นี้", ["รุ่นเครื่อง", "S/N", "บริษัท", "ผู้ติดต่อ", "ผู้ดูแล", "วันที่รับเข้า", "อาการเสีย", "สถานะล่าสุด", "สิ่งที่ต้องทำต่อ", "ส่งออกจริง"],
    report.delivered.map((o) => [...inShopRow(o).slice(0, 9), o.actual_delivery_date ?? "-"]), [24, 20, 30, 22, 20, 18, 45, 20, 40, 18]);

  return [overview, inShop, delivered];
}

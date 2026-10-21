import { test } from "node:test";
import assert from "node:assert/strict";
import { exportFilename, plannerExportLabel } from "./export-filename";

test("single-day queue PDF uses day-month-Buddhist year", () => {
  assert.equal(exportFilename("คิวงาน", "2026-10-22", "pdf"), "คิวงาน-22-ต.ค.-2569.pdf");
});
test("same-month range follows the requested weekly Excel example", () => {
  assert.equal(exportFilename("ตารางงาน", "2026-10-26", "xlsx", "2026-10-30"), "ตารางงาน-26-ถึง-30-ต.ค.-2569.xlsx");
});
test("cross-month and cross-year ranges keep both endpoints unambiguous", () => {
  assert.equal(exportFilename("ตารางงาน", "2026-10-26", "pdf", "2026-11-01"), "ตารางงาน-26-ต.ค.-2569-ถึง-01-พ.ย.-2569.pdf");
  assert.equal(exportFilename("ตารางงาน", "2026-12-28", "xlsx", "2027-01-03"), "ตารางงาน-28-ธ.ค.-2569-ถึง-03-ม.ค.-2570.xlsx");
});
test("planner filenames reflect the selected day, full week, or calendar month", () => {
  const cursor = new Date(2026, 9, 22);
  assert.equal(plannerExportLabel("day", cursor), "22-ต.ค.-2569");
  assert.equal(plannerExportLabel("week", cursor), "สัปดาห์-19-ถึง-25-ต.ค.-2569");
  assert.equal(plannerExportLabel("month", cursor), "เดือน-01-ถึง-31-ต.ค.-2569");
});
test("PDF and Excel use the same basename regardless of delivery channel", () => {
  assert.equal(exportFilename("คิวงาน", "2026-10-22", "xlsx").replace(/\.xlsx$/, ""), exportFilename("คิวงาน", "2026-10-22", "pdf").replace(/\.pdf$/, ""));
});
test("work-order summary includes the full selected range in either format", () => {
  for (const extension of ["pdf", "xlsx"] as const) {
    assert.equal(exportFilename("สรุปใบสั่งงาน-ทุกสถานะ", "2026-10-26", extension, "2026-11-01"), `สรุปใบสั่งงาน-ทุกสถานะ-26-ต.ค.-2569-ถึง-01-พ.ย.-2569.${extension}`);
  }
});
test("all twelve Thai month abbreviations are used", () => {
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  months.forEach((month, i) => assert.equal(exportFilename("ข้อมูล", new Date(2026, i, 1), "xlsx"), `ข้อมูล-01-${month}-2569.xlsx`));
});
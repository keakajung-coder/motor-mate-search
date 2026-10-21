import { test } from "node:test";
import assert from "node:assert/strict";
import { exportFilename, plannerExportLabel } from "./export-filename";

test("single-day queue PDF uses day-month-Buddhist year", () => {
  assert.equal(exportFilename("คิวงาน", "2026-10-22", "pdf"), "คิวงาน-22-10-2569.pdf");
});
test("same-month range follows the requested weekly Excel example", () => {
  assert.equal(exportFilename("ตารางงาน-สัปดาห์", "2026-10-26", "xlsx", "2026-10-30"), "ตารางงาน-สัปดาห์-26-ถึง-30-10-2569.xlsx");
});
test("cross-month and cross-year ranges keep both endpoints unambiguous", () => {
  assert.equal(exportFilename("ตารางงาน", "2026-10-26", "pdf", "2026-11-01"), "ตารางงาน-26-10-ถึง-01-11-2569.pdf");
  assert.equal(exportFilename("ตารางงาน", "2026-12-28", "xlsx", "2027-01-03"), "ตารางงาน-28-12-2569-ถึง-03-01-2570.xlsx");
});
test("planner filenames reflect the selected day, full week, or calendar month", () => {
  const cursor = new Date(2026, 9, 22);
  assert.equal(plannerExportLabel("day", cursor), "22-10-2569");
  assert.equal(plannerExportLabel("week", cursor), "สัปดาห์-19-ถึง-25-10-2569");
  assert.equal(plannerExportLabel("month", cursor), "เดือน-01-ถึง-31-10-2569");
});
test("PDF and Excel use the same basename regardless of delivery channel", () => {
  assert.equal(exportFilename("คิวงาน", "2026-10-22", "xlsx").replace(/\.xlsx$/, ""), exportFilename("คิวงาน", "2026-10-22", "pdf").replace(/\.pdf$/, ""));
});
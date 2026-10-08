import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeSheetName } from "./excel-layout";
test("ลบอักขระต้องห้ามในชื่อชีท", () => {
  assert.equal(sanitizeSheetName("เดือน ต.ค./2569 [A]:*?\\"), "เดือน ต.ค.-2569 -A-----");
});
test("ชื่อชีทไม่เกิน 31 ตัวและไม่ซ้ำ", () => {
  const used = new Set<string>();
  assert.equal(sanitizeSheetName("x".repeat(40), used).length, 31);
  assert.equal(sanitizeSheetName("x".repeat(40), used), "x".repeat(27) + " (2)");
});
test("ชื่อว่างใช้ Sheet", () => assert.equal(sanitizeSheetName("''"), "Sheet"));

import { expect, test } from "bun:test";
import { sanitizeSheetName } from "./excel-layout";
test("ลบอักขระต้องห้ามในชื่อชีท", () => {
  expect(sanitizeSheetName("เดือน ต.ค./2569 [A]:*?\\")).toBe("เดือน ต.ค.-2569 -A-----");
});
test("ชื่อชีทไม่เกิน 31 ตัวและไม่ซ้ำ", () => {
  const used = new Set<string>();
  expect(sanitizeSheetName("x".repeat(40), used).length).toBe(31);
  expect(sanitizeSheetName("x".repeat(40), used)).toBe("x".repeat(27) + " (2)");
});
test("ชื่อว่างใช้ Sheet", () => expect(sanitizeSheetName("''")).toBe("Sheet"));

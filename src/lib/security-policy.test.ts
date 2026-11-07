import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccessTable, canAccessEmployeePhotos, safeSpreadsheetValue } from "./security-policy";
test("viewer cannot edit stock but can create work orders", () => {
  assert.equal(canAccessTable("viewer", "products", "PATCH"), false);
  assert.equal(canAccessTable("viewer", "work_orders", "POST"), true);
  assert.equal(canAccessTable("viewer", "maintenance_logs", "POST"), true);
});
test("admin can edit stock; direct deletes never bypass trash", () => {
  assert.equal(canAccessTable("admin", "products", "PATCH"), true);
  assert.equal(canAccessTable("admin", "customers", "DELETE"), false);
});
test("secret settings are inaccessible through the data gateway", () => {
  assert.equal(canAccessTable("admin", "security_settings", "GET"), false);
  assert.equal(canAccessTable("viewer", "access_rate_limits", "GET"), false);
});
test("spreadsheet commands become text", () => {
  assert.equal(safeSpreadsheetValue("=HYPERLINK(\"https://example.com\")"), "'=HYPERLINK(\"https://example.com\")");
  assert.equal(safeSpreadsheetValue("\t+SUM(1,2)"), "'\t+SUM(1,2)");
  assert.equal(safeSpreadsheetValue(12), 12);
});
test("employee soft deletes and roster settings require server admin permissions", () => {
  for (const table of ["service_staff", "sales_contacts", "app_settings"]) {
    assert.equal(canAccessTable("viewer", table, "PATCH"), false);
    assert.equal(canAccessTable("admin", table, "PATCH"), true);
  }
});
test("only verified admins can add employees in any department", () => {
  for (const table of ["service_staff", "sales_contacts", "app_settings"]) {
    assert.equal(canAccessTable("viewer", table, "POST"), false);
    assert.equal(canAccessTable("admin", table, "POST"), true);
  }
});
test("employee profile uploads and deletes require admin; viewers can read photos", () => {
  assert.equal(canAccessEmployeePhotos("viewer", "POST"), false);
  assert.equal(canAccessEmployeePhotos("viewer", "DELETE"), false);
  assert.equal(canAccessEmployeePhotos("admin", "POST"), true);
  assert.equal(canAccessEmployeePhotos("admin", "DELETE"), true);
  assert.equal(canAccessEmployeePhotos("viewer", "GET"), true);
  assert.equal(canAccessEmployeePhotos("admin", "PATCH"), false);
});
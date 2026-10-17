import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccessTable, safeSpreadsheetValue } from "./security-policy";
test("viewer cannot edit stock but can create work orders", () => {
  assert.equal(canAccessTable("viewer", "products", "PATCH"), false);
  assert.equal(canAccessTable("viewer", "work_orders", "POST"), true);
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
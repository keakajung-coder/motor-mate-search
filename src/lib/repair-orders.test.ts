import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRepairReport, isInShop, repairSearch, repairStatus, type RepairOrder } from "./repair-orders";

const row = (over: Partial<RepairOrder>): RepairOrder => ({
  id: "1", company_name: "บริษัท เอ", contact_person: null, contact_phone: null, sales_person: null,
  equipment_model: null, serial_number: null, issue_description: null, check_in_date: "2026-11-01",
  status: "Pending", next_action: null, assigned_tech: null, target_delivery_date: null,
  actual_delivery_date: null, created_at: "", updated_at: "", ...over,
});

test("unknown status falls back to Pending; completed machines leave the shop", () => {
  assert.equal(repairStatus("bogus"), "Pending");
  assert.equal(isInShop(row({ status: "Ready" })), true);
  assert.equal(isInShop(row({ status: "Completed" })), false);
});

test("search matches company, model, serial, sales and phone digits", () => {
  const o = row({ company_name: "Siam Air", equipment_model: "GA37", serial_number: "SN-990", sales_person: "โจ้", contact_phone: "081-234-5678" });
  assert.equal(repairSearch(o, "siam"), true);
  assert.equal(repairSearch(o, "ga37"), true);
  assert.equal(repairSearch(o, "sn-990"), true);
  assert.equal(repairSearch(o, "โจ้"), true);
  assert.equal(repairSearch(o, "081234"), true);
  assert.equal(repairSearch(o, "ไม่มี"), false);
  assert.equal(repairSearch(o, "  "), true);
});

test("weekly report counts in-shop machines by status and deliveries in range", () => {
  const orders = [
    row({ id: "a", status: "Pending" }),
    row({ id: "b", status: "Waiting Parts" }),
    row({ id: "c", status: "Ready" }),
    row({ id: "d", status: "Completed", actual_delivery_date: "2026-11-05" }),
    row({ id: "e", status: "Completed", actual_delivery_date: "2026-10-20" }),
    row({ id: "f", status: "Completed", actual_delivery_date: null }),
  ];
  const report = buildRepairReport(orders, "2026-11-02", "2026-11-08");
  assert.equal(report.inShopTotal, 3);
  assert.equal(report.byStatus.find((s) => s.status === "Pending")?.count, 1);
  assert.equal(report.byStatus.find((s) => s.status === "Completed")?.count, 3);
  assert.deepEqual(report.delivered.map((o) => o.id), ["d"]);
});

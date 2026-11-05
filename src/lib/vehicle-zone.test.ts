import { test } from "node:test";
import assert from "node:assert/strict";
import { findVehicleZoneConflicts, zoneSignature, type ZoneJob } from "./vehicle-zone";
const job: ZoneJob = { id: "new", visit_date: "2026-10-30", vehicle_plate: "กข 1234", customer_address: "จ.ระยอง" };
const old: ZoneJob = { id: "old", visit_date: "2026-10-30", vehicle_plate: "กข 1234", customer_address: "จ.ชลบุรี" };
test("Chonburi and Rayong on the same vehicle trigger approval", () => {
  assert.deepEqual(findVehicleZoneConflicts(job, [old]), [{ plate: "กข 1234", province: "ระยอง", otherProvinces: ["ชลบุรี"] }]);
});
test("different vehicles never trigger a cross-zone comparison", () => {
  assert.deepEqual(findVehicleZoneConflicts({ ...job, vehicle_plate: "กค 5678" }, [old]), []);
});
test("changing vehicle immediately uses only the new vehicle's province", () => {
  const others = [old, { ...old, id: "third", vehicle_plate: "กค 5678", customer_address: "จ.ระยอง" }];
  assert.equal(findVehicleZoneConflicts(job, others).length, 1);
  assert.deepEqual(findVehicleZoneConflicts({ ...job, vehicle_plate: "กค 5678" }, others), []);
});
test("each plate in a multiple-vehicle assignment is evaluated independently", () => {
  assert.deepEqual(findVehicleZoneConflicts({ ...job, vehicle_plate: "กข 1234, กค 5678" }, [old]).map(c => c.plate), ["กข 1234"]);
});
test("same province does not require approval", () => {
  assert.deepEqual(findVehicleZoneConflicts({ ...job, customer_address: "ศรีราชา ชลบุรี" }, [old]), []);
});
test("visits on different days do not share a vehicle route", () => {
  assert.deepEqual(findVehicleZoneConflicts({ ...job, visit_date: "2026-10-31" }, [old]), []);
});
test("self and linked work order do not conflict with their appointment", () => {
  assert.deepEqual(findVehicleZoneConflicts({ ...job, work_order_id: "old" }, [old, { ...old, id: "new" }]), []);
});
test("approval signature changes when date vehicle or province changes", () => {
  const conflicts = findVehicleZoneConflicts(job, [old]);
  for (const changed of [{ ...job, visit_date: "2026-10-31" }, { ...job, vehicle_plate: "กค 5678" }, { ...job, customer_address: "กรุงเทพฯ" }]) assert.notEqual(zoneSignature(changed, conflicts), zoneSignature(job, conflicts));
});
test("unknown province never invents a cross-zone conflict", () => {
  assert.deepEqual(findVehicleZoneConflicts({ ...job, customer_address: "" }, [old]), []);
});
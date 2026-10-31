import { test } from "node:test";
import assert from "node:assert/strict";
import { customerLocationPatch, locationNavigationUrl } from "./customer-location";
import { findVehicleZoneConflicts } from "./vehicle-zone";

const customer = { address: "99/1", subdistrict: "บางแก้ว", district: "บางพลี", province: "สมุทรปราการ", postal_code: "10540", latitude: 13.64, longitude: 100.67, maps_url: "https://maps.app.goo.gl/example", place_id: "customer-place" };
test("selecting customer binds every stored address and map field", () => {
  assert.deepEqual(customerLocationPatch(customer), { customer_address: "99/1 ต.บางแก้ว อ.บางพลี จ.สมุทรปราการ 10540", customer_location: customer });
});
test("switching to a customer without a pin clears the previous location", () => {
  const previous = customerLocationPatch(customer);
  const next = { ...previous, ...customerLocationPatch({ address: "12", province: "ระยอง" }) };
  assert.equal(next.customer_location.latitude, null);
  assert.equal(next.customer_location.maps_url, "");
  assert.equal(next.customer_address, "12 จ.ระยอง");
});
test("navigation targets stored coordinates and selected place rather than searching the name", () => {
  const url = new URL(locationNavigationUrl(customer, "other address"));
  assert.equal(url.pathname, "/maps/dir/");
  assert.equal(url.searchParams.get("destination"), "13.64,100.67");
  assert.equal(url.searchParams.get("destination_place_id"), "customer-place");
});
test("saved map URL works when no coordinates are available", () => {
  assert.equal(locationNavigationUrl({ maps_url: "https://maps.app.goo.gl/example" }), "https://maps.app.goo.gl/example");
});
test("unsafe saved URLs never become navigation links", () => {
  assert.equal(locationNavigationUrl({ maps_url: "javascript:alert(1)" }), "");
});
test("customer snapshot province is used for same-vehicle zone review", () => {
  const target = { ...customerLocationPatch({ ...customer, province: "ระยอง" }), visit_date: "2026-10-31", vehicle_plate: "กข 1234" };
  assert.deepEqual(findVehicleZoneConflicts(target, [{ customer_address: "ชลบุรี", visit_date: "2026-10-31", vehicle_plate: "กข 1234" }]), [{ plate: "กข 1234", province: "ระยอง", otherProvinces: ["ชลบุรี"] }]);
});
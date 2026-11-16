import { test } from "node:test";
import assert from "node:assert/strict";
import { linkedPartCatalog, partLine } from "./machine-part-links.ts";
import { splitGenuineCrossRef } from "./parts-search.ts";

const products = [{ id: "main", part_number: "A123", name: "กรอง" }, { id: "alt", part_number: "B456", name: "กรองเทียบ" }];
const links = [{ product_id: "main", cross_reference_parts: ["B456", "C789"] }];
test("S/N linkage exposes stocked and unstocked alternatives", () => {
  const rows = linkedPartCatalog(products, links);
  const groups = splitGenuineCrossRef(rows, { linkedProductIds: ["main"] });
  assert.deepEqual(groups.genuine.map(p => p.part_number), ["A123"]);
  assert.deepEqual(groups.crossRef.map(p => p.part_number), ["B456", "C789"]);
});
test("alternative search also returns its main part", () => {
  const groups = splitGenuineCrossRef(linkedPartCatalog(products, links), { keyword: "B456" });
  assert.ok([...groups.genuine, ...groups.crossRef].some(p => p.part_number === "A123"));
});
test("null relations default to empty arrays without changing inventory", () => {
  const rows = linkedPartCatalog(products, [{ product_id: "main", cross_reference_parts: null }]);
  assert.deepEqual(rows[0].cross_reference_parts, []);
  assert.equal(products[0].part_number, "A123");
  assert.equal(linkedPartCatalog(products, []).length, 2);
});
test("replacement codes stay scoped to the machine relation", () => {
  assert.equal(linkedPartCatalog(products, []).some(p => p.part_number === "C789"), false);
  assert.equal(linkedPartCatalog(products, links).some(p => p.part_number === "C789"), true);
});
test("job entry retains the selected replacement code", () => {
  assert.equal(partLine({ id: "alt", part_number: "B456", name: "กรองเทียบ" }, "เทียบ"), "B456 · กรองเทียบ (เทียบ)");
});
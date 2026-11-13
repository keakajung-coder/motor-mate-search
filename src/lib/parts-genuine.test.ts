import { test } from "node:test";
import assert from "node:assert/strict";
import { splitGenuineCrossRef } from "./parts-search.ts";

const P = [
  { id: "a", name: "Oil filter", part_number: "OF-1", cross_reference_parts: ["X-9"], supported_serials: ["SN100"] },
  { id: "b", name: "Alt filter", part_number: "X-9", cross_reference_parts: null, supported_serials: null },
  { id: "c", name: null, part_number: null } as any,
];

test("S/N ที่ผูกกับอะไหล่ = อะไหล่แท้ และรหัสเทียบไปอยู่กลุ่มเทียบ", () => {
  const r = splitGenuineCrossRef(P, { serials: ["sn100"] });
  assert.deepEqual(r.genuine.map((p) => p.id), ["a"]);
  assert.deepEqual(r.crossRef.map((p) => p.id), ["b"]);
});

test("ค่า null ไม่ทำให้พัง", () => {
  assert.doesNotThrow(() => splitGenuineCrossRef(null as any, { keyword: null }));
  assert.deepEqual(splitGenuineCrossRef(P, { keyword: "zzz" }).genuine, []);
});

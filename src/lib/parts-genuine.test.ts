import { describe, it, expect } from "vitest";
import { splitGenuineCrossRef } from "./parts-search";

const P = [
  { id: "a", name: "Oil filter", part_number: "OF-1", cross_reference_parts: ["X-9"], supported_serials: ["SN100"] },
  { id: "b", name: "Alt filter", part_number: "X-9", cross_reference_parts: null, supported_serials: null },
  { id: "c", name: null, part_number: null } as any,
];

describe("splitGenuineCrossRef", () => {
  it("S/N ที่ผูกกับอะไหล่ = อะไหล่แท้ และรหัสเทียบไปอยู่กลุ่มเทียบ", () => {
    const r = splitGenuineCrossRef(P, { serials: ["sn100"] });
    expect(r.genuine.map((p) => p.id)).toEqual(["a"]);
    expect(r.crossRef.map((p) => p.id)).toEqual(["b"]);
  });
  it("ค่า null ไม่ทำให้พัง", () => {
    expect(() => splitGenuineCrossRef(null as any, { keyword: null })).not.toThrow();
    expect(splitGenuineCrossRef(P, { keyword: "zzz" }).genuine).toEqual([]);
  });
});

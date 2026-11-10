import { describe, expect, it } from "vitest";
import { addTag, parseTags, partMatchesKeyword, partSearchText, removeTag } from "./parts-search";

describe("partMatchesKeyword", () => {
  const part = {
    name: "ไส้กรองอากาศ",
    part_number: "AF-1234",
    cross_reference_parts: ["CF-500", "DONALDSON P181"],
    supported_serials: ["SN-9001"],
    brandName: "Atlas Copco",
    categoryName: "ไส้กรอง",
    modelName: "GA30",
    linkedSerials: ["SN-7777"],
  };

  it("ค้นหาจากรหัสพาร์ทหลักได้", () => {
    expect(partMatchesKeyword(part, "af-1234")).toBe(true);
  });

  it("ค้นหาจากรหัสพาร์ทเทียบได้", () => {
    expect(partMatchesKeyword(part, "cf-500")).toBe(true);
    expect(partMatchesKeyword(part, "p181")).toBe(true);
  });

  it("ค้นหาจากชื่อ ยี่ห้อ และหมวดหมู่ได้", () => {
    expect(partMatchesKeyword(part, "ไส้กรอง")).toBe(true);
    expect(partMatchesKeyword(part, "atlas")).toBe(true);
  });

  it("ค้นหาจาก S/N ที่รองรับและ S/N ที่ผูกกับเครื่องได้", () => {
    expect(partMatchesKeyword(part, "sn-9001")).toBe(true);
    expect(partMatchesKeyword(part, "SN-7777")).toBe(true);
  });

  it("คำที่ไม่เกี่ยวไม่ตรง", () => {
    expect(partMatchesKeyword(part, "zzzz-not-found")).toBe(false);
  });

  it("คำค้นว่างตรงทุกรายการ", () => {
    expect(partMatchesKeyword(part, "  ")).toBe(true);
  });

  it("partSearchText รวมทุกฟิลด์", () => {
    const text = partSearchText(part);
    for (const piece of ["af-1234", "cf-500", "atlas copco", "sn-7777", "ga30"]) {
      expect(text).toContain(piece);
    }
  });
});

describe("tag helpers", () => {
  it("parseTags แยกด้วย comma/semicolon/newline และตัดช่องว่าง", () => {
    expect(parseTags("A-1, B-2 ; C-3\nD-4")).toEqual(["A-1", "B-2", "C-3", "D-4"]);
  });

  it("addTag ไม่เพิ่มค่าซ้ำ (ไม่สนตัวพิมพ์)", () => {
    expect(addTag(["AF-1"], "af-1")).toEqual(["AF-1"]);
    expect(addTag(["AF-1"], " BF-2 ")).toEqual(["AF-1", "BF-2"]);
    expect(addTag([], "  ")).toEqual([]);
  });

  it("removeTag ลบเฉพาะค่าที่ตรง", () => {
    expect(removeTag(["A", "B", "C"], "B")).toEqual(["A", "C"]);
  });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { addTag, parseTags, partMatchesKeyword, partSearchText, removeTag } from "./parts-search";

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

test("ค้นหาจากรหัสพาร์ทหลักได้", () => {
  assert.equal(partMatchesKeyword(part, "af-1234"), true);
});

test("ค้นหาจากรหัสพาร์ทเทียบได้", () => {
  assert.equal(partMatchesKeyword(part, "cf-500"), true);
  assert.equal(partMatchesKeyword(part, "p181"), true);
});

test("ค้นหาจากชื่อ ยี่ห้อ และหมวดหมู่ได้", () => {
  assert.equal(partMatchesKeyword(part, "ไส้กรอง"), true);
  assert.equal(partMatchesKeyword(part, "atlas"), true);
});

test("ค้นหาจาก S/N ที่รองรับและ S/N ที่ผูกกับเครื่องได้", () => {
  assert.equal(partMatchesKeyword(part, "sn-9001"), true);
  assert.equal(partMatchesKeyword(part, "SN-7777"), true);
});

test("คำที่ไม่เกี่ยวไม่ตรง", () => {
  assert.equal(partMatchesKeyword(part, "zzzz-not-found"), false);
});

test("คำค้นว่างตรงทุกรายการ", () => {
  assert.equal(partMatchesKeyword(part, "  "), true);
});

test("partSearchText รวมทุกฟิลด์", () => {
  const text = partSearchText(part);
  for (const piece of ["af-1234", "cf-500", "atlas copco", "sn-7777", "ga30"]) {
    assert.ok(text.includes(piece), `ควรมี ${piece}`);
  }
});

test("parseTags แยกด้วย comma/semicolon/newline และตัดช่องว่าง", () => {
  assert.deepEqual(parseTags("A-1, B-2 ; C-3\nD-4"), ["A-1", "B-2", "C-3", "D-4"]);
});

test("addTag ไม่เพิ่มค่าซ้ำ (ไม่สนตัวพิมพ์)", () => {
  assert.deepEqual(addTag(["AF-1"], "af-1"), ["AF-1"]);
  assert.deepEqual(addTag(["AF-1"], " BF-2 "), ["AF-1", "BF-2"]);
  assert.deepEqual(addTag([], "  "), []);
});

test("removeTag ลบเฉพาะค่าที่ตรง", () => {
  assert.deepEqual(removeTag(["A", "B", "C"], "B"), ["A", "C"]);
});

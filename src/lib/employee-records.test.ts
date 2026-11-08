import { test } from "node:test";
import assert from "node:assert/strict";
import { activeSellerNames, deactivateEngineerRecords, editEngineerRecords } from "./employee-records";
test("ผู้ขายที่ลบแล้วไม่กลับมาจากรายชื่อสำรองหลังรีเฟรช", () => {
  assert.deepEqual(activeSellerNames([{ name: "สมชาย", active: false }, { name: "วิชัย", active: true }], ["สมชาย", "คนใหม่"]), ["วิชัย", "คนใหม่"]);
});
test("ลบวิศวกรแบบเก่าโดยรักษาชื่อและประวัติ ไม่กระทบคนอื่น", () => {
  assert.deepEqual(deactivateEngineerRecords(["สมชาย", "วิชัย"], "eng-0-สมชาย", "สมชาย"), [{ id: "eng-0-สมชาย", name: "สมชาย", active: false }, "วิชัย"]);
});
test("ลบวิศวกรยังเก็บรูป เบอร์โทร และข้อมูลเดิม", () => {
  assert.deepEqual(deactivateEngineerRecords([{ id: "e1", name: "สมชาย", phone: "081", avatar_url: "photo", active: true }], "e1", "สมชาย"), [{ id: "e1", name: "สมชาย", phone: "081", avatar_url: "photo", active: false }]);
});
test("ไม่พบพนักงานต้องแจ้งผิดพลาดแทนแจ้งว่าลบสำเร็จ", () => assert.throws(() => deactivateEngineerRecords(["วิชัย"], "missing", "สมชาย"), /ไม่พบข้อมูล/));
test("แก้ไขชื่อ โทร ตำแหน่งและรูปเฉพาะพนักงานเดิม รักษาข้อมูลอื่น", () => {
  const fields = { name: "วิชัย ใหม่", phone: "0812345678", position: "หัวหน้าโปรเจกต์", avatar_url: "new-photo" };
  assert.deepEqual(editEngineerRecords([{ id: "e1", name: "วิชัย", note: "keep" }, { id: "e2", name: "อื่น" }], "e1", "วิชัย", fields), [{ id: "e1", ...fields, note: "keep" }, { id: "e2", name: "อื่น" }]);
});
test("แก้ไขพนักงานเก่ารักษาตัวตนและล้างรูปได้", () => {
  const fields = { name: "สมชาย ใหม่", phone: null, position: "วิศวกร", avatar_url: null };
  assert.deepEqual(editEngineerRecords(["สมชาย"], "สมชาย", "สมชาย", fields), [{ ...fields, id: "สมชาย" }]);
});
test("แก้ไขไม่ทำให้พนักงานที่ลบกลับมา", () => {
  assert.throws(() => editEngineerRecords([{ id: "e1", name: "สมชาย", active: false }], "e1", "สมชาย", { name: "ใหม่", phone: null, position: null, avatar_url: null }), /ไม่พบข้อมูล/);
});
import { test } from "node:test";
import assert from "node:assert/strict";
import { activeSellerNames, deactivateEngineerRecords } from "./employee-records";
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
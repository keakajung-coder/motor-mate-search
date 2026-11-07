import { test } from "node:test";
import assert from "node:assert/strict";
import { filterEmployees, employeeRole, type Employee } from "./employee-selection";

const employees: Employee[] = [
  { id: "1", name: "สมชาย ใจดี", phone: "081-234-5678", position: "ฝ่ายขาย", department: "sales", avatar: "" },
  { id: "2", name: "วิชัย งานช่าง", phone: "0890001234", position: "ช่างบริการ", department: "service", avatar: "" },
  { id: "3", name: "วรรณา", phone: "", position: "วิศวกร", department: "project", avatar: "" },
];
test("ค้นหาพนักงานจากชื่อได้ทันที", () => assert.deepEqual(filterEmployees(employees, "all", "สมชาย").map(e => e.id), ["1"]));
test("ค้นหาเบอร์โทรโดยไม่ติดขีดและช่องว่าง", () => assert.deepEqual(filterEmployees(employees, "all", "081234").map(e => e.id), ["1"]));
test("ค้นหาตำแหน่งงาน", () => assert.deepEqual(filterEmployees(employees, "all", "วิศวกร").map(e => e.id), ["3"]));
test("แต่ละฝ่ายแสดงเฉพาะคนในฝ่าย และภาพรวมแสดงทุกคน", () => {
  assert.deepEqual(filterEmployees(employees, "service", "").map(e => e.id), ["2"]);
  assert.deepEqual(filterEmployees(employees, "project", "").map(e => e.id), ["3"]);
  assert.equal(filterEmployees(employees, "all", "").length, 3);
});
test("การเลือกฝ่ายไม่ยกระดับสิทธิ์แอดมิน", () => {
  assert.equal(employeeRole("sales"), "seller");
  assert.equal(employeeRole("service"), "tech");
  assert.equal(employeeRole("project"), "general");
});
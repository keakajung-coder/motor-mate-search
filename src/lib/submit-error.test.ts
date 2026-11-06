import { test } from "node:test";
import assert from "node:assert/strict";
import { describeSubmitError } from "./submit-error";

test("แจ้งเตือนไฟล์ใหญ่เกิน (413) เป็นภาษาไทยที่เข้าใจง่าย", () => {
  const msg = describeSubmitError(new Error("HTTP 413 Payload Too Large"));
  assert.match(msg, /ขนาดใหญ่เกินไป/);
});

test("แจ้งเตือนเน็ตหลุดเมื่อ fetch ล้มเหลว", () => {
  const msg = describeSubmitError(new Error("Failed to fetch"));
  assert.match(msg, /เชื่อมต่ออินเทอร์เน็ตขัดข้อง/);
});

test("แจ้งเตือนสิทธิ์หมดอายุเมื่อโดน 401/403", () => {
  const msg = describeSubmitError(new Error("HTTP 401"));
  assert.match(msg, /สิทธิ์การใช้งานหมดอายุ/);
});

test("แจ้งเตือนข้อมูลซ้ำจาก duplicate key", () => {
  const msg = describeSubmitError(new Error('duplicate key value violates unique constraint "x"'));
  assert.match(msg, /ซ้ำ/);
});

test("ข้อผิดพลาดอื่นส่งข้อความเดิมกลับไปให้ผู้ใช้เห็นสาเหตุจริง", () => {
  assert.equal(describeSubmitError(new Error("เซิร์ฟเวอร์ขัดข้องชั่วคราว")), "เซิร์ฟเวอร์ขัดข้องชั่วคราว");
  assert.equal(describeSubmitError(null), "ไม่ทราบสาเหตุ");
});

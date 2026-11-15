import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProfilePhoto, requireSelectedProfile } from "./profile-policy";
test("profile photos accept exactly 500KB and reject larger files", () => {
  const bytes = new Uint8Array(500 * 1024); bytes.set([255, 216, 255]);
  assert.equal(validateProfilePhoto(bytes), "image/jpeg");
  const oversized = new Uint8Array(500 * 1024 + 1); oversized.set([255, 216, 255]);
  assert.throws(() => validateProfilePhoto(oversized), /500KB/);
});
test("self uploads require a server-selected identity", () => {
  assert.throws(() => requireSelectedProfile(), /เลือกผู้ใช้งาน/);
  assert.equal(requireSelectedProfile("service:123"), "service:123");
});
test("non-image data cannot be saved as a profile photo", () => {
  assert.throws(() => validateProfilePhoto(new TextEncoder().encode("not an image")), /JPG/);
});
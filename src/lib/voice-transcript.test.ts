import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeVoiceTranscript } from "./voice-transcript";

test("pure spoken serial with Thai letter names and digit words becomes a code", () => {
  assert.equal(normalizeVoiceTranscript("เอ บี หนึ่ง สอง สาม"), "AB123");
});

test("mixed run anchored by a Latin token joins without spaces", () => {
  assert.equal(normalizeVoiceTranscript("KAESER เอส ดี หนึ่ง สอง"), "KAESERSD12");
});

test("Thai numerals always convert to Arabic digits", () => {
  assert.equal(normalizeVoiceTranscript("รหัส ๑๒๓๔"), "รหัส 1234");
});

test("ordinary Thai prose is never mangled", () => {
  assert.equal(normalizeVoiceTranscript("เปลี่ยนน้ำมันเครื่องแล้ว ห้า ลิตร"), "เปลี่ยนน้ำมันเครื่องแล้ว ห้า ลิตร");
  assert.equal(normalizeVoiceTranscript("ที มงานเสร็จแล้ว"), "ที มงานเสร็จแล้ว");
});

test("existing Latin letters and digits stay untouched", () => {
  assert.equal(normalizeVoiceTranscript("SN ABC-1234 ok"), "SN ABC-1234 ok");
});

test("single Thai digit word without a code context stays Thai", () => {
  assert.equal(normalizeVoiceTranscript("สอง"), "สอง");
});

test("empty and whitespace input returns empty", () => {
  assert.equal(normalizeVoiceTranscript("   "), "");
});

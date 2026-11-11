import { test } from "node:test";
import assert from "node:assert/strict";
import { applyTextPolish } from "./text-polish";

const write = (target: { value: string }, text: string) => { target.value = text; };

test("send technician text, apply the response, and retain exact original for undo", async () => {
  const target = { value: "ซ่อม SN AB123 แล้ว  ", isConnected: true };
  const original = await applyTextPolish(target, async text => {
    assert.equal(text, "ซ่อม SN AB123 แล้ว  ");
    return { text: "ดำเนินการซ่อม SN AB123 เรียบร้อยแล้ว" };
  }, write);
  assert.equal(target.value, "ดำเนินการซ่อม SN AB123 เรียบร้อยแล้ว");
  assert.equal(original, "ซ่อม SN AB123 แล้ว  ");
  if (original !== null) write(target, original);
  assert.equal(target.value, "ซ่อม SN AB123 แล้ว  ");
});

test("failed AI preserves the form and a manual retry updates the same field", async () => {
  const target = { value: "ข้อความช่าง", isConnected: true };
  await assert.rejects(applyTextPolish(target, async () => { throw new Error("offline"); }, write), /offline/);
  assert.equal(target.value, "ข้อความช่าง");
  await applyTextPolish(target, async () => ({ text: "ข้อความที่เกลาแล้ว" }), write);
  assert.equal(target.value, "ข้อความที่เกลาแล้ว");
});

test("empty AI output never clears the form", async () => {
  const target = { value: "ข้อมูลเดิม", isConnected: true };
  await assert.rejects(applyTextPolish(target, async () => ({ text: "  " }), write));
  assert.equal(target.value, "ข้อมูลเดิม");
});

test("new edits while awaiting AI are never overwritten", async () => {
  const target = { value: "ข้อมูลเดิม", isConnected: true };
  assert.equal(await applyTextPolish(target, async () => {
    target.value = "ช่างแก้ไขเพิ่ม";
    return { text: "ผล AI" };
  }, write), null);
  assert.equal(target.value, "ช่างแก้ไขเพิ่ม");
});

test("closed or unmounted forms are never updated", async () => {
  const target = { value: "ข้อมูลเดิม", isConnected: true };
  assert.equal(await applyTextPolish(target, async () => {
    target.isConnected = false;
    return { text: "ผล AI" };
  }, write), null);
  assert.equal(target.value, "ข้อมูลเดิม");
});
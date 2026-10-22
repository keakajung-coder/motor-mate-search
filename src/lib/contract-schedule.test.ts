import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { addMonthsClamped, spreadVisits } from "./contract-schedule";

describe("spreadVisits", () => {
  test("4 ครั้งต่อปี กระจายทุก 3 เดือน", () => {
    assert.deepEqual(spreadVisits("2026-01-15", 4), ["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"]);
  });

  test("12 ครั้งต่อปี ครบทุกเดือน", () => {
    const out = spreadVisits("2026-03-10", 12);
    assert.equal(out.length, 12);
    assert.equal(out[0], "2026-03-10");
    assert.equal(out[11], "2027-02-10");
  });

  test("6 ครั้งต่อปี ห่างครั้งละ 2 เดือน", () => {
    assert.deepEqual(spreadVisits("2026-02-01", 6), ["2026-02-01", "2026-04-01", "2026-06-01", "2026-08-01", "2026-10-01", "2026-12-01"]);
  });

  test("วันที่ 31 ไม่ล้นเดือน (31 ม.ค. + 1 เดือน → 28 ก.พ.)", () => {
    assert.equal(addMonthsClamped("2026-01-31", 1), "2026-02-28");
  });

  test("ค่าผิดปกติคืนลิสต์ว่าง / จำกัดสูงสุด 52 ครั้งและไม่ซ้ำวัน", () => {
    assert.deepEqual(spreadVisits("bad", 4), []);
    assert.deepEqual(spreadVisits("2026-01-01", 0), []);
    const out = spreadVisits("2026-01-01", 999);
    assert.equal(out.length, 52);
    assert.equal(new Set(out).size, 52);
  });
});

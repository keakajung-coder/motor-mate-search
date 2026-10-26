import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  addMonthsClamped,
  spreadVisits,
  calculateRelativeDate,
  generateContractSchedule,
} from "./contract-schedule.ts";

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

describe("calculateRelativeDate", () => {
  test("วันพุธ สัปดาห์ที่ 2 ของ ม.ค. 2026 (1 ม.ค. คือพฤหัส -> พุธแรก 7 ม.ค. -> พุธที่ 2 คือ 14 ม.ค.)", () => {
    const d = calculateRelativeDate(2026, 1, 2, 3); // week 2, dow 3 (Wed)
    assert.equal(d, "2026-01-14");
  });

  test("วันพุธ สัปดาห์ที่ 2 ของ เม.ย. 2026 (1 เม.ย. คือพุธแรก -> พุธที่ 2 คือ 8 เม.ย.)", () => {
    const d = calculateRelativeDate(2026, 4, 2, 3);
    assert.equal(d, "2026-04-08");
  });

  test("วันศุกร์ สัปดาห์สุดท้าย (-1) ของ ม.ค. 2026 (31 ม.ค. คือเสาร์ -> ศุกร์สุดท้ายคือ 30 ม.ค.)", () => {
    const d = calculateRelativeDate(2026, 1, -1, 5); // last week, Fri
    assert.equal(d, "2026-01-30");
  });
});

describe("generateContractSchedule", () => {
  test("รูปแบบ A (Fixed Date): ทุกวันที่ 15 ของรอบเดือน 4 ครั้ง/ปี", () => {
    const schedule = generateContractSchedule({
      startDate: "2026-01-01",
      visitsPerYear: 4,
      pattern: { type: "fixed_date", dayOfMonth: 15 },
    });
    assert.equal(schedule.length, 4);
    assert.equal(schedule[0].visit_date, "2026-01-15");
    assert.equal(schedule[1].visit_date, "2026-04-15");
    assert.equal(schedule[2].visit_date, "2026-07-15");
    assert.equal(schedule[3].visit_date, "2026-10-15");
    assert.equal(schedule[0].status, "unscheduled");
  });

  test("รูปแบบ B (Relative Day): ทุกวันพุธ สัปดาห์ที่ 2 ของรอบเดือน 4 ครั้ง/ปี", () => {
    const schedule = generateContractSchedule({
      startDate: "2026-01-01",
      visitsPerYear: 4,
      pattern: { type: "relative_day", weekOfMonth: 2, dayOfWeek: 3 }, // 2nd Wednesday
    });
    assert.equal(schedule.length, 4);
    assert.equal(schedule[0].visit_date, "2026-01-14");
    assert.equal(schedule[0].dayOfWeekLabelTh, "วันพุธ");
    assert.equal(schedule[1].visit_date, "2026-04-08");
    assert.equal(schedule[1].dayOfWeekLabelTh, "วันพุธ");
    assert.equal(schedule[2].visit_date, "2026-07-08");
    assert.equal(schedule[3].visit_date, "2026-10-14");
    assert.equal(schedule[0].status, "unscheduled");
  });
});


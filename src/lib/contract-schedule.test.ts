import { describe, expect, test } from "bun:test";
import { addMonthsClamped, spreadVisits } from "./contract-schedule";

describe("spreadVisits", () => {
  test("4 ครั้งต่อปี กระจายทุก 3 เดือน", () => {
    expect(spreadVisits("2026-01-15", 4)).toEqual(["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"]);
  });

  test("12 ครั้งต่อปี ครบทุกเดือน", () => {
    const out = spreadVisits("2026-03-10", 12);
    expect(out).toHaveLength(12);
    expect(out[0]).toBe("2026-03-10");
    expect(out[11]).toBe("2027-02-10");
  });

  test("6 ครั้งต่อปี ห่างครั้งละ 2 เดือน", () => {
    const out = spreadVisits("2026-02-01", 6);
    expect(out).toEqual(["2026-02-01", "2026-04-01", "2026-06-01", "2026-08-01", "2026-10-01", "2026-12-01"]);
  });

  test("วันที่ 31 ไม่ล้นเดือน (31 ม.ค. + 1 เดือน → 28 ก.พ.)", () => {
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
  });

  test("ค่าผิดปกติคืนลิสต์ว่าง / จำกัดสูงสุด 52 ครั้ง", () => {
    expect(spreadVisits("bad", 4)).toEqual([]);
    expect(spreadVisits("2026-01-01", 0)).toEqual([]);
    expect(spreadVisits("2026-01-01", 999)).toHaveLength(52);
  });
});

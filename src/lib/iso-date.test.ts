import { describe, expect, it } from "vitest";
import { toIsoDate } from "./iso-date";
describe("toIsoDate", () => {
  it("keeps ISO", () => expect(toIsoDate("2026-11-17")).toBe("2026-11-17"));
  it("converts Buddhist-era DD/MM/YYYY", () => expect(toIsoDate("17/11/2569")).toBe("2026-11-17"));
  it("converts Buddhist-era ISO year", () => expect(toIsoDate("2569-01-05")).toBe("2026-01-05"));
  it("rejects invalid", () => expect(toIsoDate("31/02/2026")).toBeNull());
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { toIsoDate } from "./iso-date";
test("keeps ISO", () => assert.equal(toIsoDate("2026-11-17"), "2026-11-17"));
test("converts Buddhist-era DD/MM/YYYY", () => assert.equal(toIsoDate("17/11/2569"), "2026-11-17"));
test("converts Buddhist-era ISO year", () => assert.equal(toIsoDate("2569-01-05"), "2026-01-05"));
test("rejects invalid", () => assert.equal(toIsoDate("31/02/2026"), null));

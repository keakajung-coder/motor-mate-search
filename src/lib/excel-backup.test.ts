import { test } from "node:test";
import assert from "node:assert/strict";
import { isBackupDue } from "./excel-backup.functions";

const now = Date.parse("2026-10-07T00:00:00Z");
test("off never due", () => assert.equal(isBackupDue("off", "", now), false));
test("daily due after 24h", () => assert.equal(isBackupDue("daily", "2026-10-05T23:00:00Z", now), true));
test("daily not due within 24h", () => assert.equal(isBackupDue("daily", "2026-10-06T12:00:00Z", now), false));
test("weekly not due after 3 days", () => assert.equal(isBackupDue("weekly", "2026-10-04T00:00:00Z", now), false));

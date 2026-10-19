import { describe, expect, it } from "vitest";
import { CHECK_TIMEOUT_MS, NETWORK_FAILURES_FOR_OFFLINE } from "@/components/ConnectionKeeper";

describe("connection keeper rules", () => {
  it("waits 15 seconds before a check times out", () => {
    expect(CHECK_TIMEOUT_MS).toBe(15_000);
  });
  it("needs more than one hard network failure before showing offline", () => {
    expect(NETWORK_FAILURES_FOR_OFFLINE).toBeGreaterThan(1);
  });
});

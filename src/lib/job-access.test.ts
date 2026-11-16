import { test } from "node:test";
import assert from "node:assert/strict";
import { jobPermissions, shouldDimJob } from "./job-access";

test("verified admin can edit even when a filtered view passes canEdit=false", () => {
  assert.equal(jobPermissions(true, false).canEdit, true);
  assert.equal(jobPermissions(false, false).canEdit, false);
});
test("only verified admins can approve, never an employee selection", () => {
  assert.equal(jobPermissions(true).canApprove, true);
  assert.equal(jobPermissions(false, true).canApprove, false);
});
test("admin jobs remain undimmed when selecting another seller or technician", () => {
  for (const department of ["seller", "tech"]) {
    assert.equal(shouldDimJob(true, false, department), false);
    assert.equal(shouldDimJob(false, false, department), true);
  }
});
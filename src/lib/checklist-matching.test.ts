import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findChecklistTemplate, matchesType } from "./checklist-matching";

describe("pump-type checklist assignment", () => {
  it("assigns the screw compressor template when screw type is selected", () => {
    const screw = { id: "screw", pump_type: "ปั๊มลมสกรู" };
    assert.deepEqual(findChecklistTemplate([{ id: "piston", pump_type: "ปั๊มลมลูกสูบ" }, screw], "ปั๊มลมสกรู"), screw);
  });
  it("does not assign an unrelated or blank type", () => {
    assert.equal(matchesType({ pump_type: "ปั๊มลมสกรู" }, "ปั๊มลม"), false);
    assert.equal(matchesType({ pump_type: "ปั๊มลมสกรู" }, ""), false);
  });
  it("keeps legacy multi-type templates working", () => {
    assert.equal(matchesType({ machine_types: "ปั๊มลมสกรู, ปั๊มลมลูกสูบ" }, "ปั๊มลมลูกสูบ"), true);
  });
  it("prioritizes the explicit pump_type relationship over the legacy field", () => {
    const explicit = { id: "new", pump_type: "ปั๊มลมสกรู", machine_types: "ปั๊มลมลูกสูบ" };
    assert.deepEqual(findChecklistTemplate([{ id: "old", machine_types: "ปั๊มลมสกรู" }, explicit], "ปั๊มลมสกรู"), explicit);
    assert.equal(matchesType(explicit, "ปั๊มลมลูกสูบ"), false);
  });
});
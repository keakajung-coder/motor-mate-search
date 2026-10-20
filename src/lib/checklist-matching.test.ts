import { describe, expect, it } from "vitest";
import { findChecklistTemplate, matchesType } from "./checklist-matching";

describe("pump-type checklist assignment", () => {
  it("assigns the screw compressor template when screw type is selected", () => {
    const screw = { id: "screw", pump_type: "ปั๊มลมสกรู" };
    expect(findChecklistTemplate([{ id: "piston", pump_type: "ปั๊มลมลูกสูบ" }, screw], "ปั๊มลมสกรู")).toEqual(screw);
  });
  it("does not assign an unrelated or blank type", () => {
    expect(matchesType({ pump_type: "ปั๊มลมสกรู" }, "ปั๊มลม")).toBe(false);
    expect(matchesType({ pump_type: "ปั๊มลมสกรู" }, "")).toBe(false);
  });
  it("keeps legacy multi-type templates working", () => {
    expect(matchesType({ machine_types: "ปั๊มลมสกรู, ปั๊มลมลูกสูบ" }, "ปั๊มลมลูกสูบ")).toBe(true);
  });
  it("prioritizes the explicit pump_type relationship over the legacy field", () => {
    const explicit = { id: "new", pump_type: "ปั๊มลมสกรู", machine_types: "ปั๊มลมลูกสูบ" };
    expect(findChecklistTemplate([{ id: "old", machine_types: "ปั๊มลมสกรู" }, explicit], "ปั๊มลมสกรู")).toEqual(explicit);
    expect(matchesType(explicit, "ปั๊มลมลูกสูบ")).toBe(false);
  });
});
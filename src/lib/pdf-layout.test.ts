import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { pdfLayout } from "./pdf-layout";

describe("PDF orientation and page limits", () => {
  test("portrait uses vertical A4", () => {
    const result = pdfLayout(794, 2500, { orientation: "portrait", pages: 0 });
    assert.deepEqual([result.pageWidth, result.pageHeight], [210, 297]);
  });
  test("landscape uses horizontal A4", () => {
    const result = pdfLayout(1123, 2500, { orientation: "landscape", pages: 0 });
    assert.deepEqual([result.pageWidth, result.pageHeight], [297, 210]);
  });
  for (const pages of [1, 2]) test(`limit ${pages} includes every pixel without extra pages`, () => {
    const result = pdfLayout(794, 6000, { orientation: "portrait", pages }, [900, 1700, 2700, 3600, 4700, 5600]);
    assert.ok(result.slices.length <= pages);
    assert.ok(Math.abs(result.slices.reduce((sum, s) => sum + s.height, 0) - 6000) < 0.000001);
    for (const slice of result.slices) assert.ok(slice.height * result.imageWidth / 794 <= 281.001);
  });
  test("automatic pagination keeps full-width readable text", () => {
    const result = pdfLayout(794, 6000, { orientation: "portrait", pages: 0 });
    assert.equal(result.imageWidth, 194);
    assert.ok(result.slices.length > 2);
  });
  test("short documents never append blank pages", () => {
    assert.equal(pdfLayout(794, 200, { orientation: "portrait", pages: 2 }).slices.length, 1);
  });
});
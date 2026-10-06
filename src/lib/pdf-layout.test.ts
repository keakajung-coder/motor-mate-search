import { describe, test, expect } from "bun:test";
import { pdfLayout } from "./pdf-layout";

describe("PDF orientation and page limits", () => {
  test("portrait uses vertical A4", () => {
    const result = pdfLayout(794, 2500, { orientation: "portrait", pages: 0 });
    expect([result.pageWidth, result.pageHeight]).toEqual([210, 297]);
  });
  test("landscape uses horizontal A4", () => {
    const result = pdfLayout(1123, 2500, { orientation: "landscape", pages: 0 });
    expect([result.pageWidth, result.pageHeight]).toEqual([297, 210]);
  });
  for (const pages of [1, 2]) test(`limit ${pages} includes every pixel without extra pages`, () => {
    const result = pdfLayout(794, 6000, { orientation: "portrait", pages }, [900, 1700, 2700, 3600, 4700, 5600]);
    expect(result.slices.length).toBeLessThanOrEqual(pages);
    expect(result.slices.reduce((sum, s) => sum + s.height, 0)).toBeCloseTo(6000, 6);
    for (const slice of result.slices) expect(slice.height * result.imageWidth / 794).toBeLessThanOrEqual(281.001);
  });
  test("automatic pagination keeps full-width readable text", () => {
    const result = pdfLayout(794, 6000, { orientation: "portrait", pages: 0 });
    expect(result.imageWidth).toBe(194);
    expect(result.slices.length).toBeGreaterThan(2);
  });
  test("short documents never append blank pages", () => {
    expect(pdfLayout(794, 200, { orientation: "portrait", pages: 2 }).slices.length).toBe(1);
  });
});
import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { findCleanBreakY } from "./report";

describe("findCleanBreakY whitespace snapping", () => {
  test("findCleanBreakY snaps upward to whitespace between two text lines", () => {
    // Setup a mock image of 400 x 300 px
    // Text line 1 at rows 100..120
    // Whitespace at rows 121..135 (clean background)
    // Text line 2 at rows 136..155
    // TargetY is 145 (cutting through text line 2)
    const W = 400;
    const H = 300;
    const mockImg = { width: W, height: H } as unknown as HTMLImageElement;

    const originalDocument = globalThis.document;
    try {
      globalThis.document = {
        createElement: (tag: string) => {
          if (tag === "canvas") {
            return {
              width: 0,
              height: 0,
              getContext: () => ({
                drawImage: () => {},
                getImageData: (_x: number, _y: number, w: number, h: number) => {
                  const data = new Uint8ClampedArray(w * h * 4);
                  data.fill(255); // Default white background

                  const setDarkRow = (imgY: number) => {
                    const r = imgY - 95;
                    if (r >= 0 && r < h) {
                      for (let x = 10; x < 350; x++) {
                        const idx = (r * w + x) * 4;
                        data[idx] = 20;     // Red (dark)
                        data[idx + 1] = 20; // Green (dark)
                        data[idx + 2] = 20; // Blue (dark)
                        data[idx + 3] = 255;
                      }
                    }
                  };

                  // Text line 1: 100..120
                  for (let Y = 100; Y <= 120; Y++) setDarkRow(Y);
                  // Text line 2: 136..155
                  for (let Y = 136; Y <= 155; Y++) setDarkRow(Y);

                  return { data, width: w, height: h };
                },
              }),
            } as any;
          }
          return {} as any;
        },
      } as any;

      // targetY=145 is inside text line 2 (136..155).
      // findCleanBreakY should search upward and find the whitespace band 121..135!
      // Center of 121..135 is 128.
      const clean = findCleanBreakY(mockImg, 145, 50, 20);
      assert.ok(clean >= 121 && clean <= 135, `Expected clean break in whitespace band [121..135], got ${clean}`);
      assert.equal(clean, 128);
    } finally {
      globalThis.document = originalDocument;
    }
  });

  test("returns targetY safely when targetY is at or beyond boundaries", () => {
    const mockImg = { width: 400, height: 300 } as unknown as HTMLImageElement;
    assert.equal(findCleanBreakY(mockImg, -10), -10);
    assert.equal(findCleanBreakY(mockImg, 0), 0);
    assert.equal(findCleanBreakY(mockImg, 300), 300);
    assert.equal(findCleanBreakY(mockImg, 500), 500);
  });
});

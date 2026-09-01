import { describe, expect, it } from "vitest";
import { bboxInside, type BBox } from "@/lib/geo";

const outer: BBox = { n: 42, s: 41, e: 13, w: 12 };

describe("bboxInside", () => {
  it("returns true for a bbox fully inside another", () => {
    const inner: BBox = { n: 41.9, s: 41.1, e: 12.9, w: 12.1 };
    expect(bboxInside(inner, outer)).toBe(true);
  });

  it("returns true for identical bboxes", () => {
    expect(bboxInside(outer, outer)).toBe(true);
  });

  it("returns false when the bbox extends north beyond the container", () => {
    const overflow: BBox = { n: 42.5, s: 41.1, e: 12.9, w: 12.1 };
    expect(bboxInside(overflow, outer)).toBe(false);
  });

  it("returns false when the bbox extends south beyond the container", () => {
    const overflow: BBox = { n: 41.9, s: 40.5, e: 12.9, w: 12.1 };
    expect(bboxInside(overflow, outer)).toBe(false);
  });

  it("returns false when the bbox extends east beyond the container", () => {
    const overflow: BBox = { n: 41.9, s: 41.1, e: 13.5, w: 12.1 };
    expect(bboxInside(overflow, outer)).toBe(false);
  });

  it("returns false when the bbox extends west beyond the container", () => {
    const overflow: BBox = { n: 41.9, s: 41.1, e: 12.9, w: 11.5 };
    expect(bboxInside(overflow, outer)).toBe(false);
  });

  it("returns false for a disjoint bbox", () => {
    const far: BBox = { n: 40, s: 39, e: 11, w: 10 };
    expect(bboxInside(far, outer)).toBe(false);
  });
});

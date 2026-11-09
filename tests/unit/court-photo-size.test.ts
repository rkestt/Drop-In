import { describe, expect, it } from "vitest";
import { computeTargetSize } from "@/lib/storage/court-photos";

describe("computeTargetSize", () => {
  it("scales a landscape photo by its long side (4000x3000 -> 1600x1200)", () => {
    expect(computeTargetSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  });

  it("scales a portrait photo by its long side (3000x4000 -> 1200x1600)", () => {
    expect(computeTargetSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });

  it("leaves a small photo untouched (800x600)", () => {
    expect(computeTargetSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("leaves a photo exactly at the limit untouched (1600x1600)", () => {
    expect(computeTargetSize(1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it("scales a large square photo (2000x2000 -> 1600x1600)", () => {
    expect(computeTargetSize(2000, 2000)).toEqual({ width: 1600, height: 1600 });
  });

  it("never upscales: smaller side stays proportional without exceeding the limit", () => {
    const target = computeTargetSize(5000, 100);
    expect(target.width).toBe(1600);
    expect(target.height).toBeLessThanOrEqual(1600);
    expect(target.height).toBe(Math.round((100 * 1600) / 5000));
  });
});

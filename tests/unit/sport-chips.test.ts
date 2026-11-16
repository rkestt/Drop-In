import { describe, expect, it } from "vitest";
import {
  SPORT_CHIP_OPTIONS,
  nextChipIndex,
  sportToStorage,
} from "@/lib/sport/chip-options";
import { SPORTS, fromStorage, sportLabel } from "@/lib/sport/sports";

describe("SPORT_CHIP_OPTIONS", () => {
  it("8 options, last is Tutti", () => {
    expect(SPORT_CHIP_OPTIONS).toHaveLength(8);
    expect(SPORT_CHIP_OPTIONS[7]).toEqual({ value: null, label: "Tutti" });
  });
  it("every SPORTS value appears exactly once", () => {
    const values = SPORT_CHIP_OPTIONS.map((o) => o.value);
    for (const s of SPORTS) {
      expect(values.filter((v) => v === s.value)).toHaveLength(1);
    }
  });
  it("every label equals sportLabel(value)", () => {
    for (const o of SPORT_CHIP_OPTIONS) {
      expect(o.label).toBe(sportLabel(o.value));
    }
  });
});

describe("nextChipIndex", () => {
  it("(0,-1) -> 7", () => {
    expect(nextChipIndex(0, -1, 8)).toBe(7);
  });
  it("(7,1) -> 0", () => {
    expect(nextChipIndex(7, 1, 8)).toBe(0);
  });
  it("(0,1) -> 1", () => {
    expect(nextChipIndex(0, 1, 8)).toBe(1);
  });
  it("(7,-1) -> 6", () => {
    expect(nextChipIndex(7, -1, 8)).toBe(6);
  });
  it("single-element group stays at 0", () => {
    expect(nextChipIndex(0, 1, 1)).toBe(0);
    expect(nextChipIndex(0, -1, 1)).toBe(0);
  });
});

describe("sportToStorage", () => {
  it("null -> 'all'", () => {
    expect(sportToStorage(null)).toBe("all");
  });
  it("'tennis' -> 'tennis'", () => {
    expect(sportToStorage("tennis")).toBe("tennis");
  });
  it("round-trip with fromStorage", () => {
    expect(fromStorage(sportToStorage(null))).toBeNull();
    expect(fromStorage(sportToStorage("padel"))).toBe("padel");
  });
});

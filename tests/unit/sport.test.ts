import { describe, expect, it } from "vitest";
import { sportMatches, fromStorage, toRpcSport } from "@/lib/sport/sports";

describe("sportMatches", () => {
  it("multi visible under every sport", () => {
    expect(sportMatches("multi", "basketball")).toBe(true);
    expect(sportMatches("multi", "soccer")).toBe(true);
  });
  it("'basketball;volleyball' visible under both", () => {
    expect(sportMatches("basketball;volleyball", "basketball")).toBe(true);
    expect(sportMatches("basketball;volleyball", "volleyball")).toBe(true);
  });
  it("null court visible only with null active", () => {
    expect(sportMatches(null, null)).toBe(true);
    expect(sportMatches(null, "basketball")).toBe(false);
  });
  it("different sport -> false", () => {
    expect(sportMatches("soccer", "basketball")).toBe(false);
  });
  it("null active -> always true", () => {
    expect(sportMatches("soccer", null)).toBe(true);
    expect(sportMatches(null, null)).toBe(true);
  });
});

describe("fromStorage", () => {
  it("valid value", () => {
    expect(fromStorage("soccer")).toBe("soccer");
  });
  it("unknown -> basketball", () => {
    expect(fromStorage("nope")).toBe("basketball");
  });
  it("'all' -> null", () => {
    expect(fromStorage("all")).toBeNull();
  });
  it("null/absence -> basketball", () => {
    expect(fromStorage(null)).toBe("basketball");
  });
});

describe("toRpcSport", () => {
  it("null for Tutti", () => {
    expect(toRpcSport(null)).toBeNull();
  });
  it("osm string otherwise", () => {
    expect(toRpcSport("basketball")).toBe("basketball");
  });
});
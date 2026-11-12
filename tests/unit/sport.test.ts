import { describe, expect, it } from "vitest";
import {
  sportEmptyPhrase,
  sportMatches,
  fromStorage,
  toRpcSport,
} from "@/lib/sport/sports";

describe("sportMatches", () => {
  it("multi visible under every sport", () => {
    expect(sportMatches("multi", "basketball")).toBe(true);
    expect(sportMatches("multi", "soccer")).toBe(true);
  });
  it("'basketball;volleyball' visible under both", () => {
    expect(sportMatches("basketball;volleyball", "basketball")).toBe(true);
    expect(sportMatches("basketball;volleyball", "volleyball")).toBe(true);
  });
  // #71: NULL = "sport non specificato" → visibile con qualunque filtro.
  it("null court visible under every filter", () => {
    expect(sportMatches(null, null)).toBe(true);
    expect(sportMatches(null, "basketball")).toBe(true);
    expect(sportMatches(null, "padel")).toBe(true);
  });
  it("identity", () => {
    expect(sportMatches("basketball", "basketball")).toBe(true);
  });
  it("composite with spaces", () => {
    expect(sportMatches("basketball; volleyball", "volleyball")).toBe(true);
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
  it("empty string -> null", () => {
    expect(fromStorage("")).toBeNull();
  });
  it("'null' string -> null", () => {
    expect(fromStorage("null")).toBeNull();
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

describe("sportEmptyPhrase", () => {
  it("lobby copy: 'di' + etichetta minuscola", () => {
    expect(sportEmptyPhrase("basketball")).toBe("di basket");
    expect(sportEmptyPhrase("soccer")).toBe("di calcio");
    expect(sportEmptyPhrase("futsal")).toBe("di calcio a 5");
    expect(sportEmptyPhrase("volleyball")).toBe("di pallavolo");
  });
  it("campo copy: 'da' + etichetta minuscola", () => {
    expect(sportEmptyPhrase("basketball", "da")).toBe("da basket");
    expect(sportEmptyPhrase("padel", "da")).toBe("da padel");
  });
  it("tennis in entrambe le preposizioni", () => {
    expect(sportEmptyPhrase("tennis")).toBe("di tennis");
    expect(sportEmptyPhrase("tennis", "da")).toBe("da tennis");
  });
  it("'multi' è un aggettivo: niente preposizione in entrambe le forme", () => {
    expect(sportEmptyPhrase("multi")).toBe("polivalente");
    expect(sportEmptyPhrase("multi", "da")).toBe("polivalente");
  });
});
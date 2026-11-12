import { describe, expect, it } from "vitest";
import { sportMatches } from "@/lib/sport/sports";
import { courtSportsLabel, sportDisplayLabel } from "@/lib/courts/search";

/**
 * #71/#72: `sport IS NULL` = "sport non specificato", visibile con qualunque
 * filtro sport (default temporaneo in attesa del backfill #63).
 */
describe("sportMatches con sport NULL (#71)", () => {
  it("corte NULL visibile con filtro attivo", () => {
    expect(sportMatches(null, "basketball")).toBe(true);
  });
  it("corte NULL visibile senza filtro", () => {
    expect(sportMatches(null, null)).toBe(true);
  });
  it("sport diverso resta escluso", () => {
    expect(sportMatches("soccer", "basketball")).toBe(false);
  });
  it("composto con match resta visibile", () => {
    expect(sportMatches("basketball;soccer", "soccer")).toBe(true);
  });
});

describe("sportDisplayLabel (#72)", () => {
  it("NULL e stringa vuota → 'Sport non specificato'", () => {
    expect(sportDisplayLabel(null)).toBe("Sport non specificato");
    expect(sportDisplayLabel("")).toBe("Sport non specificato");
    expect(sportDisplayLabel(" ; ")).toBe("Sport non specificato");
  });
  it("'multi' → 'Polivalente'", () => {
    expect(sportDisplayLabel("multi")).toBe("Polivalente");
  });
  it("composto → etichette unite", () => {
    expect(sportDisplayLabel("basketball;soccer")).toBe("Basket · Calcio");
  });
  it("courtSportsLabel resta NULL per sport ignoto (nessun cambio)", () => {
    expect(courtSportsLabel(null)).toBeNull();
  });
});

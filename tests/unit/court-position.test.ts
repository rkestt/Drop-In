import { describe, expect, it } from "vitest";
import {
  ADDRESS_MAX,
  clampAddressInput,
  formatCoordinateValue,
  formatCoordinates,
  isValidLatLng,
  isValidLatitude,
  isValidLongitude,
  parseCoordinate,
  sanitizeAddress,
} from "@/lib/court/position";

describe("parseCoordinate", () => {
  it("accetta decimali con punto", () => {
    expect(parseCoordinate("41.8919", "lat")).toEqual({
      valid: true,
      value: 41.8919,
      error: null,
    });
  });

  it("accetta la virgola come separatore decimale (tastiera italiana)", () => {
    const r = parseCoordinate("12,5113", "lng");
    expect(r.valid).toBe(true);
    expect(r.value).toBe(12.5113);
  });

  it("accetta segno, spazi ai bordi e valori limite", () => {
    expect(parseCoordinate("  -90  ", "lat").value).toBe(-90);
    expect(parseCoordinate("90", "lat").value).toBe(90);
    expect(parseCoordinate("180", "lng").value).toBe(180);
    expect(parseCoordinate("-180", "lng").value).toBe(-180);
    expect(parseCoordinate("+41.5", "lat").value).toBe(41.5);
  });

  it("rifiuta valori fuori range con messaggio italiano", () => {
    const lat = parseCoordinate("90.0001", "lat");
    expect(lat.valid).toBe(false);
    expect(lat.value).toBeNull();
    expect(lat.error).toMatch(/-90 e 90/);

    const lng = parseCoordinate("-180.5", "lng");
    expect(lng.valid).toBe(false);
    expect(lng.error).toMatch(/-180 e 180/);
  });

  it("rifiuta testo, esadecimali e notazione scientifica", () => {
    for (const raw of ["abc", "0x10", "1e3", "Infinity", "NaN", "41.8.9", "41 8"]) {
      const r = parseCoordinate(raw, "lat");
      expect(r.valid, raw).toBe(false);
      expect(r.error, raw).not.toBeNull();
    }
  });

  it("vuoto non è un errore: significa 'non ancora inserita'", () => {
    const r = parseCoordinate("   ", "lat");
    expect(r.valid).toBe(false);
    expect(r.value).toBeNull();
    expect(r.error).toBeNull();
  });
});

describe("isValidLatitude / isValidLongitude", () => {
  it("accetta i limiti e rifiuta NaN/infinito", () => {
    expect(isValidLatitude(-90)).toBe(true);
    expect(isValidLatitude(90)).toBe(true);
    expect(isValidLatitude(90.1)).toBe(false);
    expect(isValidLatitude(Number.NaN)).toBe(false);
    expect(isValidLongitude(180)).toBe(true);
    expect(isValidLongitude(-180)).toBe(true);
    expect(isValidLongitude(180.1)).toBe(false);
    expect(isValidLongitude(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidLatLng(41.9, 12.5)).toBe(true);
    expect(isValidLatLng(41.9, 200)).toBe(false);
  });
});

describe("formattazione", () => {
  it("formatCoordinateValue usa al massimo 5 decimali e toglie gli zeri finali", () => {
    expect(formatCoordinateValue(41.8919)).toBe("41.8919");
    expect(formatCoordinateValue(41.891904)).toBe("41.8919");
    expect(formatCoordinateValue(12.5)).toBe("12.5");
    expect(formatCoordinateValue(0)).toBe("0");
    expect(formatCoordinateValue(-0.000001)).toBe("0");
  });

  it("formatCoordinates produce testo leggibile a 5 decimali", () => {
    expect(formatCoordinates(41.8919, 12.5113)).toBe("41.89190, 12.51130");
  });
});

describe("indirizzo", () => {
  it("clampAddressInput toglie gli a capo ma non trimma lo spazio in digitazione", () => {
    expect(clampAddressInput("Via\nRoma\t10")).toBe("Via Roma 10");
    expect(clampAddressInput("Via ")).toBe("Via ");
    expect(clampAddressInput("x".repeat(250))).toHaveLength(ADDRESS_MAX);
  });

  it("sanitizeAddress normalizza gli spazi e trimma", () => {
    expect(sanitizeAddress("  Via   Roma 10  ")).toBe("Via Roma 10");
    expect(sanitizeAddress("Via Roma 10\nRoma")).toBe("Via Roma 10 Roma");
    expect(sanitizeAddress("   ")).toBe("");
    expect(sanitizeAddress("y".repeat(250))).toHaveLength(ADDRESS_MAX);
  });
});

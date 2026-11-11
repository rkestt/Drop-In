import { describe, expect, it } from "vitest";
import {
  bboxCenter,
  courtDistanceM,
  formatDistanceM,
  haversineM,
  isWithinRadiusM,
  NEARBY_RADIUS_M,
  ROME_CENTER,
  selectLobbiesOrigin,
} from "@/lib/lobbies/nearby";

// Centro Roma (stesso dei test e2e d20).
const LAT = 41.9;
const LNG = 12.5;

describe("haversineM", () => {
  it("stesso punto = 0", () => {
    expect(haversineM(LAT, LNG, LAT, LNG)).toBe(0);
  });
  it("ordine di grandezza Roma: ~3.9 km per la corte seedata", () => {
    const d = haversineM(LAT, LNG, 41.8694746, 12.5211922);
    expect(d).toBeGreaterThan(3000);
    expect(d).toBeLessThan(5000);
  });
});

describe("courtDistanceM", () => {
  it("coordinate valide = distanza reale", () => {
    expect(courtDistanceM(LAT, LNG, 41.8694746, 12.5211922)).not.toBeNull();
  });
  it.each([[null, 12.5], [41.9, null], [null, null], [undefined, undefined]])(
    "coordinate assenti (%o, %o) = null, mai NaN",
    (lat, lng) => {
      expect(courtDistanceM(LAT, LNG, lat, lng)).toBeNull();
    }
  );
  it("NaN non passa come distanza", () => {
    expect(courtDistanceM(LAT, LNG, NaN, NaN)).toBeNull();
  });
});

describe("isWithinRadiusM", () => {
  it("dentro il raggio di default", () => {
    expect(isWithinRadiusM(LAT, LNG, 41.8694746, 12.5211922)).toBe(true);
  });
  it("Milano non è vicina a Roma", () => {
    expect(isWithinRadiusM(LAT, LNG, 45.4642, 9.19)).toBe(false);
  });
  it("coordinate assenti = fuori, anche se il confronto NaN > raggio sarebbe false", () => {
    expect(isWithinRadiusM(LAT, LNG, null, null)).toBe(false);
    expect(isWithinRadiusM(LAT, LNG, NaN, NaN)).toBe(false);
  });
  it("raggio custom rispettato", () => {
    expect(isWithinRadiusM(LAT, LNG, 41.8694746, 12.5211922, 100)).toBe(false);
    expect(
      isWithinRadiusM(LAT, LNG, 41.8694746, 12.5211922, NEARBY_RADIUS_M)
    ).toBe(true);
  });
});

describe("formatDistanceM", () => {
  it("sotto il km in metri", () => {
    expect(formatDistanceM(276)).toBe("276 m");
  });
  it("sopra il km con virgola it-IT", () => {
    expect(formatDistanceM(2400)).toBe("2,4 km");
  });
});

describe("bboxCenter", () => {
  it("media dei bordi", () => {
    expect(bboxCenter({ n: 41.95, s: 41.83, e: 12.62, w: 12.4 })).toEqual({
      lat: 41.89,
      lng: 12.51,
    });
  });
});

describe("selectLobbiesOrigin", () => {
  const bounds = { n: 41.95, s: 41.83, e: 12.62, w: 12.4 };
  it("la posizione utente vince su mappa e fallback", () => {
    expect(selectLobbiesOrigin([12.5, 41.9], bounds)).toEqual({
      lat: 41.9,
      lng: 12.5,
    });
  });
  it("senza posizione: centro della mappa", () => {
    expect(selectLobbiesOrigin(null, bounds)).toEqual({
      lat: 41.89,
      lng: 12.51,
    });
  });
  it("senza posizione ne' mappa: fallback Roma", () => {
    expect(selectLobbiesOrigin(null, null)).toEqual(ROME_CENTER);
    expect(selectLobbiesOrigin(undefined, undefined)).toEqual(ROME_CENTER);
  });
  it("fallback custom rispettato", () => {
    expect(selectLobbiesOrigin(null, null, { lat: 45.46, lng: 9.19 })).toEqual(
      { lat: 45.46, lng: 9.19 }
    );
  });
});

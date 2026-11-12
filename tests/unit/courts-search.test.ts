import { describe, expect, it } from "vitest";
import {
  SEARCH_LIMIT,
  SEARCH_RADIUS_M,
  courtSportsLabel,
  isSearchActive,
  mapNearbyCourtRow,
  normalizeSearchQuery,
  searchQueryText,
  selectSearchOrigin,
  shouldFetchSearch,
  venueTypeLabel,
  type NearbyCourtRow,
} from "@/lib/courts/search";

const ROW: NearbyCourtRow = {
  id: "a4dbc1f9-7db6-47f4-ba39-f5f9e0c0b18e",
  name: "Campo di Piazza Bologna",
  lat: 41.91,
  lng: 12.52,
  address: null,
  surface_type: "asphalt",
  hoop_count: 2,
  venue_type: "field_basketball",
  sport: "basketball",
  status: "active",
  distance_m: 1234.5,
  photo_path: null,
};

describe("limiti della ricerca", () => {
  it("raggio 25 km e tetto 50 risultati", () => {
    expect(SEARCH_RADIUS_M).toBe(25_000);
    expect(SEARCH_LIMIT).toBe(50);
  });
});

describe("normalizeSearchQuery", () => {
  it("minuscolo, senza accenti, spazi compattati", () => {
    expect(normalizeSearchQuery("  Città   Roma ")).toBe("citta roma");
  });
  it("query di soli spazi = vuota", () => {
    expect(normalizeSearchQuery("   ")).toBe("");
  });
});

describe("searchQueryText", () => {
  it("preserva accenti e maiuscole per l'ILIKE del database", () => {
    expect(searchQueryText("  Città  ")).toBe("Città");
  });
  it("compatta gli spazi interni", () => {
    expect(searchQueryText("roma   nord")).toBe("roma nord");
  });
});

describe("isSearchActive", () => {
  it.each(["", "   ", "  \t "])("vuota (%o) = inattiva", (raw) => {
    expect(isSearchActive(raw)).toBe(false);
  });
  it("qualsiasi lettera = attiva", () => {
    expect(isSearchActive(" r ")).toBe(true);
  });
});

describe("shouldFetchSearch", () => {
  it("query vuota = nessuna fetch", () => {
    expect(shouldFetchSearch("", "roma")).toBe(false);
    expect(shouldFetchSearch("   ", null)).toBe(false);
  });
  it("prima ricerca = fetch", () => {
    expect(shouldFetchSearch("roma", null)).toBe(true);
    expect(shouldFetchSearch("roma", "")).toBe(true);
  });
  it("stessa query normalizzata = nessuna fetch", () => {
    expect(shouldFetchSearch(" Roma ", "roma")).toBe(false);
    expect(shouldFetchSearch("citta", "Città ")).toBe(false);
  });
  it("query diversa = fetch", () => {
    expect(shouldFetchSearch("roma", "milano")).toBe(true);
  });
});

describe("selectSearchOrigin", () => {
  const bounds = { n: 41.95, s: 41.83, e: 12.62, w: 12.4 };
  it("il centro mappa vince sulla posizione utente", () => {
    expect(selectSearchOrigin(bounds, [12.5, 41.9], { lat: 0, lng: 0 })).toEqual({
      lat: 41.89,
      lng: 12.51,
    });
  });
  it("senza mappa: posizione utente", () => {
    expect(selectSearchOrigin(null, [12.5, 41.9], { lat: 0, lng: 0 })).toEqual({
      lat: 41.9,
      lng: 12.5,
    });
  });
  it("senza mappa né posizione: fallback", () => {
    expect(
      selectSearchOrigin(undefined, undefined, { lat: 45.46, lng: 9.19 })
    ).toEqual({ lat: 45.46, lng: 9.19 });
  });
});

describe("mapNearbyCourtRow", () => {
  it("copia i campi e mantiene la distanza", () => {
    const court = mapNearbyCourtRow(ROW);
    expect(court).toMatchObject({
      id: ROW.id,
      name: ROW.name,
      lat: ROW.lat,
      lng: ROW.lng,
      venue_type: "field_basketball",
      sport: "basketball",
      distance_m: 1234.5,
    });
  });
  it("non inventa source e moderation_status che la RPC non ritorna", () => {
    const court = mapNearbyCourtRow(ROW);
    expect(court.source).toBeUndefined();
    expect(court.moderation_status).toBeUndefined();
  });
  it("distanza non finita = null, zero resta zero", () => {
    expect(mapNearbyCourtRow({ ...ROW, distance_m: Number.NaN }).distance_m).toBeNull();
    expect(mapNearbyCourtRow({ ...ROW, distance_m: 0 }).distance_m).toBe(0);
  });
  it("null del database restano null", () => {
    const court = mapNearbyCourtRow({
      ...ROW,
      address: null,
      surface_type: null,
      hoop_count: null,
      venue_type: null,
      sport: null,
      status: null,
      photo_path: null,
    });
    expect(court.address).toBeNull();
    expect(court.venue_type).toBeNull();
    expect(court.sport).toBeNull();
    expect(court.photo_path).toBeNull();
  });
});

describe("courtSportsLabel", () => {
  it("sport singolo noto", () => {
    expect(courtSportsLabel("basketball")).toBe("Basket");
  });
  it("lista con separatore e duplicati", () => {
    expect(courtSportsLabel("basketball;soccer;basketball")).toBe(
      "Basket · Calcio"
    );
  });
  it("sport sconosciuto resta leggibile, non sparisce", () => {
    expect(courtSportsLabel("handball")).toBe("handball");
  });
  it("assente = null", () => {
    expect(courtSportsLabel(null)).toBeNull();
    expect(courtSportsLabel(" ; ")).toBeNull();
  });
});

describe("venueTypeLabel", () => {
  it("field_* = Campo", () => {
    expect(venueTypeLabel("field_basketball")).toBe("Campo");
    expect(venueTypeLabel("field_unknown")).toBe("Campo");
  });
  it("vocabolario noto tradotto", () => {
    expect(venueTypeLabel("park")).toBe("Parco");
    expect(venueTypeLabel("playground")).toBe("Parco giochi");
  });
  it("vocabolario sconosciuto = null, niente gergo", () => {
    expect(venueTypeLabel("industrial_yard")).toBeNull();
    expect(venueTypeLabel(null)).toBeNull();
  });
});

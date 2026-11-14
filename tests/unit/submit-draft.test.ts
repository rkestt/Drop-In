import { describe, expect, it } from "vitest";
import {
  SUBMIT_COURT_DRAFT_KEY,
  decodeSubmitCourtDraft,
  encodeSubmitCourtDraft,
} from "@/lib/court/submit-draft";

describe("decodeSubmitCourtDraft", () => {
  it("ripristina la vecchia forma con `location` + accuracy come posizione GPS", () => {
    const oldDraft = JSON.stringify({
      name: "Campetto",
      selectedSport: "tennis",
      surface: "asphalt",
      location: { lat: 41.8919, lng: 12.5113, accuracy: 15 },
      dedupConfirmed: true,
    });

    const draft = decodeSubmitCourtDraft(oldDraft);
    expect(draft).not.toBeNull();
    expect(draft?.name).toBe("Campetto");
    expect(draft?.selectedSport).toBe("tennis");
    expect(draft?.surface).toBe("asphalt");
    expect(draft?.position).toEqual({
      source: "gps",
      lat: 41.8919,
      lng: 12.5113,
      accuracy: 15,
    });
    expect(draft?.dedupConfirmed).toBe(true);
  });

  it("legge la nuova forma manuale senza inventare accuratezza", () => {
    const draft = decodeSubmitCourtDraft(
      JSON.stringify({
        name: "",
        selectedSport: "basketball",
        surface: "",
        position: { source: "manual", lat: 41.9, lng: 12.5 },
        address: "Via Roma 10",
        dedupConfirmed: false,
      })
    );

    expect(draft?.position).toEqual({ source: "manual", lat: 41.9, lng: 12.5 });
    expect(draft?.position).not.toHaveProperty("accuracy");
    expect(draft?.address).toBe("Via Roma 10");
  });

  it("scarta una posizione GPS nuova senza accuracy valida", () => {
    const draft = decodeSubmitCourtDraft(
      JSON.stringify({
        position: { source: "gps", lat: 41.9, lng: 12.5 },
      })
    );
    expect(draft?.position).toBeNull();
  });

  it("scarta coordinate fuori range o non numeriche senza buttare il resto", () => {
    const draft = decodeSubmitCourtDraft(
      JSON.stringify({
        name: "Restano io",
        position: { source: "manual", lat: 91, lng: 12.5 },
      })
    );
    expect(draft?.name).toBe("Restano io");
    expect(draft?.position).toBeNull();
  });

  it("ignora uno sport non valido", () => {
    const draft = decodeSubmitCourtDraft(
      JSON.stringify({ selectedSport: "curling" })
    );
    expect(draft?.selectedSport).toBeNull();
  });

  it("normalizza l'indirizzo e lo limita a 200 caratteri", () => {
    const draft = decodeSubmitCourtDraft(
      JSON.stringify({ address: "Via\nRoma 10" })
    );
    expect(draft?.address).toBe("Via Roma 10");

    const long = decodeSubmitCourtDraft(
      JSON.stringify({ address: "z".repeat(250) })
    );
    expect(long?.address).toHaveLength(200);
  });

  it("tollera JSON corrotto, valori non oggetto e null", () => {
    expect(decodeSubmitCourtDraft(null)).toBeNull();
    expect(decodeSubmitCourtDraft("")).toBeNull();
    expect(decodeSubmitCourtDraft("{non-json")).toBeNull();
    expect(decodeSubmitCourtDraft("[]")).toBeNull();
    expect(decodeSubmitCourtDraft('"stringa"')).toBeNull();
  });

  it("considera dedupConfirmed true solo con un booleano true", () => {
    expect(
      decodeSubmitCourtDraft(JSON.stringify({ dedupConfirmed: "yes" }))?.dedupConfirmed
    ).toBe(false);
    expect(
      decodeSubmitCourtDraft(JSON.stringify({ dedupConfirmed: true }))?.dedupConfirmed
    ).toBe(true);
  });
});

describe("encodeSubmitCourtDraft", () => {
  it("fa round-trip del nuovo modello", () => {
    const encoded = encodeSubmitCourtDraft({
      name: "Campo",
      selectedSport: "padel",
      surface: "tartan",
      position: { source: "manual", lat: 41.9, lng: 12.5 },
      address: "Via Roma 10",
      dedupConfirmed: true,
    });

    const decoded = decodeSubmitCourtDraft(encoded);
    expect(decoded).toEqual({
      name: "Campo",
      selectedSport: "padel",
      surface: "tartan",
      position: { source: "manual", lat: 41.9, lng: 12.5 },
      address: "Via Roma 10",
      dedupConfirmed: true,
    });
  });

  it("mantiene stabile la chiave di storage storica", () => {
    expect(SUBMIT_COURT_DRAFT_KEY).toBe("submit-court-draft-v1");
  });
});

import { describe, expect, it } from "vitest";
import {
  coordinatesLabel,
  mapDedupCandidate,
  mapPendingCourt,
  submittedAgoLabel,
  surfaceLabel,
  toReportCourtGroups,
  type PendingCourtRow,
  type ReportCourtRow,
} from "@/lib/moderation/queue";

const NOW = new Date("2026-11-13T10:00:00.000Z");

const BASE_COURT: PendingCourtRow = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Campetto Via Napoli",
  sport: "basketball",
  surface_type: "asphalt",
  photo_path: "user/campo.jpg",
  lat: 41.90278,
  lng: 12.49637,
  address: "Via Napoli 1, Roma",
  created_at: "2026-11-13T08:00:00.000Z",
};

describe("surfaceLabel", () => {
  it("traduce le superfici note", () => {
    expect(surfaceLabel("asphalt")).toBe("Asfalto");
    expect(surfaceLabel("tartan")).toBe("Tartan");
  });
  it("lascia passare i valori sconosciuti", () => {
    expect(surfaceLabel("sabbia")).toBe("sabbia");
  });
  it("null resta null", () => {
    expect(surfaceLabel(null)).toBeNull();
  });
});

describe("submittedAgoLabel", () => {
  const at = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

  it("sotto il minuto: adesso", () => {
    expect(submittedAgoLabel(at(10_000), NOW)).toBe("adesso");
  });
  it("singolare e plurale dei minuti", () => {
    expect(submittedAgoLabel(at(60_000), NOW)).toBe("1 minuto fa");
    expect(submittedAgoLabel(at(5 * 60_000), NOW)).toBe("5 minuti fa");
  });
  it("ore", () => {
    expect(submittedAgoLabel(at(60 * 60_000), NOW)).toBe("1 ora fa");
    expect(submittedAgoLabel(at(2 * 60 * 60_000), NOW)).toBe("2 ore fa");
  });
  it("giorni", () => {
    expect(submittedAgoLabel(at(24 * 60 * 60_000), NOW)).toBe("1 giorno fa");
    expect(submittedAgoLabel(at(3 * 24 * 60 * 60_000), NOW)).toBe(
      "3 giorni fa",
    );
  });
  it("oltre una settimana passa alla data", () => {
    expect(submittedAgoLabel("2026-11-02T12:00:00.000Z", NOW)).toBe(
      "2 nov 2026",
    );
  });
  it("timestamp non valido: stringa vuota, mai crash", () => {
    expect(submittedAgoLabel("not-a-date", NOW)).toBe("");
  });
});

describe("coordinatesLabel", () => {
  it("cinque decimali", () => {
    expect(coordinatesLabel(41.90278, 12.49637)).toBe("41.90278, 12.49637");
  });
  it("coordinate assenti", () => {
    expect(coordinatesLabel(null, null)).toBe("Posizione non disponibile");
    expect(coordinatesLabel(Number.NaN, 12)).toBe("Posizione non disponibile");
  });
});

describe("mapPendingCourt", () => {
  it("compone etichette e testi senza inventare valori", () => {
    const item = mapPendingCourt(BASE_COURT, NOW);
    expect(item.sportLabel).toBe("Basket");
    expect(item.surfaceLabel).toBe("Asfalto");
    expect(item.address).toBe("Via Napoli 1, Roma");
    expect(item.submittedAgo).toBe("2 ore fa");
    expect(item.submittedOn).toBe("13 nov 2026");
    expect(item.coordinates).toBe("41.90278, 12.49637");
  });

  it("sport e superficie null restano espliciti", () => {
    const item = mapPendingCourt(
      { ...BASE_COURT, sport: null, surface_type: null, address: "  " },
      NOW,
    );
    expect(item.sportLabel).toBe("Sport non specificato");
    expect(item.surfaceLabel).toBeNull();
    expect(item.address).toBeNull();
  });
});

describe("mapDedupCandidate", () => {
  it("riga mascherata: chiave pending, nessuna distanza, non selezionabile", () => {
    const item = mapDedupCandidate(
      {
        id: null,
        name: null,
        lat: null,
        lng: null,
        distance_m: null,
        moderation_status: null,
        source: null,
      },
      0,
    );
    expect(item.key).toBe("pending-0");
    expect(item.id).toBeNull();
    expect(item.name).toBe("Proposta in attesa");
    expect(item.distanceLabel).toBeNull();
    expect(item.selectable).toBe(false);
  });

  it("campo approvato: id reale e distanza formattata", () => {
    const item = mapDedupCandidate(
      {
        id: "22222222-2222-2222-2222-222222222222",
        name: "Campo Originale",
        lat: 41.9,
        lng: 12.5,
        distance_m: 42,
        moderation_status: "approved",
        source: "osm",
      },
      1,
    );
    expect(item.key).toBe("22222222-2222-2222-2222-222222222222");
    expect(item.selectable).toBe(true);
    expect(item.distanceLabel).toBe("42 m");
  });

  it("id reale ma proposta non approvata: non selezionabile", () => {
    const item = mapDedupCandidate(
      {
        id: "33333333-3333-3333-3333-333333333333",
        name: "Proposta Mia",
        lat: 41.9,
        lng: 12.5,
        distance_m: 0,
        moderation_status: "pending",
        source: "community",
      },
      0,
    );
    expect(item.id).toBe("33333333-3333-3333-3333-333333333333");
    expect(item.selectable).toBe(false);
  });
});

describe("toReportCourtGroups", () => {
  const future = "2026-11-14T10:00:00.000Z";
  const past = "2026-11-12T10:00:00.000Z";

  const rows: ReportCourtRow[] = [
    {
      id: "r1",
      court_id: "c1",
      category: "broken_hoop",
      expires_at: future,
      created_at: "2026-11-13T08:00:00.000Z",
      courts: { name: "Campo Uno" },
    },
    {
      id: "r2",
      court_id: "c1",
      category: "lighting",
      expires_at: future,
      created_at: "2026-11-13T09:00:00.000Z",
      courts: [{ name: "Campo Uno" }],
    },
    {
      id: "r3",
      court_id: "c2",
      category: "wet_court",
      expires_at: future,
      created_at: "2026-11-13T07:00:00.000Z",
      courts: { name: "Campo Due" },
    },
    {
      id: "r4",
      court_id: "c3",
      category: "other",
      expires_at: past,
      created_at: "2026-11-12T09:00:00.000Z",
      courts: { name: "Campo Scaduto" },
    },
  ];

  it("filtra le scadute e raggruppa per campo", () => {
    const groups = toReportCourtGroups(rows, NOW);
    expect(groups.map((g) => g.courtId)).toEqual(["c1", "c2"]);
    const c1 = groups[0];
    expect(c1?.courtName).toBe("Campo Uno");
    expect(c1?.count).toBe(2);
    expect(c1?.categories).toEqual(["Canestro rotto", "Illuminazione"]);
    expect(c1?.courtHref).toBe("/courts/c1");
  });

  it("ordina i gruppi per segnalazione più recente", () => {
    const groups = toReportCourtGroups(rows, NOW);
    expect(groups[0]?.courtId).toBe("c1");
    expect(groups[1]?.courtId).toBe("c2");
  });

  it("senza nome campo: fallback e nessun link", () => {
    const groups = toReportCourtGroups(
      [{ ...rows[0]!, courts: null }],
      NOW,
    );
    expect(groups[0]?.courtName).toBe("Campo non disponibile");
    expect(groups[0]?.courtHref).toBeNull();
  });

  it("scadenza più lontana del gruppo, in forma UI", () => {
    const groups = toReportCourtGroups(rows, NOW);
    expect(groups[0]?.latestExpiryLabel).toMatch(
      /^\d{1,2} \p{L}{3,4}, \d{2}:\d{2}$/u,
    );
  });

  it("nessuna segnalazione attiva: lista vuota", () => {
    expect(toReportCourtGroups([], NOW)).toEqual([]);
  });
});

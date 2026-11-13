import { describe, expect, it } from "vitest";
import {
  formatHistoryDate,
  historySummary,
  mapCheckInRow,
  mapKarmaRow,
  sortHistory,
  UNKNOWN_COURT_NAME,
  type HistoryEntry,
} from "@/lib/profile/history";

describe("mapCheckInRow", () => {
  it("check-in chiuso con nome campo", () => {
    const entry = mapCheckInRow({
      id: "c1",
      checked_in_at: "2026-11-10T10:00:00.000Z",
      checked_out_at: "2026-11-10T12:00:00.000Z",
      status: "checked_out",
      courts: { name: "Parco degli Acquedotti" },
    });
    expect(entry).toEqual({
      kind: "checkin",
      id: "c1",
      courtName: "Parco degli Acquedotti",
      checkedInAt: "2026-11-10T10:00:00.000Z",
      checkedOutAt: "2026-11-10T12:00:00.000Z",
      status: "checked_out",
    });
  });

  it("check-in attivo senza checked_out_at", () => {
    const entry = mapCheckInRow({
      id: "c2",
      checked_in_at: "2026-11-12T09:00:00.000Z",
      checked_out_at: null,
      status: "active",
      courts: { name: "Campo Testaccio" },
    });
    expect(entry?.status).toBe("active");
    expect(entry?.checkedOutAt).toBeNull();
  });

  it("nome campo nullo o join mancante → segnaposto, mai crash", () => {
    expect(
      mapCheckInRow({
        id: "c3",
        checked_in_at: null,
        checked_out_at: null,
        status: "checked_out",
        courts: { name: null },
      })?.courtName
    ).toBe(UNKNOWN_COURT_NAME);
    expect(
      mapCheckInRow({
        id: "c4",
        checked_in_at: null,
        checked_out_at: null,
        status: "checked_out",
        courts: null,
      })?.courtName
    ).toBe(UNKNOWN_COURT_NAME);
    expect(
      mapCheckInRow({
        id: "c5",
        checked_in_at: null,
        checked_out_at: null,
        status: null,
        courts: [],
      })?.courtName
    ).toBe(UNKNOWN_COURT_NAME);
  });

  it("riga inutilizzabile → null", () => {
    expect(mapCheckInRow(null)).toBeNull();
    expect(mapCheckInRow(undefined)).toBeNull();
    expect(
      mapCheckInRow({
        id: "",
        checked_in_at: null,
        checked_out_at: null,
        status: null,
        courts: null,
      })
    ).toBeNull();
  });
});

describe("mapKarmaRow", () => {
  it("karma_loss nota → voce con delta negativo", () => {
    const entry = mapKarmaRow({
      id: "k1",
      data: { type: "karma_loss", lobby_id: "l1", points_lost: 3 },
      sent_at: "2026-11-11T20:00:00.000Z",
    });
    expect(entry).toEqual({
      kind: "karma",
      id: "k1",
      label: "−3 no-show",
      delta: -3,
      at: "2026-11-11T20:00:00.000Z",
    });
  });

  it("punti mancanti → fallback 3 del trigger", () => {
    const entry = mapKarmaRow({
      id: "k2",
      data: { type: "karma_loss", lobby_id: "l1" },
      sent_at: null,
    });
    expect(entry?.delta).toBe(-3);
    expect(entry?.at).toBeNull();
  });

  it("forme sconosciute → null, mai spazzatura", () => {
    expect(
      mapKarmaRow({
        id: "x1",
        data: { type: "lobby_starting_soon", lobby_id: "l1" },
        sent_at: "2026-11-11T20:00:00.000Z",
      })
    ).toBeNull();
    expect(
      mapKarmaRow({ id: "x2", data: null, sent_at: null })
    ).toBeNull();
    expect(
      mapKarmaRow({ id: "x3", data: "karma_loss", sent_at: null })
    ).toBeNull();
    expect(mapKarmaRow(null)).toBeNull();
  });
});

describe("sortHistory", () => {
  const checkin = (id: string, at: string | null): HistoryEntry => ({
    kind: "checkin",
    id,
    courtName: id,
    checkedInAt: at,
    checkedOutAt: null,
    status: "checked_out",
  });
  const karma = (id: string, at: string | null): HistoryEntry => ({
    kind: "karma",
    id,
    label: id,
    delta: -3,
    at,
  });

  it("piu' recenti prima, tipi mescolati", () => {
    const sorted = sortHistory([
      checkin("vecchio", "2026-11-01T10:00:00.000Z"),
      karma("recente", "2026-11-12T10:00:00.000Z"),
      checkin("medio", "2026-11-10T10:00:00.000Z"),
    ]);
    expect(sorted.map((e) => e.id)).toEqual([
      "recente",
      "medio",
      "vecchio",
    ]);
  });

  it("parita' di istante → tie-break stabile per id", () => {
    const sorted = sortHistory([
      checkin("b", "2026-11-10T10:00:00.000Z"),
      checkin("a", "2026-11-10T10:00:00.000Z"),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("voci senza data finiscono in fondo, senza mutare l'input", () => {
    const input: HistoryEntry[] = [
      checkin("nodata", null),
      checkin("datato", "2026-11-10T10:00:00.000Z"),
    ];
    const sorted = sortHistory(input);
    expect(sorted.map((e) => e.id)).toEqual(["datato", "nodata"]);
    expect(input[0].id).toBe("nodata");
  });
});

describe("historySummary", () => {
  it("conta per tipo e totale", () => {
    expect(
      historySummary([
        {
          kind: "checkin",
          id: "c1",
          courtName: "X",
          checkedInAt: null,
          checkedOutAt: null,
          status: "checked_out",
        },
        {
          kind: "checkin",
          id: "c2",
          courtName: "Y",
          checkedInAt: null,
          checkedOutAt: null,
          status: "active",
        },
        { kind: "karma", id: "k1", label: "−3 no-show", delta: -3, at: null },
      ])
    ).toEqual({ total: 3, checkIns: 2, karmaEvents: 1 });
  });

  it("vuoto → zeri", () => {
    expect(historySummary([])).toEqual({
      total: 0,
      checkIns: 0,
      karmaEvents: 0,
    });
  });
});

describe("formatHistoryDate", () => {
  // Offset espliciti: con le chiavi giorno di Roma ("23:30Z = domani")
  // gli ISO ingenui dipenderebbero dal fuso del runner.
  const now = new Date("2026-11-12T15:00:00+01:00");

  it("oggi → Oggi", () => {
    expect(formatHistoryDate("2026-11-12T09:00:00+01:00", now)).toBe("Oggi");
  });

  it("ieri → Ieri", () => {
    expect(formatHistoryDate("2026-11-11T23:59:00+01:00", now)).toBe("Ieri");
  });

  it("23:30Z è già oggi a Roma (chiave app, non UTC)", () => {
    expect(formatHistoryDate("2026-11-11T23:30:00.000Z", now)).toBe("Oggi");
  });

  it("data lontana → corta it-IT", () => {
    expect(formatHistoryDate("2026-10-05T10:00:00.000Z", now)).toBe(
      "5 ott 2026"
    );
  });

  it("input non data → segnaposto, deterministico", () => {
    expect(formatHistoryDate(null, now)).toBe("—");
    expect(formatHistoryDate(undefined, now)).toBe("—");
    expect(formatHistoryDate("", now)).toBe("—");
    expect(formatHistoryDate("non-una-data", now)).toBe("—");
    expect(formatHistoryDate("non-una-data", now)).toBe(
      formatHistoryDate("non-una-data", now)
    );
  });
});

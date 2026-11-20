import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPreviewNoteCache,
  COURT_NOTE_STALE_DAYS,
  courtNoteSeparatorBefore,
  courtNotesHeadline,
  fetchPreviewNote,
  isFreshNote,
  isKnownNoteKind,
  mapAddNoteError,
  mapCourtNote,
  noteAgeLabel,
  noteKindLabel,
  splitCourtNotes,
  type CourtNoteItem,
  warmPreviewNotes,
} from "@/lib/court/notes";

// La cache anteprima è stato globale del modulo: ogni test parte pulito,
// altrimenti l'ordine di esecuzione cambierebbe i risultati.
beforeEach(() => {
  clearPreviewNoteCache();
});

const NOW = new Date("2026-11-18T10:00:00.000Z");

const at = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const daysAgo = (days: number) => at(days * 24 * 60 * 60_000);

function item(
  createdAt: string,
  overrides: Partial<CourtNoteItem> = {},
): CourtNoteItem {
  const mapped = mapCourtNote(
    { id: `id-${createdAt}`, kind: "broken_hoop", body: null, created_at: createdAt },
    NOW,
  );
  if (!mapped) throw new Error(`nota non mappata: ${createdAt}`);
  return { ...mapped, ...overrides };
}

describe("noteKindLabel", () => {
  it("traduce i sei tipi", () => {
    expect(noteKindLabel("broken_hoop")).toBe("Canestro rotto");
    expect(noteKindLabel("closed")).toBe("Chiuso");
    expect(noteKindLabel("private_area")).toBe("Area privata");
    expect(noteKindLabel("no_lighting")).toBe("Illuminazione assente");
    expect(noteKindLabel("surface")).toBe("Superficie rovinata");
    expect(noteKindLabel("other")).toBe("Altro");
  });
  it("ignoto e null: stringa vuota, mai un'etichetta inventata", () => {
    expect(noteKindLabel("wet_court")).toBe("");
    expect(noteKindLabel(null)).toBe("");
    expect(noteKindLabel(undefined)).toBe("");
    expect(isKnownNoteKind("wet_court")).toBe(false);
    expect(isKnownNoteKind("other")).toBe(true);
  });
});

describe("noteAgeLabel", () => {
  it("sotto il minuto e futuro: adesso", () => {
    expect(noteAgeLabel(at(10_000), NOW)).toBe("adesso");
    expect(noteAgeLabel(at(-60_000), NOW)).toBe("adesso");
  });
  it("minuti e ore, singolare e plurale", () => {
    expect(noteAgeLabel(at(60_000), NOW)).toBe("1 minuto fa");
    expect(noteAgeLabel(at(5 * 60_000), NOW)).toBe("5 minuti fa");
    expect(noteAgeLabel(at(60 * 60_000), NOW)).toBe("1 ora fa");
    expect(noteAgeLabel(at(2 * 60 * 60_000), NOW)).toBe("2 ore fa");
  });
  it("giorni fino a 13", () => {
    expect(noteAgeLabel(daysAgo(1), NOW)).toBe("1 giorno fa");
    expect(noteAgeLabel(daysAgo(13), NOW)).toBe("13 giorni fa");
  });
  it("giorni fino a 13, poi settimane fino a 59 giorni", () => {
    expect(noteAgeLabel(daysAgo(7), NOW)).toBe("7 giorni fa");
    expect(noteAgeLabel(daysAgo(14), NOW)).toBe("2 settimane fa");
  });
  it("mesi, mai 12 mesi", () => {
    expect(noteAgeLabel(daysAgo(120), NOW)).toBe("4 mesi fa");
    expect(noteAgeLabel(daysAgo(364), NOW)).toBe("11 mesi fa");
  });
  it("anni oltre i 365 giorni", () => {
    expect(noteAgeLabel(daysAgo(365), NOW)).toBe("1 anno fa");
    expect(noteAgeLabel(daysAgo(800), NOW)).toBe("2 anni fa");
  });
  it("timestamp non valido: stringa vuota, mai crash", () => {
    expect(noteAgeLabel("not-a-date", NOW)).toBe("");
  });
});

describe("isFreshNote", () => {
  it(`fresca entro ${COURT_NOTE_STALE_DAYS} giorni`, () => {
    expect(isFreshNote(daysAgo(30), NOW)).toBe(true);
    expect(isFreshNote(at(10_000), NOW)).toBe(true);
  });
  it("vecchia oltre la soglia", () => {
    expect(isFreshNote(daysAgo(31), NOW)).toBe(false);
  });
  it("data non valida: mai fresca", () => {
    expect(isFreshNote("not-a-date", NOW)).toBe(false);
  });
});

describe("mapCourtNote", () => {
  it("riga piena: etichette e date composte", () => {
    const mapped = mapCourtNote(
      {
        id: "n1",
        kind: "closed",
        body: "Cancello chiuso.",
        created_at: daysAgo(60),
      },
      NOW,
    );
    expect(mapped).toMatchObject({
      id: "n1",
      kind: "closed",
      kindLabel: "Chiuso",
      body: "Cancello chiuso.",
      ageLabel: "2 mesi fa",
      dateLabel: "19 set 2026",
      fresh: false,
    });
  });
  it("tipo ignoto o data illeggibile: null, mai righe inventate", () => {
    expect(
      mapCourtNote({ id: "x", kind: "wet_court", body: null, created_at: daysAgo(1) }, NOW),
    ).toBeNull();
    expect(
      mapCourtNote({ id: "x", kind: "closed", body: null, created_at: "nope" }, NOW),
    ).toBeNull();
  });
  it("body di soli spazi: null, come il DB che normalizza in NULL", () => {
    const mapped = mapCourtNote(
      { id: "x", kind: "surface", body: "   ", created_at: daysAgo(1) },
      NOW,
    );
    expect(mapped?.body).toBeNull();
  });
});

describe("splitCourtNotes", () => {
  it("fino a tre righe: niente fold, niente separatore tra sole fresche", () => {
    const items = [item(daysAgo(1)), item(daysAgo(2))];
    const split = splitCourtNotes(items);
    expect(split.visible).toHaveLength(2);
    expect(split.hiddenCount).toBe(0);
    expect(split.showSeparator).toBe(false);
  });
  it("oltre tre: fold numerato", () => {
    const items = [
      item(daysAgo(1)),
      item(daysAgo(2)),
      item(daysAgo(3)),
      item(daysAgo(40)),
      item(daysAgo(50)),
    ];
    const split = splitCourtNotes(items);
    expect(split.visible).toHaveLength(3);
    expect(split.hiddenCount).toBe(2);
    expect(split.fresh).toHaveLength(3);
    expect(split.stale).toHaveLength(2);
  });
  it("separatore solo con fresche e vecchie nel visibile", () => {
    const mixed = [item(daysAgo(1)), item(daysAgo(40))];
    expect(splitCourtNotes(mixed).showSeparator).toBe(true);
    const onlyStale = [item(daysAgo(40)), item(daysAgo(50))];
    expect(splitCourtNotes(onlyStale).showSeparator).toBe(false);
  });
});

describe("courtNotesHeadline", () => {
  it("zero note o più recente fresca: nessuna riga", () => {
    expect(courtNotesHeadline([])).toBeNull();
    expect(courtNotesHeadline([item(daysAgo(1))])).toBeNull();
  });
  it("solo vecchie: età della più recente", () => {
    expect(
      courtNotesHeadline([item(daysAgo(120)), item(daysAgo(200))]),
    ).toBe("Nessuna nota recente: l'ultima è di 4 mesi fa.");
  });
});

describe("courtNoteSeparatorBefore", () => {
  const mixed = [
    item(daysAgo(1)),
    item(daysAgo(2)),
    item(daysAgo(40)),
    item(daysAgo(50)),
  ];
  it("a fold aperto: confine prima della prima vecchia", () => {
    expect(courtNoteSeparatorBefore(mixed, 0)).toBe(false);
    expect(courtNoteSeparatorBefore(mixed, 1)).toBe(false);
    expect(courtNoteSeparatorBefore(mixed, 2)).toBe(true);
    expect(courtNoteSeparatorBefore(mixed, 3)).toBe(false);
  });
  it("senza confine temporale: mai", () => {
    expect(courtNoteSeparatorBefore([item(daysAgo(40))], 0)).toBe(false);
    expect(
      courtNoteSeparatorBefore([item(daysAgo(40)), item(daysAgo(50))], 1),
    ).toBe(false);
    expect(
      courtNoteSeparatorBefore([item(daysAgo(1)), item(daysAgo(2))], 1),
    ).toBe(false);
    expect(courtNoteSeparatorBefore([], 0)).toBe(false);
  });
});

describe("fetchPreviewNote", () => {
  const stub = (result: unknown, rejected?: unknown) => {
    const maybeSingle = rejected
      ? vi.fn().mockRejectedValue(rejected)
      : vi.fn().mockResolvedValue(result);
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return from as any;
  };
  const client = (result: unknown, rejected?: unknown) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ from: stub(result, rejected) }) as any;

  it("nota fresca: tipo ed età con `now` esplicito", async () => {
    const note = await fetchPreviewNote(
      client({ data: { kind: "closed", created_at: daysAgo(2) }, error: null }),
      "court-1",
      NOW,
    );
    expect(note).toEqual({ kind: "Chiuso", age: "2 giorni fa" });
  });
  it("deterministica: stessa riga, `now` diverso → età diversa", async () => {
    const row = { kind: "closed", created_at: daysAgo(2) };
    const then = await fetchPreviewNote(
      client({ data: row, error: null }),
      "court-1",
      NOW,
    );
    const later = await fetchPreviewNote(
      client({ data: row, error: null }),
      "court-1",
      new Date(NOW.getTime() + 24 * 60 * 60_000),
    );
    expect(then).toEqual({ kind: "Chiuso", age: "2 giorni fa" });
    expect(later).toEqual({ kind: "Chiuso", age: "3 giorni fa" });
  });
  it("null quando non c'è, è vecchia, ha un tipo ignoto o fallisce", async () => {
    expect(
      await fetchPreviewNote(client({ data: null, error: null }), "c", NOW),
    ).toBeNull();
    expect(
      await fetchPreviewNote(
        client({ data: { kind: "closed", created_at: daysAgo(120) }, error: null }),
        "c",
        NOW,
      ),
    ).toBeNull();
    expect(
      await fetchPreviewNote(
        client({ data: { kind: "wet_court", created_at: daysAgo(1) }, error: null }),
        "c",
        NOW,
      ),
    ).toBeNull();
    expect(
      await fetchPreviewNote(
        client({ data: null, error: { message: "boom" } }),
        "c",
        NOW,
      ),
    ).toBeNull();
    expect(
      await fetchPreviewNote(client(null, new Error("rete")), "c", NOW),
    ).toBeNull();
  });
  it("query mirata: una sola riga, la più nuova", async () => {
    const from = stub({ data: null, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchPreviewNote({ from } as any, "court-9");
    expect(from).toHaveBeenCalledWith("court_notes");
    const chain = from.mock.results[0].value;
    expect(chain.select).toHaveBeenCalledWith("kind,created_at");
    expect(chain.select.mock.results[0].value.eq).toHaveBeenCalledWith(
      "court_id",
      "court-9",
    );
  });
});

describe("warmPreviewNotes + cache anteprima", () => {
  const warmStub = (rows: unknown, error: unknown = null) => {
    const order = vi.fn().mockResolvedValue({ data: rows, error });
    const inn = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ in: inn });
    const from = vi.fn().mockReturnValue({ select });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { client: { from } as any, from, order };
  };
  const exploding = () => {
    const from = vi.fn(() => {
      throw new Error("rete non attesa: doveva rispondere la cache");
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { client: { from } as any, from };
  };

  it("la seconda lettura non tocca la rete", async () => {
    const from = (() => {
      const maybeSingle = vi
        .fn()
        .mockResolvedValue({ data: { kind: "closed", created_at: daysAgo(2) }, error: null });
      const limit = vi.fn().mockReturnValue({ maybeSingle });
      const order = vi.fn().mockReturnValue({ limit });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      return vi.fn().mockReturnValue({ select });
    })();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = { from } as any;
    await fetchPreviewNote(client, "warm-1", NOW);
    await fetchPreviewNote(client, "warm-1", NOW);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("warm riempie più campi, la più nuova vince, poi zero rete", async () => {
    const rows = [
      { court_id: "w1", kind: "closed", created_at: daysAgo(1) },
      { court_id: "w1", kind: "broken_hoop", created_at: daysAgo(5) },
      { court_id: "w2", kind: "broken_hoop", created_at: daysAgo(1) },
    ];
    const { client: warmClient, from: warmFrom } = warmStub(rows);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await warmPreviewNotes(warmClient as any, ["w1", "w2", "w1"]);
    expect(warmFrom).toHaveBeenCalledWith("court_notes");
    const { client: noNet } = exploding();
    expect(await fetchPreviewNote(noNet, "w1", NOW)).toEqual({
      kind: "Chiuso",
      age: "1 giorno fa",
    });
    expect(await fetchPreviewNote(noNet, "w2", NOW)).toEqual({
      kind: "Canestro rotto",
      age: "1 giorno fa",
    });
  });

  it("warm fallito: la fetch diretta resta il fallback", async () => {
    const { client: bad } = warmStub(null, { message: "boom" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await warmPreviewNotes(bad as any, ["w3"]);
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { kind: "closed", created_at: daysAgo(2) },
      error: null,
    });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const note = await fetchPreviewNote({ from } as any, "w3", NOW);
    expect(note).toEqual({ kind: "Chiuso", age: "2 giorni fa" });
  });

  it("le etichette si ricalcolano alla lettura, non alla scrittura", async () => {
    const { client: warmClient } = warmStub([
      { court_id: "w4", kind: "closed", created_at: daysAgo(2) },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await warmPreviewNotes(warmClient as any, ["w4"]);
    const { client: noNet } = exploding();
    expect(await fetchPreviewNote(noNet, "w4", NOW)).toEqual({
      kind: "Chiuso",
      age: "2 giorni fa",
    });
    expect(
      await fetchPreviewNote(noNet, "w4", new Date(NOW.getTime() + 24 * 60 * 60_000)),
    ).toEqual({ kind: "Chiuso", age: "3 giorni fa" });
  });

  it("scaduto il TTL si torna in rete", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(NOW);
      const { client: warmClient } = warmStub([
        { court_id: "w5", kind: "closed", created_at: daysAgo(2) },
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await warmPreviewNotes(warmClient as any, ["w5"]);
      const later = new Date(NOW.getTime() + 61_000);
      vi.setSystemTime(later);
      const maybeSingle = vi.fn().mockResolvedValue({
        data: { kind: "broken_hoop", created_at: daysAgo(1) },
        error: null,
      });
      const limit = vi.fn().mockReturnValue({ maybeSingle });
      const order = vi.fn().mockReturnValue({ limit });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      const from = vi.fn().mockReturnValue({ select });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const note = await fetchPreviewNote({ from } as any, "w5", later);
      expect(from).toHaveBeenCalledWith("court_notes");
      expect(note).toEqual({ kind: "Canestro rotto", age: "1 giorno fa" });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("mapAddNoteError", () => {
  it("42501: diniego secco, mai riprova", () => {
    expect(mapAddNoteError({ code: "42501", message: "Non autorizzato." })).toEqual({
      message: "Non puoi aggiungere note a questo campo.",
      canRetry: false,
    });
  });
  it("P0001: passa il testo italiano del server", () => {
    expect(
      mapAddNoteError({ code: "P0001", message: "Campo inesistente." }),
    ).toEqual({ message: "Campo inesistente.", canRetry: false });
  });
  it("rete: testo della spec e riprova", () => {
    const info = mapAddNoteError({ message: "Failed to fetch" });
    expect(info.canRetry).toBe(true);
    expect(info.message).toBe("Non siamo riusciti ad aggiungere la nota.");
  });
  it("sconosciuto: fallback generico, mai raw", () => {
    const info = mapAddNoteError({ code: "XX999", message: "weird db thing" });
    expect(info).toEqual({
      message: "Non siamo riusciti ad aggiungere la nota.",
      canRetry: false,
    });
  });
});

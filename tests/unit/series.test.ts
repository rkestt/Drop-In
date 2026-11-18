import { describe, expect, it } from "vitest";
import {
  seriesSchema,
  updateSeriesSchema,
} from "@/lib/validation/schemas";
import {
  nextSeriesOccurrence,
  normalizeTimeOfDay,
  seriesWeekdayLabel,
} from "@/lib/series/next-occurrence";
import { mapSeriesError } from "@/lib/series/errors";
import {
  orphanParticipationCutoffIso,
  ORPHAN_PARTICIPATION_WINDOW_DAYS,
} from "@/lib/series/client";
import {
  toSeriesWithNextOccurrence,
  type SeriesRow,
} from "@/lib/series/types";

const COURT_ID = "123e4567-e89b-12d3-a456-426614174000";

const valid = {
  courtId: COURT_ID,
  weekday: 4,
  timeOfDay: "20:00",
  sport: "basketball",
  durationMinutes: 60,
  maxPlayers: 10,
} as const;

describe("seriesSchema", () => {
  it("accetta una serie completa valida", () => {
    const r = seriesSchema.safeParse({ ...valid });
    expect(r.success).toBe(true);
  });

  it("rifiuta weekday fuori 1..7", () => {
    expect(
      seriesSchema.safeParse({ ...valid, weekday: 0 }).success
    ).toBe(false);
    expect(
      seriesSchema.safeParse({ ...valid, weekday: 8 }).success
    ).toBe(false);
  });

  it("rifiuta l'ora malformata con messaggio italiano", () => {
    for (const timeOfDay of ["25:00", "20-00", "8pm", "20:00:00x", ""]) {
      const r = seriesSchema.safeParse({ ...valid, timeOfDay });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0]?.message).toMatch(/HH:MM/);
      }
    }
  });

  it("rifiuta lo sport ignoto", () => {
    expect(
      seriesSchema.safeParse({ ...valid, sport: "quidditch" }).success
    ).toBe(false);
  });

  it("rifiuta durata fuori 15..240", () => {
    expect(
      seriesSchema.safeParse({ ...valid, durationMinutes: 10 }).success
    ).toBe(false);
    expect(
      seriesSchema.safeParse({ ...valid, durationMinutes: 300 }).success
    ).toBe(false);
  });

  it("rifiuta maxPlayers fuori 1..50", () => {
    expect(
      seriesSchema.safeParse({ ...valid, maxPlayers: 0 }).success
    ).toBe(false);
    expect(
      seriesSchema.safeParse({ ...valid, maxPlayers: 51 }).success
    ).toBe(false);
  });

  it("sport/durata/active opzionali: assenti → undefined (default nel client/DB)", () => {
    const r = seriesSchema.safeParse({
      courtId: COURT_ID,
      weekday: 4,
      timeOfDay: "20:00",
      maxPlayers: 10,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.sport).toBeUndefined();
      expect(r.data.durationMinutes).toBeUndefined();
      expect(r.data.active).toBeUndefined();
    }
  });
});

describe("updateSeriesSchema", () => {
  it("rifiuta la patch vuota", () => {
    const r = updateSeriesSchema.safeParse({});
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/Nessuna modifica/);
    }
  });

  it("accetta il solo toggle active (kill-switch orfani)", () => {
    expect(
      updateSeriesSchema.safeParse({ active: false }).success
    ).toBe(true);
  });
});

describe("normalizeTimeOfDay", () => {
  it("HH:MM → HH:MM:SS, il resto invariato o null", () => {
    expect(normalizeTimeOfDay("20:00")).toBe("20:00:00");
    expect(normalizeTimeOfDay("20:00:00")).toBe("20:00:00");
    expect(normalizeTimeOfDay("8pm")).toBeNull();
  });
});

describe("seriesWeekdayLabel", () => {
  it("1 = lunedì, 7 = domenica, fuori range = null", () => {
    expect(seriesWeekdayLabel(1)).toBe("lunedì");
    expect(seriesWeekdayLabel(4)).toBe("giovedì");
    expect(seriesWeekdayLabel(7)).toBe("domenica");
    expect(seriesWeekdayLabel(0)).toBeNull();
    expect(seriesWeekdayLabel(8)).toBeNull();
  });
});

describe("nextSeriesOccurrence", () => {
  // Lunedì 16 nov 2026, 09:00 Roma (= 08:00Z, ora solare UTC+1).
  const mondayMorning = "2026-11-16T08:00:00Z";

  it("stesso giorno se l'ora deve ancora venire", () => {
    expect(nextSeriesOccurrence(1, "20:00", mondayMorning)).toBe(
      "2026-11-16T19:00:00.000Z"
    );
  });

  it("settimana dopo se l'ora di oggi è passata", () => {
    // Lunedì 21:00 Roma: il lunedì 20:00 è andato.
    expect(nextSeriesOccurrence(1, "20:00", "2026-11-16T20:00:00Z")).toBe(
      "2026-11-23T19:00:00.000Z"
    );
  });

  it("giovedì dalla mattina di lunedì", () => {
    expect(nextSeriesOccurrence(4, "20:00", mondayMorning)).toBe(
      "2026-11-19T19:00:00.000Z"
    );
  });

  it("null con input malformati, mai throw", () => {
    expect(nextSeriesOccurrence(0, "20:00", mondayMorning)).toBeNull();
    expect(nextSeriesOccurrence(4, "8pm", mondayMorning)).toBeNull();
    expect(nextSeriesOccurrence(4, "20:00", "non-una-data")).toBeNull();
  });
});

describe("mapSeriesError", () => {
  it("P0001 capienza → piena, senza retry", () => {
    const out = mapSeriesError({
      code: "P0001",
      message: "Lobby al completo (10 partecipanti su 10 posti)",
    });
    expect(out.kind).toBe("full");
    expect(out.message).toMatch(/al completo/);
    expect(out.canRetry).toBe(false);
  });

  it("23505 → occorrenza già esistente, senza retry", () => {
    const out = mapSeriesError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "lobbies_series_id_start_time_unique"',
    });
    expect(out.kind).toBe("duplicate");
    expect(out.message).toMatch(/esiste già/);
    expect(out.canRetry).toBe(false);
  });

  it("guard creatore → not-owner con messaggio fisso", () => {
    const out = mapSeriesError({
      code: "P0001",
      message: "Solo il creatore puo' modificare la serie",
    });
    expect(out.kind).toBe("not-owner");
    expect(out.message).toBe("Solo il creatore può modificare questa serie.");
  });

  it("42501 RLS → forbidden, senza retry né raw", () => {
    const out = mapSeriesError({
      code: "42501",
      message: "new row violates row-level security policy",
    });
    expect(out.kind).toBe("forbidden");
    expect(out.message).not.toContain("42501");
    expect(out.canRetry).toBe(false);
  });

  it("ignoto → generico, senza raw", () => {
    const out = mapSeriesError({ code: "XX000", message: "boom interno" });
    expect(out.kind).toBe("permanent");
    expect(out.message).not.toContain("boom");
    expect(out.canRetry).toBe(false);
  });
});

const seriesRow = {
  id: "11111111-1111-1111-1111-111111111111",
  court_id: "22222222-2222-2222-2222-222222222222",
  creator_id: null,
  weekday: 4,
  time_of_day: "20:00:00",
  sport: "basketball",
  duration_minutes: 60,
  max_players: 10,
  active: true,
  created_at: null,
  updated_at: null,
} as SeriesRow;

describe("toSeriesWithNextOccurrence", () => {
  it("senza occorrenza → null/null/0 (non un errore)", () => {
    const out = toSeriesWithNextOccurrence(seriesRow, null);
    expect(out.nextOccurrence).toBeNull();
    expect(out.nextOccurrenceId).toBeNull();
    expect(out.confirmedCount).toBe(0);
    expect(out.id).toBe(seriesRow.id);
  });

  it("con occorrenza → id, data e conferme", () => {
    const out = toSeriesWithNextOccurrence(seriesRow, {
      id: "33333333-3333-3333-3333-333333333333",
      startTime: "2026-11-19T19:00:00.000Z",
      confirmedCount: 3,
    });
    expect(out.nextOccurrence).toBe("2026-11-19T19:00:00.000Z");
    expect(out.nextOccurrenceId).toBe(
      "33333333-3333-3333-3333-333333333333"
    );
    expect(out.confirmedCount).toBe(3);
  });
});

describe("orphanParticipationCutoffIso", () => {
  it("finestra 28 giorni come la policy 044", () => {
    expect(ORPHAN_PARTICIPATION_WINDOW_DAYS).toBe(28);
    expect(orphanParticipationCutoffIso("2026-11-18T00:00:00.000Z")).toBe(
      "2026-10-21T00:00:00.000Z"
    );
  });

  it("input malformato → finestra da adesso, mai throw", () => {
    const out = orphanParticipationCutoffIso("non-una-data");
    expect(Number.isNaN(Date.parse(out))).toBe(false);
  });
});

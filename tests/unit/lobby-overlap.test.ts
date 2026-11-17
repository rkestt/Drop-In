import { describe, expect, it } from "vitest";
import {
  findOverlappingLobby,
  lobbyEndsAtIso,
  lobbySportCompatible,
} from "@/lib/lobby/overlap";

// #96: avviso doppioni nel drawer. Intervalli semiaperti [inizio, fine).
const lobby = (
  id: string,
  start: string,
  end: string | null,
  sport: string | null = "basketball",
) => ({ id, start_time: start, ends_at: end, sport });

describe("lobbyEndsAtIso", () => {
  it("somma i minuti all'inizio", () => {
    expect(lobbyEndsAtIso("2026-11-17T18:00:00.000Z", 90)).toBe(
      "2026-11-17T19:30:00.000Z",
    );
  });
});

describe("lobbySportCompatible", () => {
  it("stesso sport è compatibile", () => {
    expect(lobbySportCompatible("padel", "padel")).toBe(true);
  });

  it("sport diverso non è compatibile", () => {
    expect(lobbySportCompatible("padel", "tennis")).toBe(false);
  });

  it("sport ignoto da un lato resta compatibile (prudenza)", () => {
    expect(lobbySportCompatible(null, "tennis")).toBe(true);
    expect(lobbySportCompatible("tennis", null)).toBe(true);
    expect(lobbySportCompatible(null, null)).toBe(true);
  });
});

describe("findOverlappingLobby", () => {
  const candidate = {
    startTime: "2026-11-17T19:00:00.000Z",
    durationMinutes: 90, // 19:00–20:30
    sport: "basketball",
  };

  it("trova la lobby sovrapposta", () => {
    const found = findOverlappingLobby(
      [lobby("a", "2026-11-17T19:30:00.000Z", "2026-11-17T21:00:00.000Z")],
      candidate,
    );
    expect(found?.id).toBe("a");
  });

  it("intervalli che si toccano non si sovrappongono", () => {
    // Finisce quando l'altra inizia, e viceversa.
    expect(
      findOverlappingLobby(
        [lobby("a", "2026-11-17T17:30:00.000Z", "2026-11-17T19:00:00.000Z")],
        candidate,
      ),
    ).toBeNull();
    expect(
      findOverlappingLobby(
        [lobby("a", "2026-11-17T20:30:00.000Z", "2026-11-17T22:00:00.000Z")],
        candidate,
      ),
    ).toBeNull();
  });

  it("contenuta o contenente contano entrambe", () => {
    expect(
      findOverlappingLobby(
        [lobby("dentro", "2026-11-17T19:30:00.000Z", "2026-11-17T20:00:00.000Z")],
        candidate,
      )?.id,
    ).toBe("dentro");
    expect(
      findOverlappingLobby(
        [lobby("fuori", "2026-11-17T18:00:00.000Z", "2026-11-17T23:00:00.000Z")],
        candidate,
      )?.id,
    ).toBe("fuori");
  });

  it("sport diverso sullo stesso campo non avvisa", () => {
    expect(
      findOverlappingLobby(
        [lobby("a", "2026-11-17T19:30:00.000Z", "2026-11-17T21:00:00.000Z", "tennis")],
        candidate,
      ),
    ).toBeNull();
  });

  it("sport ignoto da un lato avvisa", () => {
    expect(
      findOverlappingLobby(
        [lobby("a", "2026-11-17T19:30:00.000Z", "2026-11-17T21:00:00.000Z", null)],
        candidate,
      )?.id,
    ).toBe("a");
    expect(
      findOverlappingLobby(
        [lobby("a", "2026-11-17T19:30:00.000Z", "2026-11-17T21:00:00.000Z")],
        { ...candidate, sport: null },
      )?.id,
    ).toBe("a");
  });

  it("sceglie la prima per orario, indipendentemente dall'ordine", () => {
    const found = findOverlappingLobby(
      [
        lobby("tardi", "2026-11-17T20:00:00.000Z", "2026-11-17T21:00:00.000Z"),
        lobby("presto", "2026-11-17T19:10:00.000Z", "2026-11-17T20:00:00.000Z"),
      ],
      candidate,
    );
    expect(found?.id).toBe("presto");
  });

  it("ignora ends_at nullo", () => {
    expect(
      findOverlappingLobby([lobby("a", "2026-11-17T19:30:00.000Z", null)], candidate),
    ).toBeNull();
  });
});

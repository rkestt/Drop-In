import { describe, expect, it } from "vitest";
import { lobbyPhase, lobbyPhaseLabel } from "@/lib/lobby/phase";

// #91: "in corso" non è più uno stato scritto nel DB, si deriva da
// start_time/ends_at. Intervallo semiaperto [inizio, fine).
const lobby = (status: string | null, start: string, end: string | null) => ({
  status,
  start_time: start,
  ends_at: end,
});

const START = "2026-11-18T19:00:00.000Z";
const END = "2026-11-18T20:00:00.000Z";

describe("lobbyPhaseLabel", () => {
  it("unica mappa fase->etichetta per badge e aria-label", () => {
    expect(lobbyPhaseLabel("open")).toBe("Aperta");
    expect(lobbyPhaseLabel("in_progress")).toBe("In corso");
    expect(lobbyPhaseLabel("closed")).toBe("Chiusa");
  });
});

describe("lobbyPhase", () => {
  it("prima dell'inizio è aperta", () => {
    expect(lobbyPhase(lobby("open", START, END), "2026-11-18T18:00:00.000Z")).toBe(
      "open",
    );
  });

  it("dentro l'intervallo è in corso", () => {
    expect(lobbyPhase(lobby("open", START, END), "2026-11-18T19:30:00.000Z")).toBe(
      "in_progress",
    );
  });

  it("all'inizio esatto è già in corso", () => {
    expect(lobbyPhase(lobby("open", START, END), "2026-11-18T19:00:00.000Z")).toBe(
      "in_progress",
    );
  });

  it("alla fine esatta non è più in corso", () => {
    expect(lobbyPhase(lobby("open", START, END), "2026-11-18T20:00:00.000Z")).toBe(
      "open",
    );
  });

  it("oltre la fine resta lo stato del DB finché il cron non chiude", () => {
    expect(lobbyPhase(lobby("open", START, END), "2026-11-18T21:00:00.000Z")).toBe(
      "open",
    );
  });

  it("status closed vince sull'orologio", () => {
    expect(lobbyPhase(lobby("closed", START, END), "2026-11-18T19:30:00.000Z")).toBe(
      "closed",
    );
  });

  it("dates invalide o ends_at nullo → solo lo stato del DB", () => {
    expect(lobbyPhase(lobby("open", START, null), "2026-11-18T19:30:00.000Z")).toBe(
      "open",
    );
    expect(lobbyPhase(lobby("open", "non-una-data", END), "2026-11-18T19:30:00.000Z")).toBe(
      "open",
    );
  });

  it("accetta un Date e un now non finito", () => {
    expect(
      lobbyPhase(lobby("open", START, END), new Date("2026-11-18T19:30:00.000Z")),
    ).toBe("in_progress");
    expect(lobbyPhase(lobby("open", START, END), Number.NaN)).toBe("open");
  });
});

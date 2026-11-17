import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOBBY_DURATION_MINUTES,
  defaultDurationForSport,
  uniqueCourtSport,
} from "@/lib/sport/sports";
import { createLobbySchema } from "@/lib/validation/schemas";

// #96: mapping sport->durata e sport univoco del campo.
describe("defaultDurationForSport", () => {
  it("volleyball e padel valgono 90", () => {
    expect(defaultDurationForSport("volleyball")).toBe(90);
    expect(defaultDurationForSport("padel")).toBe(90);
  });

  it("futsal vale 60", () => {
    expect(defaultDurationForSport("futsal")).toBe(60);
  });

  it("ignoto e altri sport valgono 30", () => {
    expect(defaultDurationForSport(null)).toBe(DEFAULT_LOBBY_DURATION_MINUTES);
    expect(defaultDurationForSport("basketball")).toBe(30);
    expect(defaultDurationForSport("qualcosa")).toBe(30);
  });
});

describe("uniqueCourtSport", () => {
  it("campo con un solo sport lo restituisce", () => {
    expect(uniqueCourtSport("basketball")).toBe("basketball");
  });

  it("NULL, multi e multi-valore danno null (scelta nel drawer)", () => {
    expect(uniqueCourtSport(null)).toBeNull();
    expect(uniqueCourtSport("multi")).toBeNull();
    expect(uniqueCourtSport("basketball;soccer")).toBeNull();
    expect(uniqueCourtSport("")).toBeNull();
  });
});

describe("createLobbySchema durata/sport", () => {
  const base = { startTime: new Date(Date.now() + 3600_000).toISOString(), maxPlayers: 10 };
  it("accetta durata e sport opzionali", () => {
    const r = createLobbySchema.safeParse({ ...base, durationMinutes: 90, sport: "volleyball" });
    expect(r.success).toBe(true);
  });

  it("rifiuta durate fuori 15..240", () => {
    expect(createLobbySchema.safeParse({ ...base, durationMinutes: 10 }).success).toBe(false);
    expect(createLobbySchema.safeParse({ ...base, durationMinutes: 300 }).success).toBe(false);
  });

  it("rifiuta sport fuori lista", () => {
    expect(createLobbySchema.safeParse({ ...base, sport: "quidditch" }).success).toBe(false);
  });
});

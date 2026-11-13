import { describe, expect, it } from "vitest";
import { mapJoinError, mapLeaveError } from "@/lib/lobbies/join-errors";

// Mappa pura degli errori di join/leave (issue #77): la lobby chiusa vince
// sul permanent generico, mai raw DB in UI, retry solo quando ha senso.
describe("mapJoinError", () => {
  it("status closed → Lobby chiusa, senza retry", () => {
    const out = mapJoinError({ status: "closed" });
    expect(out.kind).toBe("closed");
    expect(out.message).toMatch(/Lobby chiusa/);
    expect(out.canRetry).toBe(false);
  });

  it("status in_progress → lobby in corso, senza retry", () => {
    const out = mapJoinError({ status: "in_progress" });
    expect(out.kind).toBe("closed");
    expect(out.message).toMatch(/in corso/i);
    expect(out.message).not.toMatch(/Lobby chiusa/);
    expect(out.canRetry).toBe(false);
  });

  it("trigger P0001 lobby chiusa/scaduta → chiuso anche con status open (stale)", () => {
    const out = mapJoinError({
      status: "open",
      code: "P0001",
      message: "Questa lobby è chiusa: le iscrizioni sono scadute",
    });
    expect(out.kind).toBe("closed");
    expect(out.message).toMatch(/Lobby chiusa/);
    expect(out.canRetry).toBe(false);
  });

  it("forme in chiaro: non più attiva / no longer → chiuso", () => {
    for (const message of [
      "lobby non più attiva",
      "lobby non piu attiva",
      "this lobby is no longer available",
    ]) {
      const out = mapJoinError({ status: "open", message });
      expect(out.kind).toBe("closed");
      expect(out.canRetry).toBe(false);
    }
  });

  it("lobby piena → testo Posti esauriti esistente, senza retry", () => {
    const out = mapJoinError({
      status: "open",
      message: "posti esauriti per questa lobby",
    });
    expect(out.kind).toBe("full");
    expect(out.message).toBe(
      "Posti esauriti: questa lobby è al completo. Crea la tua lobby.",
    );
    expect(out.canRetry).toBe(false);
  });

  it("lobby piena in altre forme (piena / limite giocatori) → full", () => {
    for (const message of [
      "La lobby è piena",
      "limite di giocatori raggiunto",
      "troppi partecipanti",
    ]) {
      const out = mapJoinError({ status: "open", message });
      expect(out.kind).toBe("full");
      expect(out.canRetry).toBe(false);
    }
  });

  it("duplicato 23505 → Sei già dentro, senza retry", () => {    const out = mapJoinError({
      status: "open",
      code: "23505",
      message:
        'duplicate key value violates unique constraint "lobby_participants_lobby_id_user_id_key"',
    });
    expect(out.kind).toBe("duplicate");
    expect(out.message).toBe("Sei già dentro questa lobby.");
    expect(out.canRetry).toBe(false);
  });

  it("rete caduta → transient con retry", () => {
    const out = mapJoinError({ status: "open", message: "Failed to fetch" });
    expect(out.kind).toBe("transient");
    expect(out.canRetry).toBe(true);
  });

  it("permanent generico (es. karma) → frase fissa, senza retry, niente raw", () => {
    const raw = "P0001 Karma troppo basso (42). Non puoi partecipare.";
    const out = mapJoinError({ status: "open", code: "P0001", message: raw });
    expect(out.kind).toBe("permanent");
    expect(out.canRetry).toBe(false);
    expect(out.message).not.toContain("Karma troppo basso");
    expect(out.message).not.toContain("P0001");
  });

  it("42501 RLS non è transient (il 5xx matcha solo codici HTTP interi)", () => {
    const out = mapJoinError({
      status: "open",
      code: "42501",
      message: "42501 new row violates row-level security policy",
    });
    expect(out.kind).toBe("permanent");
    expect(out.canRetry).toBe(false);
  });

  it("input vuoto → permanent generico, non crash", () => {
    const out = mapJoinError({});
    expect(out.kind).toBe("permanent");
    expect(out.canRetry).toBe(false);
  });
});

describe("mapLeaveError", () => {
  it("lobby chiusa → stesso messaggio, senza retry", () => {
    const out = mapLeaveError({ status: "closed" });
    expect(out.kind).toBe("closed");
    expect(out.message).toMatch(/Lobby chiusa/);
    expect(out.canRetry).toBe(false);
  });

  it("rete caduta → transient con retry", () => {
    const out = mapLeaveError({ message: "NetworkError" });
    expect(out.kind).toBe("transient");
    expect(out.canRetry).toBe(true);
  });

  it("errore ignoto → generico uscita, senza raw", () => {
    const out = mapLeaveError({ message: "42501 policy violated" });
    expect(out.kind).toBe("permanent");
    expect(out.message).not.toContain("42501");
    expect(out.canRetry).toBe(false);
  });

  it("in_progress non è 'chiusa': un errore in corso resta generico", () => {
    const out = mapLeaveError({ status: "in_progress", message: "boom" });
    expect(out.kind).toBe("permanent");
    expect(out.message).not.toMatch(/Lobby chiusa/);
  });
});

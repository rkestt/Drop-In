import { describe, expect, it } from "vitest";
import {
  expiryFromCheckin,
  formatExpiry,
  fromAccuracy,
  fromGeolocationCode,
  fromInsertError,
  isCheckinActive,
  parseDistanceMeters,
} from "@/lib/checkin/errors";

describe("fromGeolocationCode", () => {
  it("code 1 → permesso negato con recovery", () => {
    const info = fromGeolocationCode(1);
    expect(info.kind).toBe("denied");
    expect(info.body).toMatch(/impostazioni/i);
    expect(info.retryLabel).toBe("Riprova");
  });

  it("code 2 → posizione non disponibile", () => {
    const info = fromGeolocationCode(2);
    expect(info.kind).toBe("unavailable");
    expect(info.title).toMatch(/non disponibile/i);
  });

  it("code 3 → timeout, messaggio distinto dal code 2", () => {
    const timeout = fromGeolocationCode(3);
    const unavailable = fromGeolocationCode(2);
    expect(timeout.kind).toBe("timeout");
    expect(timeout.body).not.toBe(unavailable.body);
  });
});

describe("fromAccuracy", () => {
  it("≤ 20 m → nessun errore", () => {
    expect(fromAccuracy(12)).toBeNull();
    expect(fromAccuracy(20)).toBeNull();
  });

  it("> 20 m → segnale debole con metri arrotondati", () => {
    const info = fromAccuracy(45.4);
    expect(info?.kind).toBe("low-accuracy");
    expect(info?.body).toMatch(/±45 m/);
  });
});

describe("fromInsertError", () => {
  it("messaggio distanza del trigger → fuori raggio con metri", () => {
    const info = fromInsertError(
      "Sei troppo lontano dal campo (120 m). Avvicinati per fare check-in."
    );
    expect(info.kind).toBe("out-of-range");
    expect(info.body).toMatch(/120 m/);
    expect(info.retryLabel).toBe("Aggiorna posizione");
  });

  it("distanza senza metri → fuori raggio generico", () => {
    const info = fromInsertError("Sei troppo lontano dal campo.");
    expect(info.kind).toBe("out-of-range");
    expect(info.body).toMatch(/troppo lontano/i);
  });

  it("relitto del vecchio formato con decimali → metri arrotondati", () => {
    expect(
      parseDistanceMeters("Sei troppo lontano dal campo (1003.40670779.0f m).")
        .meters
    ).toBe(1003);
  });

  it("cooldown 5 minuti → stato dedicato", () => {
    const info = fromInsertError(
      "Devi attendere 5 minuti prima di fare di nuovo check-in su questo campo"
    );
    expect(info.kind).toBe("cooldown");
  });

  it("generico → server con dati conservati", () => {
    const info = fromInsertError("connection reset");
    expect(info.kind).toBe("server");
    expect(info.hint).toMatch(/resta valida/i);
  });

  it("sessione mancante → accesso richiesto", () => {
    const info = fromInsertError("Devi effettuare l'accesso per fare check-in.");
    expect(info.kind).toBe("auth");
    expect(info.body).toMatch(/accedi di nuovo/i);
    expect(info.retryLabel).toBe("Accedi");
  });

  it("già dentro → nessun secondo check-in", () => {
    const info = fromInsertError("Hai già un check-in attivo su questo campo");
    expect(info.kind).toBe("already-inside");
  });

  it("P0001 campi approvati → campo non approvato, senza retry a vuoto", () => {
    const info = fromInsertError(
      "Operazione consentita solo su campi approvati."
    );
    expect(info.kind).toBe("court-not-approved");
    expect(info.title).toBe("Campo non approvato");
    expect(info.body).toMatch(/quando viene approvato/i);
    expect(info.retryLabel).toBe("Chiudi");
    expect(info.hint).toBeUndefined();
  });

  it("varianti di revisione → stesso stato dedicato", () => {
    for (const msg of [
      "Campo in revisione: attendi l'approvazione.",
      "court is pending moderation",
    ]) {
      expect(fromInsertError(msg).kind).toBe("court-not-approved");
    }
  });
});

describe("parseDistanceMeters", () => {
  it("estrae i metri dal messaggio del trigger", () => {
    expect(parseDistanceMeters("…(120 m)…").meters).toBe(120);
  });

  it("null senza metri", () => {
    expect(parseDistanceMeters("errore generico").meters).toBeNull();
  });
});

describe("expiryFromCheckin", () => {
  it("scadenza = check-in + 2h, formato it-IT", () => {
    const expiry = expiryFromCheckin("2026-11-10T17:40:00+01:00");
    expect(formatExpiry(expiry)).toBe("19:40");
  });
});

describe("isCheckinActive", () => {
  it("check-in vecchio di 3h → scaduto", () => {
    expect(
      isCheckinActive("2026-11-10T17:40:00+01:00", new Date("2026-11-10T20:40:01+01:00"))
    ).toBe(false);
  });

  it("check-in di 1h fa → attivo", () => {
    expect(
      isCheckinActive("2026-11-10T17:40:00+01:00", new Date("2026-11-10T18:40:00+01:00"))
    ).toBe(true);
  });

  it("scadenza esatta → scaduto", () => {
    expect(
      isCheckinActive("2026-11-10T17:40:00+01:00", new Date("2026-11-10T19:40:00+01:00"))
    ).toBe(false);
  });
});
